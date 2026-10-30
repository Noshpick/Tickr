import type { Series } from './types';

export function valueAt(series: Series | undefined, index: number, candleCount: number): number | null {
  if (!series) return null;
  return series[index - (candleCount - series.length)] ?? null;
}
