import { valueAt } from './series';

describe('valueAt', () => {
  it('сопоставляет ряды и свечи по правому краю', () => {
    const series = [1, 2, 3];
    expect(valueAt(series, 4, 5)).toBe(3);
    expect(valueAt(series, 2, 5)).toBe(1);
    expect(valueAt(series, 1, 5)).toBeNull();
    expect(valueAt(series, 0, 3)).toBe(1);
  });

  it('возвращает null без ряда и на прогреве', () => {
    expect(valueAt(undefined, 0, 1)).toBeNull();
    expect(valueAt([null, 5], 0, 2)).toBeNull();
  });
});
