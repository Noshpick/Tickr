const priceFormat = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const compactFormat = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 });

export const formatPrice = (value: number): string => priceFormat.format(value);

export const formatQty = (value: number): string => value.toFixed(4);

export const formatCompact = (value: number): string => compactFormat.format(value);

export const formatPercent = (value: number): string => `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;

export const formatTime = (ms: number): string => new Date(ms).toLocaleTimeString('ru-RU');

export const formatClock = (ms: number): string =>
  new Date(ms).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
