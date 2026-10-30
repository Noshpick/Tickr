# Tickr

English · [Русский](README.ru.md)

A real-time market dashboard: candlestick chart, order book and live trade tape on top of Binance public market data. Built to explore high-frequency UI: thousands of updates per minute with as few re-renders as possible.

## Features

- Live 1-minute candlestick chart with price and time axes, last-price marker and a crosshair with OHLC legend
- SMA 20, EMA 50 and Bollinger Bands overlays, a separate RSI 14 pane and indicator values for the selected candle
- Indicator calculations in a Web Worker with automatic fallback to the main thread
- Order book with depth bars, best bid/ask spread and skeleton loading states
- Trade tape with highlighted new rows
- 24h statistics: change, high, low, volume
- BTC, ETH and SOL against USDT, switchable without a page reload
- Automatic reconnection with a visible connection status
- Responsive layout (desktop, tablet, phone), keyboard-accessible controls, `prefers-reduced-motion` support

## Getting started

Requires Node.js 20+.

```bash
npm install
npm run dev
```

Open http://localhost:5173.

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm test` | Run unit, component and proxy tests |
| `npm run typecheck` | Type-check the frontend and the proxy |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Serve the production build |
| `npm run server` | Start the Node.js proxy on :8787 |
| `npm run dev:proxy` | Start the frontend using the proxy |
| `npm run e2e` | Run Playwright end-to-end tests |

### Configuration

Market data is read from the public Binance mirror `data-stream.binance.vision`, which stays reachable where `stream.binance.com` is blocked. Override the endpoints with environment variables:

```bash
VITE_WS_HOST=wss://stream.binance.com:9443 VITE_API_HOST=https://api.binance.com npm run dev
```

## Node.js proxy

An optional proxy (`server/`) sits between the browser and Binance. It is a drop-in replacement: it speaks the same `/stream` WebSocket and `/api/v3/klines` REST shapes, so the frontend only needs two environment variables.

```bash
npm run server        # proxy on :8787
npm run dev:proxy     # frontend pointed at the proxy
```

What it does:

- **One upstream connection per symbol**, shared by every client. Connections open on the first subscriber and close 10 seconds after the last one leaves.
- **Snapshot replay**: the latest message of every stream is cached, so a new client gets the order book, ticker and candle immediately instead of waiting for the next update.
- **Shared REST cache**: kline history is cached for 5 seconds, concurrent requests are coalesced into one upstream call, and a stale value is served if Binance is unreachable.
- **Backpressure**: clients whose send buffer exceeds 1 MB are skipped instead of piling up memory.
- **Validation**: only known symbols and channels are accepted, at most 8 streams per connection, at most 1,000 clients.
- **Health**: ping/pong heartbeat drops dead sockets, `GET /health` returns hub and cache counters.

Configuration (environment variables): `PORT` (8787), `UPSTREAM_WS_HOST`, `UPSTREAM_API_HOST`, `KLINES_TTL_MS` (5000).

Observed on a live run with the browser UI plus four extra clients on BTCUSDT: 5 clients shared 1 upstream connection (`upstreamsOpened: 1`), and 2 concurrent kline requests produced 1 upstream request (`misses: 1, coalesced: 1`). The dev UI requests history twice because of StrictMode. Without the proxy this would be 5 upstream connections and 2 REST calls.

## End-to-end tests

Playwright tests run the whole stack locally: a fake Binance upstream (`e2e/fakeUpstream.ts`), the real Node.js proxy and the real frontend. Nothing touches the network, so the tests are deterministic and need no exchange access.

```bash
npx playwright install chromium   # once
npm run e2e
```

Covered scenarios:

- price, order book, trade tape and chart appear, with no page errors
- switching BTC, ETH and SOL changes the data and the page title
- the browser-to-proxy connection drops: the status shows reconnecting, then data resumes
- the proxy-to-exchange connection drops: the proxy reports `reconnecting`, the UI freezes without errors, and the stream recovers once the upstream is back
- two browser tabs share a single proxy room
- indicators can be enabled, receive values and render RSI without page errors
- indicators fall back to main-thread calculations when Web Worker is unavailable

The fake upstream exposes `/__control/block` and `/__control/unblock` to simulate an exchange outage. In CI the suite runs in the official Playwright image and stores the HTML report and traces as artifacts.

## Architecture

| Problem | Solution |
| --- | --- |
| Dozens of trades per second | Incoming events are buffered and applied as a single batch per animation frame (`marketFeed.ts`) |
| Connection drops | `createReconnectingSocket` with exponential backoff, reset after a successful `open` |
| Unnecessary re-renders | A tiny store built on `useSyncExternalStore` with selectors: a component updates only when its slice changes |
| Chart updating several times per second | The canvas is redrawn imperatively from a store subscription, bypassing React |
| Indicator calculations on a live stream | A Web Worker keeps only the latest state while busy, with a main-thread fallback when Worker is unavailable |
| Candles only arrive for the current minute | History is loaded via REST and merged with live candles, live data wins on conflicts |
| Malformed messages | `parseMessage` returns `null` instead of throwing, so the feed never crashes |
| Testability | Pure reducer, parser, indicators and chart math are separated from the UI |

## Project structure

```
src/
  shared/                 createStore, reconnectingSocket, performance measurements
  features/indicators/
    calc.ts               SMA, EMA, Bollinger Bands and RSI
    engine.ts             calculation queue and candle subscription
    indicators.worker.ts  Web Worker calculations
    useIndicators.ts      worker creation and React fallback
  features/market/
    parse.ts              stream message parser
    reducer.ts            pure state transitions
    marketFeed.ts         sockets, batching, history loading
    chartMath.ts          price range, scale and axis ticks
    chartLayout.ts        shared candle, indicator and crosshair geometry
    components/           Ticker, CandleChart, RsiPane, IndicatorChips, OrderBook, TradeList
