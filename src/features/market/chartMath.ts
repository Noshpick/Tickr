import type { Candle } from './types';

export interface PriceRange {
  min: number;
  max: number;
}

export function getPriceRange(candles: Candle[]): PriceRange | null {
  if (candles.length === 0) return null;
  let min = Infinity;
  let max = -Infinity;
  for (const c of candles) {
    if (c.low < min) min = c.low;
    if (c.high > max) max = c.high;
  }

  const pad = (max - min || max * 0.001 || 1) * 0.08;
  return { min: min - pad, max: max + pad };
}

export function priceToY(price: number, range: PriceRange, height: number): number {
  return height - ((price - range.min) / (range.max - range.min)) * height;
}

export function getTicks(range: PriceRange, count = 6): number[] {
  const raw = (range.max - range.min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  const first = Math.ceil(range.min / step) * step;
  const ticks: number[] = [];
  for (let i = 0; first + i * step <= range.max; i++) ticks.push(Number((first + i * step).toFixed(10)));
  return ticks;
}
