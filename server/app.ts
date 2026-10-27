import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocketServer, type WebSocket } from 'ws';
import type { Hub } from './hub';
import { parseKlinesRequest, parseStreamRequest } from './streams';
import type { TtlCache } from './ttlCache';

export type KlinesLoader = (symbol: string, limit: number) => Promise<string>;

export interface AppOptions {
  hub: Hub;
  klinesCache: TtlCache<string>;
  loadKlines: KlinesLoader;
  maxClients?: number;
  maxBufferedBytes?: number;
  heartbeatMs?: number;
}

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-headers': 'content-type',
};

const json = (res: ServerResponse, status: number, body: string) => {
  res.writeHead(status, { ...CORS, 'content-type': 'application/json; charset=utf-8' });
  res.end(body);
};

const reject = (socket: Duplex, status: string) => {
  socket.write(`HTTP/1.1 ${status}\r\nConnection: close\r\n\r\n`);
  socket.destroy();
};

export function createApp({
  hub,
  klinesCache,
  loadKlines,
  maxClients = 1000,
  maxBufferedBytes = 1_000_000,
  heartbeatMs = 30_000,
}: AppOptions): Server {
  const wss = new WebSocketServer({ noServer: true });
  const alive = new WeakSet<WebSocket>();

  const handleHttp = async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? '/', 'http://localhost');

    if (req.method === 'OPTIONS') {
      res.writeHead(204, CORS);
      res.end();
      return;
    }

    if (req.method !== 'GET') {
      json(res, 405, '{"error":"method not allowed"}');
      return;
    }

    if (url.pathname === '/health') {
      json(res, 200, JSON.stringify({ status: 'ok', hub: hub.stats(), klines: klinesCache.stats() }));
      return;
    }

    if (url.pathname === '/api/v3/klines') {
      const request = parseKlinesRequest(url.searchParams);
      if (!request) {
        json(res, 400, '{"error":"bad request"}');
        return;
      }
      try {
        const body = await klinesCache.get(`${request.symbol}:${request.limit}`, () =>
          loadKlines(request.symbol, request.limit),
        );
        json(res, 200, body);
      } catch {
        json(res, 502, '{"error":"upstream unavailable"}');
      }
      return;
    }

    json(res, 404, '{"error":"not found"}');
  };

  const server = createServer((req, res) => {
    void handleHttp(req, res);
  });

  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const request = url.pathname === '/stream' ? parseStreamRequest(url.searchParams) : null;
    if (!request) return reject(socket, '400 Bad Request');
    if (wss.clients.size >= maxClients) return reject(socket, '503 Service Unavailable');

    wss.handleUpgrade(req, socket, head, (ws) => {
      alive.add(ws);
      ws.on('pong', () => alive.add(ws));
      ws.on('error', () => ws.terminate());

      const unsubscribe = hub.subscribe(request.symbol, {
        streams: request.streams,
        send: (raw) => ws.send(raw),
        isBusy: () => ws.bufferedAmount > maxBufferedBytes,
      });
      ws.on('close', unsubscribe);
    });
  });

  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (!alive.has(ws)) {
        ws.terminate();
        continue;
      }
      alive.delete(ws);
      ws.ping();
    }
  }, heartbeatMs);
  heartbeat.unref();

  server.on('close', () => {
    clearInterval(heartbeat);
    wss.clients.forEach((ws) => ws.terminate());
    wss.close();
  });

  return server;
}
