import type { BookLevel, Candle, MarketEvent, Stats, Trade } from './types';

export const MAX_TRADES = 30;
export const MAX_CANDLES = 120;

export interface MarketState {
  lastPrice: number | null;

  direction: 1 | -1 | 0;
  trades: Trade[];
  bids: BookLevel[];
  asks: BookLevel[];
  candles: Candle[];
  stats: Stats | null;
}

export const initialMarketState: MarketState = {
  lastPrice: null,
  direction: 0,
  trades: [],
  bids: [],
  asks: [],
  candles: [],
  stats: null,
};

function upsertCandle(candles: Candle[], candle: Candle): Candle[] {
  const last = candles[candles.length - 1];
  if (last && last.time === candle.time) {
    return [...candles.slice(0, -1), candle];
  }
  return [...candles, candle].slice(-MAX_CANDLES);
}

export function mergeHistory(existing: Candle[], history: Candle[]): Candle[] {
  const byTime = new Map<number, Candle>();
  history.forEach((c) => byTime.set(c.time, c));
  existing.forEach((c) => byTime.set(c.time, c));
  return [...byTime.values()].sort((a, b) => a.time - b.time).slice(-MAX_CANDLES);
}

export function reduceEvent(state: MarketState, event: MarketEvent): MarketState {
  switch (event.type) {
    case 'trade': {
      const { trade } = event;
      const prev = state.lastPrice;
      return {
        ...state,
        lastPrice: trade.price,
        direction: prev === null || trade.price === prev ? state.direction : trade.price > prev ? 1 : -1,
        trades: [trade, ...state.trades].slice(0, MAX_TRADES),
      };
    }
    case 'book':
      return { ...state, bids: event.bids, asks: event.asks };
    case 'candle':
      return { ...state, candles: upsertCandle(state.candles, event.candle) };
    case 'ticker':
      return { ...state, stats: event.stats };
    case 'history':
      return { ...state, candles: mergeHistory(state.candles, event.candles) };
  }
}

export function reduceEvents(state: MarketState, events: MarketEvent[]): MarketState {
  return events.reduce(reduceEvent, state);
}
