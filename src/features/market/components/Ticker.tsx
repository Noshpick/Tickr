import { useEffect } from 'react';
import { useStore } from '../../../shared/createStore';
import { formatCompact, formatPercent, formatPrice } from '../format';
import type { SymbolInfo } from '../symbols';
import { useFeed } from '../useMarketFeed';

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <span className="stat__label">{label}</span>
      <span className="stat__value">{value}</span>
    </div>
  );
}

export function Ticker({ symbol }: { symbol: SymbolInfo }) {
  const { market } = useFeed();
  const price = useStore(market, (s) => s.lastPrice);
  const direction = useStore(market, (s) => s.direction);
  const stats = useStore(market, (s) => s.stats);

  useEffect(() => {
    document.title = price === null ? 'Tickr' : `${formatPrice(price)} · ${symbol.base}/${symbol.quote}`;
  }, [price, symbol]);

  const tone = stats ? (stats.changePct >= 0 ? 'up' : 'down') : 'flat';

  return (
    <section className="ticker" aria-label={`Котировка ${symbol.base}/${symbol.quote}`}>
      <div className="ticker__main">
        <span className={`ticker__price ticker__price--${direction}`} data-testid="price">
          {price === null ? <span className="skeleton skeleton--price" /> : formatPrice(price)}
        </span>
        {stats && <span className={`badge badge--${tone}`}>{formatPercent(stats.changePct)} за 24ч</span>}
      </div>
      <div className="ticker__stats">
        <Stat label="Максимум 24ч" value={stats ? formatPrice(stats.high) : '—'} />
        <Stat label="Минимум 24ч" value={stats ? formatPrice(stats.low) : '—'} />
        <Stat label={`Объём 24ч, ${symbol.quote}`} value={stats ? formatCompact(stats.volume) : '—'} />
      </div>
    </section>
  );
}
