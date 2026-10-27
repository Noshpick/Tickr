import { act, render, screen } from '@testing-library/react';
import { Ticker } from './features/market/components/Ticker';
import { getSymbol } from './features/market/symbols';
import { createMarketFeed } from './features/market/marketFeed';
import { FeedContext } from './features/market/useMarketFeed';

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  constructor(public url: string) {
    FakeWebSocket.instances.push(this);
  }
  close() {}
}

describe('Ticker + фид', () => {
  beforeEach(() => {
    FakeWebSocket.instances = [];
    vi.stubGlobal('WebSocket', FakeWebSocket);
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0));
    vi.stubGlobal('fetch', () => new Promise(() => {}));
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('показывает цену после сообщения из сокета', async () => {
    const feed = createMarketFeed('BTCUSDT');
    render(
      <FeedContext.Provider value={feed}>
        <Ticker symbol={getSymbol('BTCUSDT')} />
      </FeedContext.Provider>,
    );
    expect(screen.getByTestId('price')).toBeInTheDocument();

    await act(async () => {
      FakeWebSocket.instances[0]!.onmessage?.({
        data: JSON.stringify({
          stream: 'btcusdt@trade',
          data: { t: 1, p: '65000.10', q: '1', T: 1, m: false },
        }),
      });
      await new Promise((r) => setTimeout(r, 5));
    });

    expect(screen.getByTestId('price')).toHaveTextContent('65,000.10');
    feed.close();
  });
});
