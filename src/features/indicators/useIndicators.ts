import { useEffect, useState, useSyncExternalStore } from 'react';
import type { Store } from '../../shared/createStore';
import { NO_WORKER } from '../../shared/perf';
import type { MarketState } from '../market/reducer';
import { createIndicatorEngine, createInlineWorker, type IndicatorEngine } from './engine';
import type { IndicatorSet, WorkerLike } from './types';

const createWorker = (): WorkerLike => {
  if (NO_WORKER || typeof Worker === 'undefined') return createInlineWorker();
  return new Worker(new URL('./indicators.worker.ts', import.meta.url), { type: 'module' }) as unknown as WorkerLike;
};

const noSubscribe = () => () => {};
const noResult = (): IndicatorSet | null => null;

export function useIndicators(market: Store<MarketState>): { result: IndicatorSet | null } {
  const [engine, setEngine] = useState<IndicatorEngine | null>(null);

  useEffect(() => {
    const created = createIndicatorEngine(market, createWorker);
    setEngine(created);
    return () => created.close();
  }, [market]);

  const result = useSyncExternalStore(engine?.subscribe ?? noSubscribe, engine?.get ?? noResult);
  return { result };
}
