import { parseMessage } from './parse';

describe('parseMessage', () => {
  it('разбирает сделку', () => {
    const raw = JSON.stringify({
      stream: 'btcusdt@trade',
      data: { t: 1, p: '65000.10', q: '0.5', T: 1700000000000, m: true },
    });
    expect(parseMessage(raw)).toEqual({
      type: 'trade',
      trade: { id: 1, price: 65000.1, qty: 0.5, time: 1700000000000, isSell: true },
    });
  });

  it('разбирает стакан', () => {
    const raw = JSON.stringify({
      stream: 'btcusdt@depth20@100ms',
      data: { bids: [['100', '2']], asks: [['101', '3']] },
    });
    expect(parseMessage(raw)).toEqual({
      type: 'book',
      bids: [{ price: 100, qty: 2 }],
      asks: [{ price: 101, qty: 3 }],
    });
  });

  it('разбирает свечу', () => {
    const raw = JSON.stringify({
      stream: 'btcusdt@kline_1m',
      data: { k: { t: 60000, o: '1', h: '3', l: '0.5', c: '2' } },
    });
    expect(parseMessage(raw)).toEqual({
      type: 'candle',
      candle: { time: 60000, open: 1, high: 3, low: 0.5, close: 2 },
    });
  });

  it('разбирает статистику за 24ч', () => {
    const raw = JSON.stringify({
      stream: 'btcusdt@ticker',
      data: { P: '-1.25', h: '66000', l: '64000', q: '123456789.5' },
    });
    expect(parseMessage(raw)).toEqual({
      type: 'ticker',
      stats: { changePct: -1.25, high: 66000, low: 64000, volume: 123456789.5 },
    });
  });

  it('возвращает null на мусор и неизвестные стримы', () => {
    expect(parseMessage('not json')).toBeNull();
    expect(parseMessage('{"stream":"x@unknown","data":{}}')).toBeNull();
    expect(parseMessage('{}')).toBeNull();
  });
});
