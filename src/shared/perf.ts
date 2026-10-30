import { useEffect } from 'react';

export const NAIVE = typeof location !== 'undefined' && new URLSearchParams(location.search).has('naive');
export const NO_WORKER = typeof location !== 'undefined' && new URLSearchParams(location.search).has('noWorker');

const commits: Record<string, number> = {};
let messages = 0;
let longTasks = 0;
let longTaskMs = 0;
let indicatorRuns = 0;
let indicatorMs = 0;

export const countMessage = () => {
  messages += 1;
};

export const recordIndicatorRun = (elapsedMs: number) => {
  indicatorRuns += 1;
  indicatorMs += elapsedMs;
};

export function useRenderCount(name: string) {
  useEffect(() => {
    commits[name] = (commits[name] ?? 0) + 1;
  });
}

const snapshot = () => ({
  mode: NAIVE ? 'naive' : 'optimized',
  messages,
  commits: { ...commits },
  totalCommits: Object.values(commits).reduce((a, b) => a + b, 0),
  longTasks,
  longTaskMs: Math.round(longTaskMs),
  indicatorRuns,
  indicatorMs: Math.round(indicatorMs),
});

const reset = () => {
  messages = 0;
  longTasks = 0;
  longTaskMs = 0;
  indicatorRuns = 0;
  indicatorMs = 0;
  Object.keys(commits).forEach((k) => delete commits[k]);
};

export function installPerf() {
  (window as unknown as { __perf: unknown }).__perf = { snapshot, reset };
  if (typeof PerformanceObserver === 'undefined') return;
  try {
    new PerformanceObserver((list) => {
      list.getEntries().forEach((e) => {
        longTasks += 1;
        longTaskMs += e.duration;
      });
    }).observe({ type: 'longtask', buffered: true });
  } catch {
    return;
  }
}
