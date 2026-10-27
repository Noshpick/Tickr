import { createStore, type Store } from '../../shared/createStore';
import { createReconnectingSocket, type SocketStatus } from '../../shared/reconnectingSocket';
import { parseMessage } from './parse';
import { initialMarketState, reduceEvents, type MarketState } from './reducer';
import type { Candle, MarketEvent } from './types';

export interface MarketFeed {
  market: Store<MarketState>;
  status: Store<SocketStatus>;
  close: () => void;
}

const DEFAULT_WS_HOST = 'wss://data-stream.binance.vision';

export const buildStreamUrl = (symbol: string, host: string = import.meta.env.VITE_WS_HOST ?? DEFAULT_WS_HOST): string => {
  const s = symbol.toLowerCase();
  return `${host}/stream?streams=${s}@trade/${s}@depth20@100ms/${s}@kline_1m/${s}@ticker`;
};

const DEFAULT_API_HOST = 'https://data-api.binance.vision';

export async function fetchHistory(
  symbol: string,
  signal?: AbortSignal,
  host: string = import.meta.env.VITE_API_HOST ?? DEFAULT_API_HOST,
): Promise<Candle[]> {
  const res = await fetch(`${host}/api/v3/klines?symbol=${symbol.toUpperCase()}&interval=1m&limit=120`, { signal });
  if (!res.ok) throw new Error(`klines: ${res.status}`);
  const rows = (await res.json()) as [number, string, string, string, string][];
  return rows.map(([time, o, h, l, c]) => ({
    time,
    open: Number(o),
    high: Number(h),
    low: Number(l),
    close: Number(c),
  }));
}

export function createMarketFeed(symbol: string): MarketFeed {
  const market = createStore<MarketState>(initialMarketState);
  const status = createStore<SocketStatus>('connecting');

  let pending: MarketEvent[] = [];
  let frame = 0;

  const flush = () => {
    frame = 0;
    const batch = pending;
    pending = [];
    market.setState((prev) => reduceEvents(prev, batch));
  };

  const socket = createReconnectingSocket({
    url: buildStreamUrl(symbol),
    onStatus: (s) => status.setState(() => s),
    onMessage: (raw) => {
      const event = parseMessage(raw);
      if (!event) return;
      pending.push(event);
      if (!frame) frame = requestAnimationFrame(flush);
    },
  });

  const abort = new AbortController();
  fetchHistory(symbol, abort.signal)
    .then((candles) => market.setState((prev) => reduceEvents(prev, [{ type: 'history', candles }])))
    .catch(() => {

    });

  return {
    market,
    status,
    close: () => {
      abort.abort();
      cancelAnimationFrame(frame);
      socket.close();
    },
  };
}
