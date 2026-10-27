import { createContext, useContext, useEffect, useState } from 'react';
import { createMarketFeed, type MarketFeed } from './marketFeed';

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
