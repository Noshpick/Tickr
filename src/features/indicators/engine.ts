import type { Store } from '../../shared/createStore';
import { recordIndicatorRun } from '../../shared/perf';
import type { MarketState } from '../market/reducer';
import type { Candle } from '../market/types';
import { computeIndicators } from './calc';
import type { IndicatorSet, WorkerLike } from './types';

export interface IndicatorEngine {
  get: () => IndicatorSet | null;
  subscribe: (listener: () => void) => () => void;
  close: () => void;
}

export function createInlineWorker(): WorkerLike {
  const worker: WorkerLike = {
    onmessage: null,
    postMessage: ({ closes }) => {
      setTimeout(() => {
        const start = performance.now();
        const result = computeIndicators(closes);
        worker.onmessage?.({ data: { result, elapsedMs: performance.now() - start } });
      }, 0);
    },
    terminate: () => {
      worker.onmessage = null;
    },
  };
  return worker;
}

export function createIndicatorEngine(market: Store<MarketState>, createWorker: () => WorkerLike): IndicatorEngine {
  const worker = createWorker();
  const listeners = new Set<() => void>();

  let result: IndicatorSet | null = null;
  let busy = false;
  let dirty = false;
  let lastCandles: Candle[] | null = null;

  const post = () => {
    busy = true;
    dirty = false;
    worker.postMessage({ closes: market.getState().candles.map((c) => c.close) });
  };

  worker.onmessage = ({ data }) => {
    busy = false;
    result = data.result;
    recordIndicatorRun(data.elapsedMs);
    listeners.forEach((l) => l());
    if (dirty) post();
  };

  const onMarket = () => {
    const candles = market.getState().candles;
    if (candles === lastCandles || candles.length === 0) return;
    lastCandles = candles;
    if (busy) dirty = true;
    else post();
  };

  onMarket();
  const unsubscribe = market.subscribe(onMarket);

  return {
    get: () => result,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    close: () => {
      unsubscribe();
      worker.terminate();
      listeners.clear();
    },
  };
}
