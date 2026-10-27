import { createContext, useContext, useEffect, useState } from 'react';
import { useStore } from '../../shared/createStore';
import { NAIVE } from '../../shared/perf';
import { createMarketFeed, type MarketFeed } from './marketFeed';
import type { MarketState } from './reducer';

export const FeedContext = createContext<MarketFeed | null>(null);

export function useFeed(): MarketFeed {
  const feed = useContext(FeedContext);
  if (!feed) throw new Error('useFeed должен вызываться внутри FeedProvider');
  return feed;
}

export function useCreateFeed(symbol: string): MarketFeed | null {
  const [feed, setFeed] = useState<MarketFeed | null>(null);

  useEffect(() => {
    const f = createMarketFeed(symbol);
    setFeed(f);
    return () => f.close();
  }, [symbol]);

  return feed;
}

const selectAll = (s: MarketState) => s;

export function useMarketSelector<S>(selector: (state: MarketState) => S): S {
  const { market } = useFeed();
  const value = useStore(market, NAIVE ? selectAll : (selector as (s: MarketState) => unknown));
  return NAIVE ? selector(value as MarketState) : (value as S);
}
