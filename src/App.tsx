import { useState } from 'react';
import { CandleChart } from './features/market/components/CandleChart';
import { ConnectionStatus } from './features/market/components/ConnectionStatus';
import { OrderBook } from './features/market/components/OrderBook';
import { SymbolTabs } from './features/market/components/SymbolTabs';
import { Ticker } from './features/market/components/Ticker';
import { TradeList } from './features/market/components/TradeList';
import { getSymbol, SYMBOLS } from './features/market/symbols';
import { FeedContext, useCreateFeed } from './features/market/useMarketFeed';

export function App() {
  const [symbolId, setSymbolId] = useState(SYMBOLS[0]!.id);
  const symbol = getSymbol(symbolId);
  const feed = useCreateFeed(symbolId);

  return (
    <div className="app">
      <header className="header">
        <SymbolTabs value={symbolId} onChange={setSymbolId} />
        {feed && (
          <FeedContext.Provider value={feed}>
            <ConnectionStatus />
          </FeedContext.Provider>
        )}
      </header>
      {feed && (
        <FeedContext.Provider value={feed}>
          <main>
            <Ticker symbol={symbol} />
            <div className="grid">
              <CandleChart />
              <OrderBook symbol={symbol} />
              <TradeList symbol={symbol} />
            </div>
          </main>
        </FeedContext.Provider>
      )}
      <footer className="footer">
        Демо-проект. Данные: публичное API Binance. Не является инвестиционной рекомендацией.
      </footer>
    </div>
  );
}
