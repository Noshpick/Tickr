import type { SocketStatus } from '../src/shared/reconnectingSocket';
import { streamNameOf } from './streams';

export interface Subscriber {
  streams: ReadonlySet<string>;
  send: (raw: string) => void;
  isBusy: () => boolean;
}

export interface Upstream {
  close: () => void;
}

export type UpstreamFactory = (
  symbol: string,
  onMessage: (raw: string) => void,
  onStatus: (status: SocketStatus) => void,
) => Upstream;

export interface HubOptions {
  connect: UpstreamFactory;
  idleMs?: number;
}

export interface RoomStats {
  symbol: string;
  clients: number;
  upstream: SocketStatus;
  cachedStreams: string[];
}

export interface HubStats {
  upstreamsOpened: number;
  messagesIn: number;
  messagesOut: number;
  replayed: number;
  dropped: number;
  rooms: RoomStats[];
}

export interface Hub {
  subscribe: (symbol: string, subscriber: Subscriber) => () => void;
  stats: () => HubStats;
  close: () => void;
}

interface Room {
  subscribers: Set<Subscriber>;
  latest: Map<string, string>;
  upstream: Upstream;
  status: SocketStatus;
  idleTimer: ReturnType<typeof setTimeout> | undefined;
}

export function createHub({ connect, idleMs = 10_000 }: HubOptions): Hub {
  const rooms = new Map<string, Room>();
  const counters = { upstreamsOpened: 0, messagesIn: 0, messagesOut: 0, replayed: 0, dropped: 0 };

  const closeRoom = (symbol: string) => {
    const room = rooms.get(symbol);
    if (!room) return;
    clearTimeout(room.idleTimer);
    room.upstream.close();
    rooms.delete(symbol);
  };

  const openRoom = (symbol: string): Room => {
    const room: Room = {
      subscribers: new Set(),
      latest: new Map(),
      status: 'connecting',
      idleTimer: undefined,
      upstream: { close: () => {} },
    };

    const onMessage = (raw: string) => {
      const stream = streamNameOf(raw);
      if (!stream) return;
      counters.messagesIn += 1;
      room.latest.set(stream, raw);
      for (const subscriber of room.subscribers) {
        if (!subscriber.streams.has(stream)) continue;
        if (subscriber.isBusy()) {
          counters.dropped += 1;
          continue;
        }
        subscriber.send(raw);
        counters.messagesOut += 1;
      }
    };

    counters.upstreamsOpened += 1;
    rooms.set(symbol, room);
    room.upstream = connect(symbol, onMessage, (status) => {
      room.status = status;
    });
    return room;
  };

  const subscribe = (symbol: string, subscriber: Subscriber) => {
    const room = rooms.get(symbol) ?? openRoom(symbol);
    clearTimeout(room.idleTimer);
    room.subscribers.add(subscriber);

    for (const [stream, raw] of room.latest) {
      if (!subscriber.streams.has(stream)) continue;
      subscriber.send(raw);
      counters.replayed += 1;
    }

    return () => {
      room.subscribers.delete(subscriber);
      if (room.subscribers.size === 0 && rooms.get(symbol) === room) {
        room.idleTimer = setTimeout(() => closeRoom(symbol), idleMs);
      }
    };
  };

  return {
    subscribe,
    stats: () => ({
      ...counters,
      rooms: [...rooms].map(([symbol, room]) => ({
        symbol,
        clients: room.subscribers.size,
        upstream: room.status,
        cachedStreams: [...room.latest.keys()],
      })),
    }),
    close: () => [...rooms.keys()].forEach(closeRoom),
  };
}
