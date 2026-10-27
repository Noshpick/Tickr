# Tickr

English · [Русский](README.ru.md)

A real-time market dashboard: candlestick chart, order book and live trade tape on top of Binance public market data. Built to explore high-frequency UI: thousands of updates per minute with as few re-renders as possible.

## Features

- Live 1-minute candlestick chart with price and time axes, last-price marker and a crosshair with OHLC legend
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
| `npm test` | Run unit and component tests |
| `npm run typecheck` | Type-check the project |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Serve the production build |

### Configuration

Market data is read from the public Binance mirror `data-stream.binance.vision`, which stays reachable where `stream.binance.com` is blocked. Override the endpoints with environment variables:

```bash
VITE_WS_HOST=wss://stream.binance.com:9443 VITE_API_HOST=https://api.binance.com npm run dev
```

## Architecture

| Problem | Solution |
| --- | --- |
| Dozens of trades per second | Incoming events are buffered and applied as a single batch per animation frame (`marketFeed.ts`) |
| Connection drops | `createReconnectingSocket` with exponential backoff, reset after a successful `open` |
| Unnecessary re-renders | A tiny store built on `useSyncExternalStore` with selectors: a component updates only when its slice changes |
| Chart updating several times per second | The canvas is redrawn imperatively from a store subscription, bypassing React |
| Candles only arrive for the current minute | History is loaded via REST and merged with live candles, live data wins on conflicts |
| Malformed messages | `parseMessage` returns `null` instead of throwing, so the feed never crashes |
| Testability | Pure reducer, parser and chart math are separated from the UI |

## Project structure

```
src/
  shared/            createStore, reconnectingSocket
  features/market/
    parse.ts         stream message parser
    reducer.ts       pure state transitions
    marketFeed.ts    sockets, batching, history loading
    chartMath.ts     price range, scale and axis ticks
    components/      Ticker, CandleChart, OrderBook, TradeList, SymbolTabs
```

## Tech stack

React 19, TypeScript (strict), Vite, Vitest, Testing Library, GitLab CI.

## CI

`.gitlab-ci.yml` runs type checking and tests, then builds the app and stores `dist/` as an artifact.

## Roadmap

- [ ] Performance measurements (React Profiler, Lighthouse) with before/after numbers
- [ ] Node.js proxy for the WebSocket with a shared cache between clients
- [ ] Virtualized list and a Web Worker for heavy calculations
- [ ] End-to-end tests with Playwright

## Disclaimer

A demo project. Market data comes from Binance public APIs. Nothing here is investment advice.
