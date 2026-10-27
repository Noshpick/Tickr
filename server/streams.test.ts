import { parseKlinesRequest, parseStreamRequest, streamNameOf, streamsFor } from './streams';

const q = (s: string) => new URLSearchParams(s);

describe('parseStreamRequest', () => {
  it('разбирает стримы одного символа', () => {
    const r = parseStreamRequest(q('streams=btcusdt@trade/btcusdt@depth20@100ms'));
    expect(r?.symbol).toBe('BTCUSDT');
    expect([...r!.streams]).toEqual(['btcusdt@trade', 'btcusdt@depth20@100ms']);
  });

  it('отклоняет неизвестный символ, неизвестный канал и смесь символов', () => {
    expect(parseStreamRequest(q('streams=dogeusdt@trade'))).toBeNull();
    expect(parseStreamRequest(q('streams=btcusdt@bookTicker'))).toBeNull();
    expect(parseStreamRequest(q('streams=btcusdt@trade/ethusdt@trade'))).toBeNull();
    expect(parseStreamRequest(q(''))).toBeNull();
  });

  it('ограничивает число стримов', () => {
    const many = Array.from({ length: 9 }, () => 'btcusdt@trade').join('/');
    expect(parseStreamRequest(q(`streams=${many}`))).toBeNull();
  });
});

describe('streamNameOf', () => {
  it('достаёт имя стрима без полного JSON.parse', () => {
    expect(streamNameOf('{"stream":"btcusdt@trade","data":{"p":"1"}}')).toBe('btcusdt@trade');
    expect(streamNameOf('{"result":null,"id":1}')).toBeNull();
    expect(streamNameOf('мусор')).toBeNull();
  });
});

describe('streamsFor', () => {
  it('строит все каналы символа в нижнем регистре', () => {
    expect(streamsFor('ETHUSDT')).toEqual([
      'ethusdt@trade',
      'ethusdt@depth20@100ms',
      'ethusdt@kline_1m',
      'ethusdt@ticker',
    ]);
  });
});

describe('parseKlinesRequest', () => {
  it('принимает только разрешённые параметры', () => {
    expect(parseKlinesRequest(q('symbol=btcusdt&interval=1m&limit=120'))).toEqual({ symbol: 'BTCUSDT', limit: 120 });
    expect(parseKlinesRequest(q('symbol=BTCUSDT&interval=1m'))).toEqual({ symbol: 'BTCUSDT', limit: 120 });
    expect(parseKlinesRequest(q('symbol=BTCUSDT&interval=1h'))).toBeNull();
    expect(parseKlinesRequest(q('symbol=DOGEUSDT&interval=1m'))).toBeNull();
    expect(parseKlinesRequest(q('symbol=BTCUSDT&interval=1m&limit=9999'))).toBeNull();
    expect(parseKlinesRequest(q('symbol=BTCUSDT&interval=1m&limit=abc'))).toBeNull();
  });
});
