import type { IndicatorSet, Series } from './types';

const empty = (length: number): Series => new Array<number | null>(length).fill(null);

export function sma(values: number[], period: number): Series {
  const out = empty(values.length);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i]!;
    if (i >= period) sum -= values[i - period]!;
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

export function ema(values: number[], period: number): Series {
  const out = empty(values.length);
  if (values.length < period) return out;

  const k = 2 / (period + 1);
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out[period - 1] = prev;
  for (let i = period; i < values.length; i++) {
    prev = values[i]! * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

export function bollinger(values: number[], period: number, multiplier: number): { upper: Series; lower: Series } {
  const upper = empty(values.length);
  const lower = empty(values.length);
  for (let i = period - 1; i < values.length; i++) {
    let mean = 0;
    for (let j = i - period + 1; j <= i; j++) mean += values[j]!;
    mean /= period;

    let variance = 0;
    for (let j = i - period + 1; j <= i; j++) variance += (values[j]! - mean) ** 2;
    const deviation = Math.sqrt(variance / period);

    upper[i] = mean + multiplier * deviation;
    lower[i] = mean - multiplier * deviation;
  }
  return { upper, lower };
}

const rsiFrom = (gain: number, loss: number): number => {
  if (loss === 0) return gain === 0 ? 50 : 100;
  return 100 - 100 / (1 + gain / loss);
};

export function rsi(values: number[], period: number): Series {
  const out = empty(values.length);
  if (values.length <= period) return out;

  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const change = values[i]! - values[i - 1]!;
    if (change > 0) gain += change;
    else loss -= change;
  }
  gain /= period;
  loss /= period;
  out[period] = rsiFrom(gain, loss);

  for (let i = period + 1; i < values.length; i++) {
    const change = values[i]! - values[i - 1]!;
    gain = (gain * (period - 1) + Math.max(change, 0)) / period;
    loss = (loss * (period - 1) + Math.max(-change, 0)) / period;
    out[i] = rsiFrom(gain, loss);
  }
  return out;
}

export function computeIndicators(closes: number[]): IndicatorSet {
  const { upper, lower } = bollinger(closes, 20, 2);
  return {
    sma20: sma(closes, 20),
    ema50: ema(closes, 50),
    bbUpper: upper,
    bbLower: lower,
    rsi14: rsi(closes, 14),
  };
}
