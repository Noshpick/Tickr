import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';

const PORT = Number(process.env.PORT ?? 9101);
const BASE: Record<string, number> = { btcusdt: 65000, ethusdt: 3200, solusdt: 150 };
const SUFFIXES = ['trade', 'depth20@100ms', 'kline_1m', 'ticker'];

interface Client {
  symbol: string;
  streams: Set<string>;
}

const clients = new Map<WebSocket, Client>();
let blocked = false;
let tradeId = 0;
const ticks: Record<string, number> = {};

const priceAt = (symbol: string, n: number) => (BASE[symbol] ?? 100) + ((n * 7) % 10_000) / 100;
const fixed = (n: number) => n.toFixed(2);

const frame = (stream: string, data: unknown) => JSON.stringify({ stream, data });

const depth = (price: number) => ({
  bids: Array.from({ length: 20 }, (_, i) => [fixed(price - 0.5 - i * 0.5), (0.1 + (i % 5) * 0.37).toFixed(4)]),
  asks: Array.from({ length: 20 }, (_, i) => [fixed(price + 0.5 + i * 0.5), (0.2 + (i % 4) * 0.41).toFixed(4)]),
});

const kline = (price: number) => ({
  k: {
    t: Math.floor(Date.now() / 60_000) * 60_000,
    o: fixed(price - 3),
    h: fixed(price + 5),
    l: fixed(price - 6),
    c: fixed(price),
  },
});

const ticker = (price: number) => ({
  P: '1.23',
  h: fixed(price + 40),
  l: fixed(price - 40),
  q: '1234567890.12',
});

setInterval(() => {
  for (const [ws, client] of clients) {
    if (ws.readyState !== ws.OPEN) continue;
    const { symbol, streams } = client;
    const n = (ticks[symbol] = (ticks[symbol] ?? 0) + 1);
    const price = priceAt(symbol, n);
    const send = (suffix: string, data: unknown) => {
      const name = `${symbol}@${suffix}`;
      if (streams.has(name)) ws.send(frame(name, data));
    };

    send('trade', {
      t: ++tradeId,
      p: fixed(price),
      q: (0.01 + (n % 9) * 0.013).toFixed(4),
      T: Date.now(),
      m: n % 2 === 0,
    });
    if (n % 2 === 0) send('depth20@100ms', depth(price));
    send('kline_1m', kline(price));
    if (n % 10 === 0) send('ticker', ticker(price));
  }
}, 50);

const history = (symbol: string, limit: number) => {
  const now = Math.floor(Date.now() / 60_000) * 60_000;
  return Array.from({ length: limit }, (_, i) => {
    const time = now - (limit - 1 - i) * 60_000;
    const close = priceAt(symbol, i * 13);
    return [time, fixed(close - 2), fixed(close + 4), fixed(close - 5), fixed(close), '10.00', time + 59_999];
  });
};

const reply = (res: ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
};

const handle = (req: IncomingMessage, res: ServerResponse) => {
  const url = new URL(req.url ?? '/', 'http://localhost');

  if (url.pathname === '/health') return reply(res, 200, { status: 'ok', clients: clients.size, blocked });

  if (url.pathname === '/__control/block') {
    blocked = true;
    clients.forEach((_, ws) => ws.terminate());
    return reply(res, 200, { blocked });
  }

  if (url.pathname === '/__control/unblock') {
    blocked = false;
    return reply(res, 200, { blocked });
  }

  if (url.pathname === '/api/v3/klines') {
    const symbol = (url.searchParams.get('symbol') ?? '').toLowerCase();
    return reply(res, 200, history(symbol, Number(url.searchParams.get('limit') ?? 120)));
  }

  reply(res, 404, { error: 'not found' });
};

const server = createServer(handle);
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const names = (url.searchParams.get('streams') ?? '').split('/').filter(Boolean);
  const symbol = names[0]?.split('@')[0];

  if (blocked || url.pathname !== '/stream' || !symbol || !(symbol in BASE)) {
    socket.write('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n');
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    clients.set(ws, { symbol, streams: new Set(names.filter((n) => SUFFIXES.some((s) => n.endsWith(`@${s}`)))) });
    ws.on('close', () => clients.delete(ws));
    ws.on('error', () => ws.terminate());
  });
});

server.listen(PORT, () => console.log(`fake upstream on :${PORT}`));
