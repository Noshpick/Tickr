import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { useIndicators } from '../../indicators/useIndicators';
import { valueAt } from '../../indicators/series';
import type { IndicatorKey, IndicatorSet, Series } from '../../indicators/types';
import { useRenderCount } from '../../../shared/perf';
import { AXIS_H, AXIS_W, candleIndexAt, slotWidth, visibleWindow, xAt } from '../chartLayout';
import { getPriceRange, getTicks, priceToY } from '../chartMath';
import { formatClock, formatPrice } from '../format';
import type { Candle } from '../types';
import { useFeed, useMarketSelector } from '../useMarketFeed';
import { IndicatorChips } from './IndicatorChips';
import { RsiPane } from './RsiPane';

interface OverlayState {
  result: IndicatorSet | null;
  enabled: ReadonlySet<IndicatorKey>;
}

function draw(canvas: HTMLCanvasElement, candles: Candle[], hover: number | null, overlays: OverlayState) {
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

  const plotW = w - AXIS_W;
  const plotH = h - AXIS_H;
  if (plotW <= 0 || plotH <= 0) return;

  const { start, count } = visibleWindow(candles.length, plotW);
  const range = getPriceRange(candles.slice(start));
  if (!range) return;

  const { result, enabled } = overlays;
  const include = (value: number | null) => {
    if (value === null) return;
    range.min = Math.min(range.min, value);
    range.max = Math.max(range.max, value);
  };
  if (result) {
    for (let i = start; i < candles.length; i++) {
      if (enabled.has('sma')) include(valueAt(result.sma20, i, candles.length));
      if (enabled.has('ema')) include(valueAt(result.ema50, i, candles.length));
      if (enabled.has('bb')) {
        include(valueAt(result.bbUpper, i, candles.length));
        include(valueAt(result.bbLower, i, candles.length));
      }
    }
  }

  const css = getComputedStyle(canvas);
  const color = (name: string) => css.getPropertyValue(name).trim();
  const up = color('--up');
  const down = color('--down');
  const grid = color('--grid');
  const muted = color('--muted');

  const step = slotWidth(plotW, count);
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
    if (i < start || (candles.length - 1 - i) % every !== 0) return;
    ctx.fillStyle = muted;
    ctx.fillText(formatClock(c.time), xAt(i, plotW, candles.length), plotH + 14);
  });

  ctx.lineWidth = 1;
  candles.forEach((c, i) => {
    if (i < start) return;
    const x = xAt(i, plotW, candles.length);
    ctx.strokeStyle = ctx.fillStyle = c.close >= c.open ? up : down;
    ctx.beginPath();
    ctx.moveTo(Math.round(x) + 0.5, priceToY(c.high, range, plotH));
    ctx.lineTo(Math.round(x) + 0.5, priceToY(c.low, range, plotH));
    ctx.stroke();
    const yOpen = priceToY(c.open, range, plotH);
    const yClose = priceToY(c.close, range, plotH);
    ctx.fillRect(x - bodyW / 2, Math.min(yOpen, yClose), bodyW, Math.max(1, Math.abs(yOpen - yClose)));
  });

  const drawSeries = (series: Series, stroke: string, width = 1.5) => {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    let started = false;
    for (let i = start; i < candles.length; i++) {
      const value = valueAt(series, i, candles.length);
      if (value === null) {
        started = false;
        continue;
      }
      const x = xAt(i, plotW, candles.length);
      const y = priceToY(value, range, plotH);
      if (started) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
      started = true;
    }
    ctx.stroke();
  };

  if (result && enabled.has('bb')) {
    drawSeries(result.bbUpper, color('--ind-bb'), 1);
    drawSeries(result.bbLower, color('--ind-bb'), 1);
  }
  if (result && enabled.has('sma')) drawSeries(result.sma20, color('--ind-sma'));
  if (result && enabled.has('ema')) drawSeries(result.ema50, color('--ind-ema'));

  const lastColor = lastCandle.close >= lastCandle.open ? up : down;
  ctx.lineWidth = 1;
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

  if (hover !== null && hover >= start) {
    const c = candles[hover]!;
    const x = xAt(hover, plotW, candles.length);
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

function indicatorValues(
  result: IndicatorSet | null,
  index: number,
  count: number,
): Partial<Record<IndicatorKey, string>> {
  if (!result || index < 0) return {};
  const sma = valueAt(result.sma20, index, count);
  const ema = valueAt(result.ema50, index, count);
  const upper = valueAt(result.bbUpper, index, count);
  const lower = valueAt(result.bbLower, index, count);
  const rsi = valueAt(result.rsi14, index, count);
  return {
    sma: sma === null ? undefined : formatPrice(sma),
    ema: ema === null ? undefined : formatPrice(ema),
    bb: upper === null || lower === null ? undefined : `${formatPrice(lower)} / ${formatPrice(upper)}`,
    rsi: rsi === null ? undefined : rsi.toFixed(1),
  };
}

export function CandleChart() {
  useRenderCount('CandleChart');
  const { market } = useFeed();
  const ref = useRef<HTMLCanvasElement>(null);
  const hoverRef = useRef<number | null>(null);
  const redraw = useRef<() => void>(() => {});
  const [hovered, setHovered] = useState<number | null>(null);
  const [enabled, setEnabled] = useState<ReadonlySet<IndicatorKey>>(() => new Set());
  const candles = useMarketSelector((s) => s.candles);
  const { result } = useIndicators(market);
  const overlays = useRef<OverlayState>({ result, enabled });
  overlays.current = { result, enabled };

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    hoverRef.current = null;
    setHovered(null);
    const render = () => draw(canvas, market.getState().candles, hoverRef.current, overlays.current);
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

  useEffect(() => {
    redraw.current();
  }, [result, enabled]);

  const updateHover = (index: number | null) => {
    if (index === hoverRef.current) return;
    hoverRef.current = index;
    setHovered(index);
    redraw.current();
  };

  const onMove = (e: PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    updateHover(candleIndexAt(e.clientX - rect.left, rect.width - AXIS_W, market.getState().candles.length));
  };

  const toggle = (key: IndicatorKey) => {
    setEnabled((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const shownIndex = hovered ?? candles.length - 1;
  const shown = shownIndex >= 0 ? candles[shownIndex] : undefined;
  const values = indicatorValues(result, shownIndex, candles.length);

  return (
    <section className={`panel panel--chart${enabled.has('rsi') ? ' panel--with-rsi' : ''}`}>
      <div className="panel__head">
        <h2 className="panel__title">График · 1 минута</h2>
        <Legend candle={shown} />
      </div>
      <IndicatorChips enabled={enabled} values={values} onToggle={toggle} />
      <div className="chart-wrap">
        <canvas
          ref={ref}
          className="chart"
          aria-label="График свечей"
          onPointerMove={onMove}
          onPointerLeave={() => updateHover(null)}
        />
        {candles.length === 0 && <div className="chart-loading skeleton" />}
      </div>
      {enabled.has('rsi') && (
        <RsiPane result={result} hover={hovered} count={candles.length} onHover={updateHover} />
      )}
    </section>
  );
}
