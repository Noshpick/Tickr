# Tickr

[English](README.md) · Русский

Дашборд котировок в реальном времени: свечи, стакан и лента сделок поверх публичного WebSocket Binance.
Пет-проект под задачи уровня Т‑Инвестиций: высокочастотные данные, минимум лишних ререндеров.

## Запуск

```bash
npm install
npm run dev        # http://localhost:5173 (хост WS меняется через VITE_WS_HOST)
npm test           # unit + компонентные тесты
npm run build      # typecheck + продакшен-сборка
```

## Архитектурные решения

| Проблема | Решение |
| --- | --- |
| Сделки приходят десятки раз в секунду | События копятся и применяются одним батчем на `requestAnimationFrame` (`marketFeed.ts`) |
| Обрывы соединения | `createReconnectingSocket` с экспоненциальной задержкой, сброс при успешном `open` |
| Лишние ререндеры | Мини-стор на `useSyncExternalStore` с селекторами: компонент обновляется, только если изменился его срез |
| График на 120 свечей, обновление до 10 раз/с | Canvas рисуется императивно по подписке на стор, минуя React |
| Мусорные сообщения | `parseMessage` возвращает `null`, фид не падает |
| Тестируемость | Чистый редьюсер `reduceEvent`, парсер и математика графика отделены от UI |

## Структура

```
src/
  shared/            createStore, reconnectingSocket
  features/market/   parse, reducer, marketFeed, chartMath, components/
```

## Стек

React 19, TypeScript (strict), Vite, Vitest, Testing Library, GitLab CI (`.gitlab-ci.yml`).

## Дальше

- [ ] Замеры производительности (React Profiler, Lighthouse) и цифры «до/после» сюда
- [ ] Node.js-прокси для WebSocket с общим кэшем между клиентами
- [ ] Virtualized-список для большой ленты, Web Worker для расчётов
- [ ] e2e на Playwright
