export interface SymbolInfo {
  id: string;
  base: string;
  quote: string;
  color: string;
}

export const SYMBOLS: SymbolInfo[] = [
  { id: 'BTCUSDT', base: 'BTC', quote: 'USDT', color: '#f7931a' },
  { id: 'ETHUSDT', base: 'ETH', quote: 'USDT', color: '#627eea' },
  { id: 'SOLUSDT', base: 'SOL', quote: 'USDT', color: '#9945ff' },
];

export const getSymbol = (id: string): SymbolInfo => SYMBOLS.find((s) => s.id === id) ?? SYMBOLS[0]!;