server/
  hub.ts                  per-symbol upstream, fan-out, snapshot cache
  ttlCache.ts             TTL cache with request coalescing and stale-on-error
  streams.ts              request validation
  app.ts                  HTTP and WebSocket server
  index.ts                entrypoint
e2e/
  fakeUpstream.ts         fake Binance for deterministic tests
  dashboard.spec.ts       Playwright scenarios
```

## Tech stack

React 19, TypeScript (strict), Vite, Vitest, Testing Library, Node.js (`ws`), GitLab CI.

## CI

`.gitlab-ci.yml` runs type checking and unit tests, then the Playwright suite (report and traces as artifacts), then builds the app and stores `dist/` as an artifact.

## Performance

The measurements below predate the indicator integration and are kept as the original rendering baseline: production build (`npm run build && npm run preview`), BTCUSDT, 30 seconds after warm-up, in the same Chrome session. React commits are counted per component with a `useEffect` counter (`src/shared/perf.ts`), so StrictMode double-rendering does not skew the numbers.

`?naive=1` switches off the two main optimizations to get a baseline: events are applied one by one instead of one batch per animation frame, and every component subscribes to the whole state instead of a selector.

| Metric (30 s) | Naive | Optimized |
| --- | --- | --- |
| WebSocket messages | 3,834 | 3,925 |
| React commits, total | 19,170 | 1,007 |
| Commits per message | 5.00 | 0.26 |
| Ticker | 3,834 | 137 |
| OrderBook | 3,834 | 292 |
| TradeList | 3,834 | 196 |
| CandleChart | 3,834 | 15 |
| Long tasks (>50 ms) | 0 | 0 |

That is roughly 19x fewer React commits for the same stream. Long tasks were zero in both modes on this machine, so the difference shows up in wasted work rather than in visible jank; a slower device would be the place to look for it. This is a single 30-second run per mode, not a statistical benchmark.

To reproduce: open the preview, then run `__perf.reset()` in the console, wait, and run `__perf.snapshot()`. Add `?naive=1` to the URL for the baseline. The snapshot also includes `indicatorRuns` and `indicatorMs` for calculation count and total calculation time. Add `?noWorker=1` to force indicator calculations onto the main thread.

## Roadmap

- [x] Render and long-task measurements with before/after numbers
- [ ] Repeat comparative measurements after the indicator integration
- [ ] Lighthouse report for the production build
- [x] Node.js proxy with a shared upstream connection and cache between clients
- [x] Web Worker for indicators with a main-thread fallback
- [ ] Trade-list virtualization if the visible trade limit grows
- [x] End-to-end tests with Playwright

## Disclaimer

A demo project. Market data comes from Binance public APIs. Nothing here is investment advice.
