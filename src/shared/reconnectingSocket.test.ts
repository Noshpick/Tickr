import { createReconnectingSocket, getBackoffDelay, type SocketStatus } from './reconnectingSocket';

class FakeSocket {
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  close = vi.fn(() => this.onclose?.());
}

describe('getBackoffDelay', () => {
  it('растёт экспоненциально и упирается в максимум', () => {
    expect(getBackoffDelay(0, 500, 15_000)).toBe(500);
    expect(getBackoffDelay(2, 500, 15_000)).toBe(2000);
    expect(getBackoffDelay(10, 500, 15_000)).toBe(15_000);
  });
});

describe('createReconnectingSocket', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('переподключается после обрыва и сбрасывает счётчик после open', () => {
    const sockets: FakeSocket[] = [];
    const statuses: SocketStatus[] = [];
    createReconnectingSocket({
      url: 'ws://x',
      onMessage: () => {},
      onStatus: (s) => statuses.push(s),
      createSocket: () => {
        const s = new FakeSocket();
        sockets.push(s);
        return s as unknown as WebSocket;
      },
    });

    sockets[0]!.onopen?.();
    sockets[0]!.onclose?.();
    expect(statuses).toEqual(['connecting', 'open', 'reconnecting']);

    vi.advanceTimersByTime(500);
    expect(sockets).toHaveLength(2);
  });

  it('close() не запускает переподключение', () => {
    const sockets: FakeSocket[] = [];
    const conn = createReconnectingSocket({
      url: 'ws://x',
      onMessage: () => {},
      onStatus: () => {},
      createSocket: () => {
        const s = new FakeSocket();
        sockets.push(s);
        return s as unknown as WebSocket;
      },
    });
    conn.close();
    vi.advanceTimersByTime(60_000);
    expect(sockets).toHaveLength(1);
  });
});
