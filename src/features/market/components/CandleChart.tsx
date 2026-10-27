import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { useStore } from '../../../shared/createStore';
import { getPriceRange, getTicks, priceToY } from '../chartMath';
import { formatClock, formatPrice } from '../format';
import type { Candle } from '../types';
import { useFeed } from '../useMarketFeed';

const AXIS_W = 76;
const AXIS_H = 26;
const MIN_SLOTS = 60;

const slotWidth = (plotW: number, count: number) => plotW / Math.max(count, MIN_SLOTS);

function candleIndexAt(x: number, plotW: number, count: number): number | null {
  if (x < 0 || x > plotW || count === 0) return null;
  const index = count - 1 - Math.floor((plotW - x) / slotWidth(plotW, count));
  return index >= 0 && index < count ? index : null;
}

function draw(canvas: HTMLCanvasElement, candles: Candle[], hover: number | null) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const { clientWidth: w, clientHeight: h } = canvas;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const range = getPriceRange(candles);
  if (!range) return;

  const css = getComputedStyle(canvas);
  const color = (name: string) => css.getPropertyValue(name).trim();
  const up = color('--up');
  const down = color('--down');
  const grid = color('--grid');
  const muted = color('--muted');

  const plotW = w - AXIS_W;
  const plotH = h - AXIS_H;
  const step = slotWidth(plotW, candles.length);
  const xAt = (i: number) => plotW - (candles.length - i - 0.5) * step;
  const bodyW = Math.min(14, Math.max(1, step * 0.7));

  ctx.font = '11px ui-sans-serif, system-ui, sans-serif';
  ctx.textBaseline = 'middle';

  const lastCandle = candles[candles.length - 1]!;
  const lastY = priceToY(lastCandle.close, range, plotH);

  ctx.lineWidth = 1;
  ctx.textAlign = 'left';
  for (const tick of getTicks(range)) {
    const y = Math.round(priceToY(tick, range, plotH)) + 0.5;
    ctx.strokeStyle = grid;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(plotW, y);
    ctx.stroke();

    if (Math.abs(y - lastY) < 14) continue;
    ctx.fillStyle = muted;
    ctx.fillText(formatPrice(tick), plotW + 10, y);
  }

  ctx.textAlign = 'center';
  const every = Math.ceil(80 / step);
  candles.forEach((c, i) => {
    if ((candles.length - 1 - i) % every !== 0) return;
    ctx.fillStyle = muted;
    ctx.fillText(formatClock(c.time), xAt(i), plotH + 14);
  });

  ctx.lineWidth = 1;
  candles.forEach((c, i) => {
    const x = xAt(i);
    ctx.strokeStyle = ctx.fillStyle = c.close >= c.open ? up : down;
    ctx.beginPath();
    ctx.moveTo(Math.round(x) + 0.5, priceToY(c.high, range, plotH));
    ctx.lineTo(Math.round(x) + 0.5, priceToY(c.low, range, plotH));
    ctx.stroke();
    const yOpen = priceToY(c.open, range, plotH);
    const yClose = priceToY(c.close, range, plotH);
    ctx.fillRect(x - bodyW / 2, Math.min(yOpen, yClose), bodyW, Math.max(1, Math.abs(yOpen - yClose)));
  });

  const lastColor = lastCandle.close >= lastCandle.open ? up : down;
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = lastColor;
  ctx.beginPath();
  ctx.moveTo(0, lastY);
  ctx.lineTo(plotW, lastY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = lastColor;
  ctx.fillRect(plotW, lastY - 10, AXIS_W, 20);
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'left';
  ctx.fillText(formatPrice(lastCandle.close), plotW + 10, lastY);

  if (hover !== null) {
    const c = candles[hover]!;
    const x = xAt(hover);
    const y = priceToY(c.close, range, plotH);
    ctx.strokeStyle = muted;
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(Math.round(x) + 0.5, 0);
    ctx.lineTo(Math.round(x) + 0.5, plotH);
    ctx.moveTo(0, y);
    ctx.lineTo(plotW, y);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

function Legend({ candle }: { candle: Candle | undefined }) {
  if (!candle) return null;
  const tone = candle.close >= candle.open ? 'up' : 'down';
  const item = (label: string, value: number) => (
    <span className="legend__item">
      {label} <b className={`legend__value legend__value--${tone}`}>{formatPrice(value)}</b>
    </span>
  );
  return (
    <div className="legend">
      <span className="legend__time">{formatClock(candle.time)}</span>
      {item('O', candle.open)}
      {item('H', candle.high)}
      {item('L', candle.low)}
      {item('C', candle.close)}
    </div>
  );
}

export function CandleChart() {
  const { market } = useFeed();
  const ref = useRef<HTMLCanvasElement>(null);
  const hoverRef = useRef<number | null>(null);
  const redraw = useRef<() => void>(() => {});
  const [hovered, setHovered] = useState<number | null>(null);
  const candles = useStore(market, (s) => s.candles);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const render = () => draw(canvas, market.getState().candles, hoverRef.current);
    redraw.current = render;

    render();
    const unsubscribe = market.subscribe(render);
    const observer = new ResizeObserver(render);
    observer.observe(canvas);

    return () => {
      unsubscribe();
      observer.disconnect();
    };
  }, [market]);

  const onMove = (e: PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const index = candleIndexAt(e.clientX - rect.left, rect.width - AXIS_W, market.getState().candles.length);
    if (index === hoverRef.current) return;
    hoverRef.current = index;
    setHovered(index);
    redraw.current();
  };

  const onLeave = () => {
    hoverRef.current = null;
    setHovered(null);
    redraw.current();
  };

  const shown = hovered !== null ? candles[hovered] : candles[candles.length - 1];

  return (
    <section className="panel panel--chart">
      <div className="panel__head">
        <h2 className="panel__title">График · 1 минута</h2>
        <Legend candle={shown} />
      </div>
      <div className="chart-wrap">
        <canvas
          ref={ref}
          className="chart"
          aria-label="График свечей"
          onPointerMove={onMove}
          onPointerLeave={onLeave}
        />
        {candles.length === 0 && <div className="chart-loading skeleton" />}
      </div>
    </section>
  );
}
