import { expect, test, type APIRequestContext, type Page, type WebSocketRoute } from '@playwright/test';
import { PORTS } from '../playwright.config';

const UPSTREAM = `http://localhost:${PORTS.upstream}`;
const PROXY = `http://localhost:${PORTS.proxy}`;

const PRICE = {
  BTC: /^65,\d{3}\.\d{2}$/,
  ETH: /^3,2\d{2}\.\d{2}$/,
  SOL: /^1[5-9]\d\.\d{2}$/,
};

const price = (page: Page) => page.getByTestId('price');
const status = (page: Page) => page.getByRole('status');

async function readPrice(page: Page): Promise<string> {
  return (await price(page).textContent()) ?? '';
}

async function settledPrice(page: Page): Promise<string> {
  let last = await readPrice(page);
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(400);
    const current = await readPrice(page);
    if (current === last) return current;
    last = current;
  }
  throw new Error('цена не успокоилась');
}

async function expectPriceMoving(page: Page) {
  const before = await readPrice(page);
  await expect.poll(() => readPrice(page), { timeout: 10_000 }).not.toBe(before);
}

interface Health {
  hub: { rooms: { symbol: string; clients: number; upstream: string }[] };
}

const proxyHealth = async (request: APIRequestContext): Promise<Health> =>
  (await request.get(`${PROXY}/health`)).json();

test.afterEach(async ({ request }) => {
  await request.get(`${UPSTREAM}/__control/unblock`);
});

test('цена, стакан, лента и график появляются без ошибок на странице', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/');

  await expect(status(page)).toContainText('Онлайн');
  await expect(price(page)).toHaveText(PRICE.BTC);
  await expect(page.locator('.book__side--ask .book__row')).toHaveCount(10);
  await expect(page.locator('.book__side--bid .book__row')).toHaveCount(10);
  await expect(page.locator('.trades__row').first()).toBeVisible();
  await expect(page.getByText('Максимум 24ч')).toBeVisible();
  await expect(page.getByLabel('График свечей')).toBeVisible();
  await expect(page.locator('.chart-loading')).toHaveCount(0);
  await expectPriceMoving(page);

  expect(errors).toEqual([]);
});

test('переключение символа меняет данные и заголовок страницы', async ({ page }) => {
  await page.goto('/');
  await expect(price(page)).toHaveText(PRICE.BTC);

  await page.getByRole('button', { name: /ETH/ }).click();
  await expect(page.getByRole('button', { name: /ETH/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(price(page)).toHaveText(PRICE.ETH);
  await expect(page).toHaveTitle(/ETH\/USDT/);

  await page.getByRole('button', { name: /SOL/ }).click();
  await expect(price(page)).toHaveText(PRICE.SOL);

  await page.getByRole('button', { name: /BTC/ }).click();
  await expect(price(page)).toHaveText(PRICE.BTC);
  await expectPriceMoving(page);
});

test('обрыв соединения браузера с прокси: статус меняется и данные возвращаются', async ({ page }) => {
  let route: WebSocketRoute | undefined;
  await page.routeWebSocket(/\/stream\?/, (ws) => {
    ws.connectToServer();
    route = ws;
  });

  await page.goto('/');
  await expect(status(page)).toContainText('Онлайн');
  await expect(price(page)).toHaveText(PRICE.BTC);

  await route!.close();

  await expect(status(page)).toContainText('Переподключение');
  await expect(status(page)).toContainText('Онлайн', { timeout: 10_000 });
  await expectPriceMoving(page);
});

test('обрыв прокси с биржей: прокси переподключается, поток восстанавливается', async ({ page, request }) => {
  await page.goto('/');
  await expect(price(page)).toHaveText(PRICE.BTC);

  await request.get(`${UPSTREAM}/__control/block`);

  await expect
    .poll(async () => (await proxyHealth(request)).hub.rooms.find((r) => r.symbol === 'BTCUSDT')?.upstream, {
      timeout: 10_000,
    })
    .toBe('reconnecting');

  const frozen = await settledPrice(page);
  await page.waitForTimeout(1500);
  expect(await readPrice(page)).toBe(frozen);
  await expect(status(page)).toContainText('Онлайн');

  await request.get(`${UPSTREAM}/__control/unblock`);

  await expect
    .poll(async () => (await proxyHealth(request)).hub.rooms.find((r) => r.symbol === 'BTCUSDT')?.upstream, {
      timeout: 20_000,
    })
    .toBe('open');
  await expect.poll(() => readPrice(page), { timeout: 10_000 }).not.toBe(frozen);
});

test('две вкладки делят одно соединение прокси с биржей', async ({ page, context, request }) => {
  await page.goto('/');
  const second = await context.newPage();
  await second.goto('/');
  await expect(price(page)).toHaveText(PRICE.BTC);
  await expect(price(second)).toHaveText(PRICE.BTC);

  await expect
    .poll(async () => {
      const rooms = (await proxyHealth(request)).hub.rooms.filter((r) => r.symbol === 'BTCUSDT');
      return rooms.map((r) => r.clients);
    })
    .toEqual([2]);
});

test('индикаторы включаются, получают значения и рисуют RSI без ошибок', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('.chart-loading')).toHaveCount(0);

  for (const name of ['SMA 20', 'EMA 50', 'Bollinger']) {
    const chip = page.getByRole('button', { name: new RegExp(name) });
    await expect(chip).toHaveAttribute('aria-pressed', 'false');
    await chip.click();
    await expect(chip).toHaveAttribute('aria-pressed', 'true');
    await expect(chip.locator('.chip__value')).not.toBeEmpty();
  }

  const rsi = page.getByRole('button', { name: /RSI 14/ });
  await rsi.click();
  await expect(rsi).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('RSI 14')).toBeVisible();
  await expect(rsi.locator('.chip__value')).not.toBeEmpty();
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { __perf: { snapshot: () => { indicatorRuns: number } } }).__perf.snapshot().indicatorRuns,
      ),
    )
    .toBeGreaterThan(0);

  await rsi.click();
  await expect(page.getByLabel('RSI 14')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('индикаторы вычисляются в основном потоке, если Web Worker недоступен', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => Object.defineProperty(window, 'Worker', { value: undefined }));
  await page.goto('/');
  await expect(page.locator('.chart-loading')).toHaveCount(0);

  const rsi = page.getByRole('button', { name: /RSI 14/ });
  await rsi.click();
  await expect(page.getByLabel('RSI 14')).toBeVisible();
  await expect(rsi.locator('.chip__value')).not.toBeEmpty();
  expect(errors).toEqual([]);
});
