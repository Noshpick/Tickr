import { candleIndexAt, visibleWindow, xAt } from './chartLayout';

describe('visibleWindow', () => {
  it('показывает только столько свечей, чтобы каждая была не уже минимума', () => {
    expect(visibleWindow(300, 600)).toEqual({ start: 200, count: 100 });
    expect(visibleWindow(50, 600)).toEqual({ start: 0, count: 50 });
    expect(visibleWindow(0, 600)).toEqual({ start: 0, count: 1 });
  });

  it('не заходит в зону прогрева индикаторов, если истории достаточно', () => {
    expect(visibleWindow(300, 3000)).toEqual({ start: 50, count: 250 });
    expect(visibleWindow(100, 2000)).toEqual({ start: 50, count: 50 });
  });
});

describe('candleIndexAt', () => {
  it('обратен xAt для всех видимых свечей', () => {
    const total = 200;
    const plotW = 600;
    const { start } = visibleWindow(total, plotW);
    for (let i = start; i < total; i++) {
      expect(candleIndexAt(xAt(i, plotW, total), plotW, total)).toBe(i);
    }
  });

  it('возвращает null вне области графика и для скрытых свечей', () => {
    expect(candleIndexAt(-1, 600, 200)).toBeNull();
    expect(candleIndexAt(601, 600, 200)).toBeNull();
    expect(candleIndexAt(10, 600, 0)).toBeNull();
  });
});
