import type { IndicatorKey } from '../../indicators/types';

export const INDICATORS: { key: IndicatorKey; label: string; color: string }[] = [
  { key: 'sma', label: 'SMA 20', color: 'var(--ind-sma)' },
  { key: 'ema', label: 'EMA 50', color: 'var(--ind-ema)' },
  { key: 'bb', label: 'Bollinger', color: 'var(--ind-bb)' },
  { key: 'rsi', label: 'RSI 14', color: 'var(--ind-rsi)' },
];

interface Props {
  enabled: ReadonlySet<IndicatorKey>;
  values: Partial<Record<IndicatorKey, string>>;
  onToggle: (key: IndicatorKey) => void;
}

export function IndicatorChips({ enabled, values, onToggle }: Props) {
  return (
    <div className="chips" role="group" aria-label="Индикаторы">
      {INDICATORS.map(({ key, label, color }) => (
        <button
          key={key}
          type="button"
          className="chip"
          aria-pressed={enabled.has(key)}
          onClick={() => onToggle(key)}
        >
          <i className="chip__dot" style={{ background: color }} />
          {label}
          {enabled.has(key) && values[key] && <span className="chip__value">{values[key]}</span>}
        </button>
      ))}
    </div>
  );
}
