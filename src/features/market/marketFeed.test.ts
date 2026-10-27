import { buildStreamUrl } from './marketFeed';

describe('buildStreamUrl', () => {
  it('собирает combined-стрим из четырёх каналов в нижнем регистре', () => {
    expect(buildStreamUrl('BTCUSDT', 'wss://h')).toBe(
      'wss://h/stream?streams=btcusdt@trade/btcusdt@depth20@100ms/btcusdt@kline_1m/btcusdt@ticker',
    );
  });
});
