import { memo } from 'react';
import { useStore } from '../../../shared/createStore';
import { formatPrice, formatQty } from '../format';
import type { SymbolInfo } from '../symbols';
import type { BookLevel } from '../types';
import { useFeed } from '../useMarketFeed';

const DEPTH = 10;

interface SideProps {
  levels: BookLevel[];
  side: 'bid' | 'ask';
  maxQty: number;
}

const Side = memo(function Side({ levels, side, maxQty }: SideProps) {
  if (levels.length === 0) {
    return (
      <ul className="book__side" aria-hidden>
        {Array.from({ length: DEPTH }, (_, i) => (
          <li key={i} className="book__row">
            <span className="skeleton skeleton--row" />
          </li>
        ))}
      </ul>
    );
  }
  return (
    <ul className={`book__side book__side--${side}`}>
      {levels.map((l) => (
        <li key={l.price} className="book__row">
          <span className="book__bar" style={{ width: `${(l.qty / maxQty) * 100}%` }} />
          <span className="book__price">{formatPrice(l.price)}</span>
          <span className="book__qty">{formatQty(l.qty)}</span>
        </li>
      ))}
    </ul>
  );
});

function Spread() {
  const { market } = useFeed();
  const price = useStore(market, (s) => s.lastPrice);
  const direction = useStore(market, (s) => s.direction);
  const bestBid = useStore(market, (s) => s.bids[0]?.price);
  const bestAsk = useStore(market, (s) => s.asks[0]?.price);
  const spread = bestBid !== undefined && bestAsk !== undefined ? bestAsk - bestBid : null;

  return (
    <div className="book__mid">
      <span className={`book__last book__last--${direction}`}>{price === null ? '—' : formatPrice(price)}</span>
      <span className="book__spread">{spread === null ? '' : `Спред ${spread.toFixed(2)}`}</span>
    </div>
  );
}

export function OrderBook({ symbol }: { symbol: SymbolInfo }) {
  const { market } = useFeed();
  const bids = useStore(market, (s) => s.bids);
  const asks = useStore(market, (s) => s.asks);

  const bidsView = bids.slice(0, DEPTH);

  const asksView = asks.slice(0, DEPTH).reverse();
  const maxQty = Math.max(1e-9, ...bidsView.map((l) => l.qty), ...asksView.map((l) => l.qty));

  return (
    <section className="panel">
      <h2 className="panel__title">Стакан</h2>
      <div className="cols">
        <span>Цена, {symbol.quote}</span>
        <span>Объём, {symbol.base}</span>
      </div>
      <Side levels={asksView} side="ask" maxQty={maxQty} />
      <Spread />
      <Side levels={bidsView} side="bid" maxQty={maxQty} />
    </section>
  );
}
