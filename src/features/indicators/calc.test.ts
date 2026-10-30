import { bollinger, computeIndicators, ema, rsi, sma } from './calc';

describe('sma', () => {
  it('считает скользящее среднее с прогревом из null', () => {
    expect(sma([1, 2, 3, 4, 5], 3)).toEqual([null, null, 2, 3, 4]);
  });

  it('возвращает только null, если данных меньше периода', () => {
    expect(sma([1, 2], 3)).toEqual([null, null]);
  });
});

describe('ema', () => {
  it('стартует с SMA и дальше сглаживает', () => {
    expect(ema([1, 2, 3, 4, 5], 3)).toEqual([null, null, 2, 3, 4]);
  });

  it('сильнее реагирует на последнее значение, чем SMA', () => {
    const values = [10, 10, 10, 10, 20];
    expect(ema(values, 3)[4]!).toBeGreaterThan(sma(values, 3)[4]! - 1e-9);
  });
});

describe('bollinger', () => {
  it('на постоянном ряду полосы совпадают со средним', () => {
    const { upper, lower } = bollinger([5, 5, 5, 5], 3, 2);
    expect(upper).toEqual([null, null, 5, 5]);
    expect(lower).toEqual([null, null, 5, 5]);
  });

  it('использует популяционное стандартное отклонение', () => {
    const { upper, lower } = bollinger([1, 2, 3], 3, 2);
    expect(upper[2]).toBeCloseTo(2 + 2 * Math.sqrt(2 / 3), 10);
    expect(lower[2]).toBeCloseTo(2 - 2 * Math.sqrt(2 / 3), 10);
  });
});

describe('rsi', () => {
  const closes = [
    44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.1, 45.42, 45.84, 46.08, 45.89, 46.03, 45.61, 46.28, 46.28, 46.0,
    46.03, 46.41, 46.22, 45.64,
  ];

  it('совпадает с независимым расчётом по методу Уайлдера', () => {
    const out = rsi(closes, 14);
    expect(out.slice(0, 14).every((v) => v === null)).toBe(true);
    [70.46, 66.25, 66.48, 69.35, 66.29, 57.92].forEach((expected, i) => {
      expect(out[14 + i]!).toBeCloseTo(expected, 1);
    });
  });

  it('укладывается в допуск 0.2 от таблицы StockCharts, где промежуточные значения округлены', () => {
    const out = rsi(closes, 14);
    [70.53, 66.32, 66.55, 69.41, 66.36, 57.97].forEach((expected, i) => {
      expect(Math.abs(out[14 + i]! - expected)).toBeLessThan(0.2);
    });
  });

  it('на растущем ряду равен 100, на плоском 50', () => {
    expect(rsi(Array.from({ length: 20 }, (_, i) => i), 14)[19]).toBe(100);
    expect(rsi(new Array<number>(20).fill(7), 14)[19]).toBe(50);
  });
});

describe('computeIndicators', () => {
  it('возвращает ряды той же длины, что и вход', () => {
    const closes = Array.from({ length: 80 }, (_, i) => 100 + Math.sin(i / 5) * 10);
    const set = computeIndicators(closes);
    Object.values(set).forEach((series) => expect(series).toHaveLength(80));
    expect(set.ema50[48]).toBeNull();
    expect(set.ema50[49]).not.toBeNull();
    expect(set.rsi14[13]).toBeNull();
    expect(set.rsi14[14]).not.toBeNull();
  });
});
