import { createHub, type Subscriber, type UpstreamFactory } from './hub';

const msg = (stream: string, n = 1) => JSON.stringify({ stream, data: { n } });

function setup(idleMs = 1000) {
  const close = vi.fn();
  let emit: (raw: string) => void = () => {};
  const connect = vi.fn<UpstreamFactory>((_symbol, onMessage) => {
    emit = onMessage;
    return { close };
  });
  const hub = createHub({ connect, idleMs });
  const sub = (streams: string[], busy = false) => {
    const sent: string[] = [];
    const subscriber: Subscriber = { streams: new Set(streams), send: (r) => sent.push(r), isBusy: () => busy };
    return { subscriber, sent };
  };
  return { hub, connect, close, emit: (raw: string) => emit(raw), sub };
}

describe('hub', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('держит одно upstream-соединение на символ для любого числа клиентов', () => {
    const { hub, connect, sub } = setup();
    hub.subscribe('BTCUSDT', sub(['btcusdt@trade']).subscriber);
    hub.subscribe('BTCUSDT', sub(['btcusdt@trade']).subscriber);
    hub.subscribe('BTCUSDT', sub(['btcusdt@ticker']).subscriber);
    expect(connect).toHaveBeenCalledTimes(1);

    hub.subscribe('ETHUSDT', sub(['ethusdt@trade']).subscriber);
    expect(connect).toHaveBeenCalledTimes(2);
  });

  it('раздаёт сообщения только подписанным на этот стрим', () => {
    const { hub, emit, sub } = setup();
    const a = sub(['btcusdt@trade']);
    const b = sub(['btcusdt@ticker']);
    hub.subscribe('BTCUSDT', a.subscriber);
    hub.subscribe('BTCUSDT', b.subscriber);

    emit(msg('btcusdt@trade'));
    expect(a.sent).toHaveLength(1);
    expect(b.sent).toHaveLength(0);
  });

  it('новому клиенту сразу отдаёт последние значения из кэша', () => {
    const { hub, emit, sub } = setup();
    hub.subscribe('BTCUSDT', sub(['btcusdt@trade']).subscriber);
    emit(msg('btcusdt@trade', 1));
    emit(msg('btcusdt@trade', 2));
    emit(msg('btcusdt@ticker', 3));

    const late = sub(['btcusdt@trade', 'btcusdt@ticker']);
    hub.subscribe('BTCUSDT', late.subscriber);
    expect(late.sent).toEqual([msg('btcusdt@trade', 2), msg('btcusdt@ticker', 3)]);
    expect(hub.stats().replayed).toBe(2);
  });

  it('не шлёт сообщения клиентам с переполненным буфером', () => {
    const { hub, emit, sub } = setup();
    const slow = sub(['btcusdt@trade'], true);
    const fast = sub(['btcusdt@trade']);
    hub.subscribe('BTCUSDT', slow.subscriber);
    hub.subscribe('BTCUSDT', fast.subscriber);

    emit(msg('btcusdt@trade'));
    expect(slow.sent).toHaveLength(0);
    expect(fast.sent).toHaveLength(1);
    expect(hub.stats().dropped).toBe(1);
  });

  it('закрывает upstream после простоя, но не если клиент вернулся', () => {
    const { hub, close, connect, sub } = setup(1000);
    const off = hub.subscribe('BTCUSDT', sub(['btcusdt@trade']).subscriber);
    off();
    vi.advanceTimersByTime(500);
    hub.subscribe('BTCUSDT', sub(['btcusdt@trade']).subscriber);
    vi.advanceTimersByTime(5000);
    expect(close).not.toHaveBeenCalled();
    expect(connect).toHaveBeenCalledTimes(1);
    expect(hub.stats().rooms).toHaveLength(1);
  });

  it('закрывает upstream, когда клиентов не осталось', () => {
    const { hub, close, sub } = setup(1000);
    const off = hub.subscribe('BTCUSDT', sub(['btcusdt@trade']).subscriber);
    off();
    vi.advanceTimersByTime(1001);
    expect(close).toHaveBeenCalledTimes(1);
    expect(hub.stats().rooms).toHaveLength(0);
  });

  it('игнорирует сообщения, из которых нельзя достать имя стрима', () => {
    const { hub, emit, sub } = setup();
    const a = sub(['btcusdt@trade']);
    hub.subscribe('BTCUSDT', a.subscriber);
    emit('мусор');
    expect(a.sent).toHaveLength(0);
    expect(hub.stats().messagesIn).toBe(0);
  });
});
