export const AXIS_W = 76;
export const AXIS_H = 26;
export const MIN_SLOTS = 60;
export const MIN_CANDLE_PX = 6;
export const INDICATOR_WARMUP = 50;

export interface VisibleWindow {
  start: number;
  count: number;
}

export function visibleWindow(total: number, plotW: number): VisibleWindow {
  const room = total > INDICATOR_WARMUP + 20 ? total - INDICATOR_WARMUP : total;
  const count = Math.max(1, Math.min(room, Math.floor(plotW / MIN_CANDLE_PX)));
  return { start: Math.max(0, total - count), count };
}

export const slotWidth = (plotW: number, count: number) => plotW / Math.max(count, MIN_SLOTS);

export function xAt(index: number, plotW: number, total: number): number {
  const { count } = visibleWindow(total, plotW);
  return plotW - (total - index - 0.5) * slotWidth(plotW, count);
}

export function candleIndexAt(x: number, plotW: number, total: number): number | null {
  if (x < 0 || x > plotW || total === 0) return null;
  const { start, count } = visibleWindow(total, plotW);
  const index = total - 1 - Math.floor((plotW - x) / slotWidth(plotW, count));
  return index >= start && index < total ? index : null;
}
