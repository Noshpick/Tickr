import type { BookLevel, MarketEvent } from './types';

type RawLevel = [string, string];

const toLevels = (raw: RawLevel[]): BookLevel[] =>
  raw.map(([price, qty]) => ({ price: Number(price), qty: Number(qty) }));

export function parseMessage(raw: string): MarketEvent | null {
  let msg: { stream?: string; data?: any };
  try {
    msg = JSON.parse(raw);
  } catch {
    return null;
  }
  const { stream, data } = msg;
  if (!stream || !data) return null;

  if (stream.endsWith('@trade')) {
    return {
      type: 'trade',
      trade: {
        id: data.t,
        price: Number(data.p),
        qty: Number(data.q),
        time: data.T,
        isSell: Boolean(data.m),
      },
    };
  }

  if (stream.endsWith('@ticker')) {
    return {
      type: 'ticker',
      stats: { changePct: Number(data.P), high: Number(data.h), low: Number(data.l), volume: Number(data.q) },
    };
  }

  if (stream.includes('@depth')) {
    return { type: 'book', bids: toLevels(data.bids ?? []), asks: toLevels(data.asks ?? []) };
  }

  if (stream.includes('@kline')) {
    const k = data.k;
    return {
      type: 'candle',
      candle: {
        time: k.t,
        open: Number(k.o),
        high: Number(k.h),
        low: Number(k.l),
        close: Number(k.c),
      },
    };
  }

  return null;
}
