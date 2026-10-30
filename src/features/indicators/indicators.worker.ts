import { computeIndicators } from './calc';
import type { WorkerRequest, WorkerResponse } from './types';

interface WorkerScope {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage: (message: WorkerResponse) => void;
}

const scope = self as unknown as WorkerScope;

scope.onmessage = (event) => {
  const start = performance.now();
  const result = computeIndicators(event.data.closes);
  scope.postMessage({ result, elapsedMs: performance.now() - start });
};
