export type Series = (number | null)[];

export interface IndicatorSet {
  sma20: Series;
  ema50: Series;
  bbUpper: Series;
  bbLower: Series;
  rsi14: Series;
}

export type IndicatorKey = 'sma' | 'ema' | 'bb' | 'rsi';

export interface WorkerRequest {
  closes: number[];
}

export interface WorkerResponse {
  result: IndicatorSet;
  elapsedMs: number;
}

export interface WorkerLike {
  postMessage: (request: WorkerRequest) => void;
  onmessage: ((event: { data: WorkerResponse }) => void) | null;
  terminate: () => void;
}
