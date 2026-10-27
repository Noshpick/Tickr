import { createTtlCache } from './ttlCache';

describe('createTtlCache', () => {
  it('отдаёт значение из кэша до истечения TTL', async () => {
    let now = 0;
    const cache = createTtlCache<string>({ ttlMs: 1000, now: () => now });
    const load = vi.fn().mockResolvedValue('a');

    await cache.get('k', load);
    now = 999;
    await cache.get('k', load);
    expect(load).toHaveBeenCalledTimes(1);

    now = 1001;
    await cache.get('k', load);
    expect(load).toHaveBeenCalledTimes(2);
    expect(cache.stats()).toMatchObject({ hits: 1, misses: 2 });
  });

  it('склеивает параллельные запросы в один', async () => {
    const cache = createTtlCache<string>({ ttlMs: 1000 });
    let resolve!: (v: string) => void;
    const load = vi.fn(() => new Promise<string>((r) => (resolve = r)));

    const all = Promise.all([cache.get('k', load), cache.get('k', load), cache.get('k', load)]);
    resolve('x');

    expect(await all).toEqual(['x', 'x', 'x']);
    expect(load).toHaveBeenCalledTimes(1);
    expect(cache.stats().coalesced).toBe(2);
  });

  it('при ошибке отдаёт устаревшее значение, а без него пробрасывает ошибку', async () => {
    let now = 0;
    const cache = createTtlCache<string>({ ttlMs: 10, now: () => now });

    await expect(cache.get('k', () => Promise.reject(new Error('down')))).rejects.toThrow('down');

    await cache.get('k', () => Promise.resolve('old'));
    now = 100;
    expect(await cache.get('k', () => Promise.reject(new Error('down')))).toBe('old');
    expect(cache.stats().staleServed).toBe(1);
  });

  it('после ошибки не залипает на «висящем» запросе', async () => {
    const cache = createTtlCache<string>({ ttlMs: 10 });
    await expect(cache.get('k', () => Promise.reject(new Error('1')))).rejects.toThrow();
    expect(await cache.get('k', () => Promise.resolve('ok'))).toBe('ok');
  });
});
