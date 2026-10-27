import { useRenderCount } from '../../../shared/perf';
import { formatPrice, formatQty, formatTime } from '../format';
import type { SymbolInfo } from '../symbols';
import { useMarketSelector } from '../useMarketFeed';

export function TradeList({ symbol }: { symbol: SymbolInfo }) {
  useRenderCount('TradeList');
  const trades = useMarketSelector((s) => s.trades);

  return (
    <section className="panel">
      <h2 className="panel__title">Последние сделки</h2>
      <div className="cols cols--3">
        <span>Цена</span>
        <span>{symbol.base}</span>
        <span>Время</span>
      </div>
      {trades.length === 0 ? (
        <p className="empty">Ждём первые сделки…</p>
      ) : (
        <ul className="trades">
          {trades.map((t) => (
            <li key={t.id} className={`trades__row trades__row--${t.isSell ? 'sell' : 'buy'}`}>
              <span>{formatPrice(t.price)}</span>
              <span>{formatQty(t.qty)}</span>
              <span>{formatTime(t.time)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
