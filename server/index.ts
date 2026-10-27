import { createReconnectingSocket } from '../src/shared/reconnectingSocket';
import { createApp } from './app';
import { createHub, type UpstreamFactory } from './hub';
import { streamsFor } from './streams';
import { createTtlCache } from './ttlCache';

const PORT = Number(process.env.PORT ?? 8787);
const WS_HOST = process.env.UPSTREAM_WS_HOST ?? 'wss://data-stream.binance.vision';
const API_HOST = process.env.UPSTREAM_API_HOST ?? 'https://data-api.binance.vision';
const KLINES_TTL_MS = Number(process.env.KLINES_TTL_MS ?? 5000);

const log = (message: string) => console.log(`${new Date().toISOString()} ${message}`);

const connect: UpstreamFactory = (symbol, onMessage, onStatus) => {
  log(`upstream ${symbol}: connecting`);
  return createReconnectingSocket({
    url: `${WS_HOST}/stream?streams=${streamsFor(symbol).join('/')}`,
    onMessage,
    onStatus: (status) => {
      log(`upstream ${symbol}: ${status}`);
      onStatus(status);
    },
  });
};

const loadKlines = async (symbol: string, limit: number): Promise<string> => {
  const res = await fetch(`${API_HOST}/api/v3/klines?symbol=${symbol}&interval=1m&limit=${limit}`);
  if (!res.ok) throw new Error(`klines: ${res.status}`);
  return res.text();
};

const hub = createHub({ connect });
const server = createApp({
  hub,
  loadKlines,
  klinesCache: createTtlCache<string>({ ttlMs: KLINES_TTL_MS }),
});

server.listen(PORT, () => log(`proxy listening on :${PORT}`));

const shutdown = () => {
  hub.close();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000).unref();
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
