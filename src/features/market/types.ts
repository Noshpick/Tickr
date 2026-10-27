export interface Trade {
  id: number;
  price: number;
  qty: number;
  time: number;

  isSell: boolean;
}

export interface BookLevel {
  price: number;
  qty: number;
}

export interface Candle {

  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface Stats {

  changePct: number;
  high: number;
  low: number;

  volume: number;
}

export type MarketEvent =
  | { type: 'trade'; trade: Trade }
  | { type: 'book'; bids: BookLevel[]; asks: BookLevel[] }
  | { type: 'candle'; candle: Candle }
  | { type: 'history'; candles: Candle[] }
  | { type: 'ticker'; stats: Stats };
