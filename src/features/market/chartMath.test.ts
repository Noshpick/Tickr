import { getPriceRange, getTicks, priceToY } from './chartMath';

const c = (low: number, high: number) => ({ time: 0, open: low, high, low, close: high });

describe('chartMath', () => {
  it('возвращает null для пустого набора', () => {
    expect(getPriceRange([])).toBeNull();
  });

  it('диапазон шире экстремумов свечей', () => {
    const range = getPriceRange([c(10, 20), c(5, 15)])!;
    expect(range.min).toBeLessThan(5);
    expect(range.max).toBeGreaterThan(20);
  });

  it('priceToY: большая цена выше на экране', () => {
    const range = { min: 0, max: 100 };
    expect(priceToY(100, range, 200)).toBe(0);
    expect(priceToY(0, range, 200)).toBe(200);
    expect(priceToY(50, range, 200)).toBe(100);
  });

  it('getTicks даёт круглые значения внутри диапазона', () => {
    expect(getTicks({ min: 0, max: 100 }, 5)).toEqual([0, 20, 40, 60, 80, 100]);
    const t = getTicks({ min: 80_301.3, max: 80_330.9 });
    t.forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(80_301.3);
      expect(v).toBeLessThanOrEqual(80_330.9);
    });
  });
});
