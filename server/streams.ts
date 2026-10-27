import { SYMBOLS } from '../src/features/market/symbols';

const ALLOWED_SYMBOLS = new Set(SYMBOLS.map((s) => s.id));
const ALLOWED_SUFFIXES = new Set(['trade', 'depth20@100ms', 'kline_1m', 'ticker']);
const MAX_STREAMS = 8;

export interface StreamRequest {
  symbol: string;
  streams: ReadonlySet<string>;
}

export const isAllowedSymbol = (symbol: string): boolean => ALLOWED_SYMBOLS.has(symbol);

export const streamsFor = (symbol: string): string[] =>
  [...ALLOWED_SUFFIXES].map((suffix) => `${symbol.toLowerCase()}@${suffix}`);

export function parseStreamRequest(params: URLSearchParams): StreamRequest | null {
  const raw = params.get('streams');
  if (!raw) return null;

  const names = raw.split('/');
  if (names.length > MAX_STREAMS) return null;

  let symbol: string | null = null;
  for (const name of names) {
    const [base, ...rest] = name.split('@');
    const suffix = rest.join('@');
    const upper = base?.toUpperCase();
    if (!upper || !ALLOWED_SYMBOLS.has(upper) || !ALLOWED_SUFFIXES.has(suffix)) return null;
    if (symbol !== null && symbol !== upper) return null;
    symbol = upper;
  }

  return symbol ? { symbol, streams: new Set(names) } : null;
}

const STREAM_PREFIX = /^\{"stream":"([^"]+)"/;

export function streamNameOf(raw: string): string | null {
  return STREAM_PREFIX.exec(raw)?.[1] ?? null;
}

export function parseKlinesRequest(params: URLSearchParams): { symbol: string; limit: number } | null {
  const symbol = params.get('symbol')?.toUpperCase() ?? '';
  if (!ALLOWED_SYMBOLS.has(symbol) || params.get('interval') !== '1m') return null;
  const limit = Number(params.get('limit') ?? 120);
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) return null;
  return { symbol, limit };
}
