import { formatCompact, formatPercent, formatPrice, formatQty } from './format';

describe('format', () => {
  it('форматирует цену с разделителями и двумя знаками', () => {
    expect(formatPrice(65000.1)).toBe('65,000.10');
  });
  it('форматирует количество с четырьмя знаками', () => {
    expect(formatQty(0.5)).toBe('0.5000');
  });
  it('сокращает большие объёмы', () => {
    expect(formatCompact(1_234_000)).toBe('1.23M');
  });
  it('показывает знак у процентов', () => {
    expect(formatPercent(1.256)).toBe('+1.26%');
    expect(formatPercent(-0.5)).toBe('-0.50%');
    expect(formatPercent(0)).toBe('0.00%');
  });
});
