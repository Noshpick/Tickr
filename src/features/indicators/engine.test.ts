import { createStore } from '../../shared/createStore';
import { initialMarketState, type MarketState } from '../market/reducer';
import type { Candle } from '../market/types';
import { createIndicatorEngine } from './engine';
import type { WorkerLike, WorkerRequest } from './types';
import { computeIndicators } from './calc';

const candle = (i: number, close: number): Candle => ({ time: i * 60_000, open: close, high: close, low: close, close });
const withCandles = (candles: Candle[]) => (s: MarketState): MarketState => ({ ...s, candles });

function setup() {
  const requests: WorkerRequest[] = [];
  const worker: WorkerLike = {
    onmessage: null,
    postMessage: (r) => requests.push(r),
    terminate: vi.fn(),
  };
  const market = createStore<MarketState>(initialMarketState);
  const engine = createIndicatorEngine(market, () => worker);
  const respond = (index: number) => {
    const closes = requests[index]!.closes;
    worker.onmessage?.({ data: { result: computeIndicators(closes), elapsedMs: 1 } });
  };
  return { market, engine, requests, respond, worker };
}

describe('indicator engine', () => {
  it('не обращается к воркеру, пока нет свечей', () => {
    const { requests } = setup();
    expect(requests).toHaveLength(0);
  });

  it('отправляет цены закрытия и отдаёт результат подписчикам', () => {
    const { market, engine, requests, respond } = setup();
    const listener = vi.fn();
    engine.subscribe(listener);

    market.setState(withCandles(Array.from({ length: 30 }, (_, i) => candle(i, 100 + i))));
    expect(requests).toHaveLength(1);
    expect(requests[0]!.closes).toHaveLength(30);

    respond(0);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(engine.get()?.sma20[29]).toBeCloseTo(119.5, 10);
  });

  it('пока воркер занят, копит обновления и отправляет только последнее', () => {
    const { market, requests, respond } = setup();
    const base = Array.from({ length: 30 }, (_, i) => candle(i, 100));

    market.setState(withCandles(base));
    market.setState(withCandles([...base, candle(30, 101)]));
    market.setState(withCandles([...base, candle(30, 102)]));
    market.setState(withCandles([...base, candle(30, 103)]));
    expect(requests).toHaveLength(1);

    respond(0);
    expect(requests).toHaveLength(2);
    expect(requests[1]!.closes.at(-1)).toBe(103);
  });

  it('игнорирует обновления стора, в которых свечи не менялись', () => {
    const { market, requests, respond } = setup();
    market.setState(withCandles([candle(0, 1)]));
    respond(0);
    market.setState((s) => ({ ...s, lastPrice: 5 }));
    expect(requests).toHaveLength(1);
  });

  it('close() останавливает воркер и отписывается от стора', () => {
    const { market, engine, requests, worker } = setup();
    engine.close();
    market.setState(withCandles([candle(0, 1)]));
    expect(worker.terminate).toHaveBeenCalled();
    expect(requests).toHaveLength(0);
  });
});
