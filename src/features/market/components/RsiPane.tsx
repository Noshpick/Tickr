import { useEffect, useRef, type PointerEvent } from 'react';
import type { IndicatorSet } from '../../indicators/types';
import { AXIS_W, candleIndexAt, visibleWindow, xAt } from '../chartLayout';

const PAD = 8;

function draw(canvas: HTMLCanvasElement, result: IndicatorSet, hover: number | null, total: number) {
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

  const css = getComputedStyle(canvas);
  const color = (name: string) => css.getPropertyValue(name).trim();
  const plotW = w - AXIS_W;
  const yOf = (v: number) => PAD + (1 - v / 100) * (h - PAD * 2);
  const { start } = visibleWindow(total, plotW);
  const offset = total - result.rsi14.length;

  ctx.font = '11px ui-sans-serif, system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';

  ctx.fillStyle = color('--ind-rsi');
  ctx.globalAlpha = 0.07;
  ctx.fillRect(0, yOf(70), plotW, yOf(30) - yOf(70));
  ctx.globalAlpha = 1;

  ctx.lineWidth = 1;
  for (const level of [70, 50, 30]) {
    const y = Math.round(yOf(level)) + 0.5;
    ctx.strokeStyle = color('--grid');
    ctx.setLineDash(level === 50 ? [] : [3, 3]);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(plotW, y);
    ctx.stroke();
    ctx.fillStyle = color('--muted');
    ctx.fillText(String(level), plotW + 10, y);
  }
  ctx.setLineDash([]);

  ctx.strokeStyle = color('--ind-rsi');
  ctx.lineWidth = 1.5;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  let started = false;
  result.rsi14.forEach((value, j) => {
    const i = j + offset;
    if (value === null || i < start) return;
    const x = xAt(i, plotW, total);
    if (started) ctx.lineTo(x, yOf(value));
    else ctx.moveTo(x, yOf(value));
    started = true;
  });
  ctx.stroke();

  if (hover !== null) {
    const x = Math.round(xAt(hover, plotW, total)) + 0.5;
    ctx.strokeStyle = color('--muted');
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

interface Props {
  result: IndicatorSet | null;
  hover: number | null;
  count: number;
  onHover: (index: number | null) => void;
}

export function RsiPane({ result, hover, count, onHover }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !result) return;
    const render = () => draw(canvas, result, hover, count);
    render();
    const observer = new ResizeObserver(render);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [result, hover, count]);

  const onMove = (e: PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    onHover(candleIndexAt(e.clientX - rect.left, rect.width - AXIS_W, count));
  };

  return (
    <div className="rsi-wrap">
      <span className="rsi-label">RSI 14</span>
      <canvas
        ref={ref}
        className="rsi"
        aria-label="RSI 14"
        onPointerMove={onMove}
        onPointerLeave={() => onHover(null)}
      />
    </div>
  );
}
