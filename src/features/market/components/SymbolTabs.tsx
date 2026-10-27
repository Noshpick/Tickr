import { SYMBOLS } from '../symbols';

interface Props {
  value: string;
  onChange: (id: string) => void;
}

export function SymbolTabs({ value, onChange }: Props) {
  return (
    <div className="tabs" role="group" aria-label="Инструмент">
      {SYMBOLS.map((s) => (
        <button
          key={s.id}
          type="button"
          className="tabs__item"
          aria-pressed={s.id === value}
          onClick={() => onChange(s.id)}
        >
          <span className="coin" style={{ background: s.color }}>
            {s.base[0]}
          </span>
          {s.base}
          <span className="tabs__quote">/{s.quote}</span>
        </button>
      ))}
    </div>
  );
}
