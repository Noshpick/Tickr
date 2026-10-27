export interface TtlCacheOptions {
  ttlMs: number;
  now?: () => number;
}

export interface TtlCacheStats {
  hits: number;
  misses: number;
  coalesced: number;
  staleServed: number;
}

export interface TtlCache<T> {
  get: (key: string, load: () => Promise<T>) => Promise<T>;
  stats: () => TtlCacheStats;
}

export function createTtlCache<T>({ ttlMs, now = Date.now }: TtlCacheOptions): TtlCache<T> {
  const entries = new Map<string, { value: T; expires: number }>();
  const inflight = new Map<string, Promise<T>>();
  const counters: TtlCacheStats = { hits: 0, misses: 0, coalesced: 0, staleServed: 0 };

  const get = (key: string, load: () => Promise<T>): Promise<T> => {
    const entry = entries.get(key);
    if (entry && entry.expires > now()) {
      counters.hits += 1;
      return Promise.resolve(entry.value);
    }

    const pending = inflight.get(key);
    if (pending) {
      counters.coalesced += 1;
      return pending;
    }

    counters.misses += 1;
    const request = load()
      .then((value) => {
        entries.set(key, { value, expires: now() + ttlMs });
        return value;
      })
      .catch((error: unknown) => {
        if (!entry) throw error;
        counters.staleServed += 1;
        return entry.value;
      })
      .finally(() => inflight.delete(key));

    inflight.set(key, request);
    return request;
  };

  return { get, stats: () => ({ ...counters }) };
}
