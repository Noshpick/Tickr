import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { WebSocket } from 'ws';
import type { Mock } from 'vitest';
import { createApp, type KlinesLoader } from './app';
import { createHub, type UpstreamFactory } from './hub';
import { createTtlCache } from './ttlCache';

const trade = (n: number) => JSON.stringify({ stream: 'btcusdt@trade', data: { t: n, p: '1', q: '1', T: n, m: false } });

let server: Server;
let base: string;
let emit: (raw: string) => void;
let connects: number;
let loadKlines: Mock<KlinesLoader>;

beforeEach(async () => {
  connects = 0;
  const connect: UpstreamFactory = (_symbol, onMessage) => {
    connects += 1;
    emit = onMessage;
    return { close: () => {} };
  };
  loadKlines = vi.fn<KlinesLoader>(async () => '[[1,"1","2","0","1"]]');
  server = createApp({
    hub: createHub({ connect }),
    klinesCache: createTtlCache<string>({ ttlMs: 5000 }),
    loadKlines,
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterEach(async () => {
  await new Promise<void>((r) => {
    server.close(() => r());
    server.closeAllConnections();
  });
});

const open = (path: string) =>
  new Promise<{ ws: WebSocket; received: string[] }>((resolve, reject) => {
    const ws = new WebSocket(`ws://${base}${path}`);
    const received: string[] = [];
    ws.on('message', (d) => received.push(String(d)));
    ws.on('open', () => resolve({ ws, received }));
    ws.on('error', reject);
  });

const until = async (cond: () => boolean) => {
  for (let i = 0; i < 100 && !cond(); i++) await new Promise((r) => setTimeout(r, 10));
  expect(cond()).toBe(true);
};

describe('websocket', () => {
  it('три клиента делят одно upstream-соединение и получают поток', async () => {
    const clients = await Promise.all(
      [1, 2, 3].map(() => open('/stream?streams=btcusdt@trade')),
    );
    expect(connects).toBe(1);

    emit(trade(1));
    await until(() => clients.every((c) => c.received.length === 1));
    clients.forEach((c) => c.ws.close());
  });

  it('поздний клиент сразу получает последнее значение из кэша', async () => {
    const first = await open('/stream?streams=btcusdt@trade');
    emit(trade(7));
    await until(() => first.received.length === 1);

    const late = await open('/stream?streams=btcusdt@trade');
    await until(() => late.received.length === 1);
    expect(late.received[0]).toBe(trade(7));
    first.ws.close();
    late.ws.close();
  });

  it('отклоняет неизвестный символ и неверный путь', async () => {
    await expect(open('/stream?streams=dogeusdt@trade')).rejects.toThrow();
    await expect(open('/other?streams=btcusdt@trade')).rejects.toThrow();
  });
});

describe('http', () => {
  it('одновременные запросы свечей приводят к одному запросу к бирже', async () => {
    const urls = Array.from({ length: 5 }, () => `http://${base}/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=120`);
    const responses = await Promise.all(urls.map((u) => fetch(u)));

    expect(responses.map((r) => r.status)).toEqual([200, 200, 200, 200, 200]);
    expect(responses[0]!.headers.get('access-control-allow-origin')).toBe('*');
    expect(await responses[0]!.json()).toEqual([[1, '1', '2', '0', '1']]);
    expect(loadKlines).toHaveBeenCalledTimes(1);
  });

  it('валидирует параметры и отдаёт 502 при недоступной бирже', async () => {
    expect((await fetch(`http://${base}/api/v3/klines?symbol=DOGEUSDT&interval=1m`)).status).toBe(400);

    loadKlines.mockRejectedValueOnce(new Error('down'));
    expect((await fetch(`http://${base}/api/v3/klines?symbol=ETHUSDT&interval=1m`)).status).toBe(502);
  });

  it('отдаёт /health со статистикой и отвечает на preflight', async () => {
    const health = await (await fetch(`http://${base}/health`)).json();
    expect(health.status).toBe('ok');
    expect(health.hub.rooms).toEqual([]);

    const preflight = await fetch(`http://${base}/api/v3/klines`, { method: 'OPTIONS' });
    expect(preflight.status).toBe(204);
    expect((await fetch(`http://${base}/nope`)).status).toBe(404);
  });
});
