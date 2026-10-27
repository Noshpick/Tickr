import { initialMarketState, MAX_TRADES, reduceEvent, reduceEvents } from './reducer';
import type { Trade } from './types';

const trade = (id: number, price: number): Trade => ({ id, price, qty: 1, time: id, isSell: false });

describe('reduceEvent', () => {
  it('определяет направление цены по последней сделке', () => {
    let s = reduceEvent(initialMarketState, { type: 'trade', trade: trade(1, 100) });
    expect(s.direction).toBe(0);
    s = reduceEvent(s, { type: 'trade', trade: trade(2, 101) });
    expect(s.direction).toBe(1);
    s = reduceEvent(s, { type: 'trade', trade: trade(3, 99) });
    expect(s.direction).toBe(-1);
    s = reduceEvent(s, { type: 'trade', trade: trade(4, 99) });
    expect(s.direction).toBe(-1);
  });

  it('ограничивает ленту сделок', () => {
    const events = Array.from({ length: MAX_TRADES + 10 }, (_, i) => ({
      type: 'trade' as const,
      trade: trade(i, 100),
    }));
    const s = reduceEvents(initialMarketState, events);
    expect(s.trades).toHaveLength(MAX_TRADES);
    expect(s.trades[0]?.id).toBe(MAX_TRADES + 9);
  });

  it('обновляет текущую свечу и добавляет новую', () => {
    const c = (time: number, close: number) => ({ time, open: 1, high: 2, low: 0, close });
    let s = reduceEvent(initialMarketState, { type: 'candle', candle: c(0, 1) });
    s = reduceEvent(s, { type: 'candle', candle: c(0, 5) });
    expect(s.candles).toEqual([c(0, 5)]);
    s = reduceEvent(s, { type: 'candle', candle: c(60000, 7) });
    expect(s.candles).toHaveLength(2);
  });

  it('не мутирует исходное состояние', () => {
    const before = initialMarketState;
    reduceEvent(before, { type: 'trade', trade: trade(1, 1) });
    expect(before.trades).toHaveLength(0);
  });
});

describe('history', () => {
  const c = (time: number, close: number) => ({ time, open: 1, high: 2, low: 0, close });

  it('склеивает историю с live-свечой, live приоритетнее', () => {
    let s = reduceEvent(initialMarketState, { type: 'candle', candle: c(120, 9) });
    s = reduceEvent(s, { type: 'history', candles: [c(0, 1), c(60, 2), c(120, 3)] });
    expect(s.candles.map((x) => [x.time, x.close])).toEqual([
      [0, 1],
      [60, 2],
      [120, 9],
    ]);
  });
});
