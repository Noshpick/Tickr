export type SocketStatus = 'connecting' | 'open' | 'reconnecting' | 'closed';

export interface ReconnectingSocketOptions {
  url: string;
  onMessage: (data: string) => void;
  onStatus: (status: SocketStatus) => void;
  baseDelayMs?: number;
  maxDelayMs?: number;
  createSocket?: (url: string) => WebSocket;
}

export interface ReconnectingSocket {
  close: () => void;
}

export function getBackoffDelay(attempt: number, base: number, max: number): number {
  return Math.min(base * 2 ** attempt, max);
}

export function createReconnectingSocket(opts: ReconnectingSocketOptions): ReconnectingSocket {
  const {
    url,
    onMessage,
    onStatus,
    baseDelayMs = 500,
    maxDelayMs = 15_000,
    createSocket = (u) => new WebSocket(u),
  } = opts;

  let socket: WebSocket | null = null;
  let attempt = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;

  const connect = () => {
    onStatus(attempt === 0 ? 'connecting' : 'reconnecting');
    socket = createSocket(url);

    socket.onopen = () => {
      attempt = 0;
      onStatus('open');
    };
    socket.onmessage = (e) => onMessage(String(e.data));
    socket.onclose = () => {
      if (disposed) return;
      onStatus('reconnecting');
      timer = setTimeout(connect, getBackoffDelay(attempt++, baseDelayMs, maxDelayMs));
    };
    socket.onerror = () => socket?.close();
  };

  connect();

  return {
    close: () => {
      disposed = true;
      clearTimeout(timer);
      socket?.close();
      onStatus('closed');
    },
  };
}
