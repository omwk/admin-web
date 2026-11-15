import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

// eslint-disable-next-line n/no-extraneous-import -- Workspace browser test tooling.
import { chromium } from 'playwright';

assert.ok(process.env.FE_IDN_ADMIN_PASSWORD, 'Set FE_IDN_ADMIN_PASSWORD');
const origin = process.env.FE_IDN_ORIGIN || 'http://127.0.0.1:5666';
const output = new URL('../../../docs/reports/fe-idn-004/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  channel: process.env.FE_IDN_BROWSER_CHANNEL || 'chrome',
  headless: false,
  args: ['--remote-debugging-port=19224', '--remote-allow-origins=*'],
});
let currentPage;
let devToolsPage;
try {
  const context = await browser.newContext({
    viewport: { width: 1400, height: 1050 },
    locale: 'zh-CN',
  });
  const page = await context.newPage();
  currentPage = page;
  const dictionaryRequests = [];
  page.on('response', (response) => {
    const path = new URL(response.url()).pathname;
    if (path.includes('/meta/dicts/')) {
      dictionaryRequests.push({ path, status: response.status() });
    }
  });
  page.on('pageerror', (error) =>
    process.stdout.write('Page error: ' + error.message + '\n'),
  );
  await page.goto(origin + '/auth/login');
  await page.getByLabel('企业代码', { exact: true }).fill('default');
  await page.getByLabel('账号', { exact: true }).fill('admin');
  await page
    .getByPlaceholder('密码', { exact: true })
    .fill(process.env.FE_IDN_ADMIN_PASSWORD);
  const loginResponse = page.waitForResponse((response) =>
    new URL(response.url()).pathname.endsWith('/auth/login'),
  );
  await page.getByRole('button', { name: 'login', exact: true }).click();
  const login = await loginResponse;
  const loginResult = await login.json();
  assert.equal(
    login.status(),
    200,
    'Login HTTP status: ' + loginResult.message,
  );
  assert.equal(loginResult.code, 0, 'Login result: ' + loginResult.message);
  await page.waitForURL((url) => !url.pathname.startsWith('/auth'));
  await page.waitForLoadState('networkidle');
  const session = await context.newCDPSession(page);
  const { targetInfo } = await session.send('Target.getTargetInfo');
  const tools = await context.newPage();
  devToolsPage = tools;
  tools.on('pageerror', (error) =>
    process.stdout.write('DevTools error: ' + error.message + '\n'),
  );
  await tools.goto(
    'http://127.0.0.1:19224/devtools/inspector.html?panel=network&ws=127.0.0.1:19224/devtools/page/' +
      targetInfo.targetId,
  );
  try {
    await tools
      .getByRole('tab', { name: /Network|网络/, exact: true })
      .click({ timeout: 10000 });
  } catch (error) {
    process.stdout.write((await tools.content()).slice(0, 8000) + '\n');
    await tools.screenshot({
      path: fileURLToPath(new URL('debug-network.png', output)),
    });
    throw error;
  }
  await page.goto(origin + '/catalog/products');
  await page
    .getByTestId('product-table')
    .locator('tbody tr[data-row-key]')
    .first()
    .waitFor();
  await tools
    .getByRole('button', { name: /切换截屏视频|Toggle screencast/ })
    .click();
  const filter = tools.locator(
    '[contenteditable][aria-label="Filter"], [contenteditable][aria-label="筛选器"]',
  );
  await filter.click();
  await filter.pressSequentially('/meta/dicts/', { delay: 70 });
  await filter.press('Enter');
  await tools.waitForFunction(() =>
    document.body.innerText.includes('product_status'),
  );
  await page
    .getByTestId('product-table')
    .locator('tbody tr[data-row-key] .ant-tag')
    .first()
    .waitFor();
  assert.equal(dictionaryRequests.length, 1);
  assert.equal(dictionaryRequests[0].path, '/api/v1/meta/dicts/product_status');
  assert.equal(dictionaryRequests[0].status, 200);
  const rowCount = await page
    .getByTestId('product-table')
    .locator('tbody tr[data-row-key]')
    .count();
  assert.equal(rowCount, 20);
  await page.getByTestId('product-table').getByRole('link').first().click();
  await page.waitForURL(/\/catalog\/products\/\d+$/);
  await page.getByText('商品概览', { exact: true }).waitFor();
  await page.goBack();
  await page
    .getByTestId('product-table')
    .locator('tbody tr[data-row-key]')
    .first()
    .waitFor();
  assert.equal(dictionaryRequests.length, 1);
  await writeFile(
    new URL('10-network.json', output),
    JSON.stringify(
      {
        page: '/catalog/products',
        rows: rowCount,
        requests: dictionaryRequests,
        crossPageReuse: [
          '/catalog/products',
          '/catalog/products/:id',
          '/catalog/products',
        ],
        requestCount: dictionaryRequests.length,
      },
      null,
      2,
    ),
  );
  await tools.screenshot({
    path: fileURLToPath(new URL('10-network-panel.png', output)),
    fullPage: true,
  });
  await writeFile(
    new URL('10-network-panel-text.txt', output),
    await tools.locator('body').innerText(),
  );
  process.stdout.write(
    JSON.stringify({
      rows: rowCount,
      requestCount: dictionaryRequests.length,
      crossPageReuse: true,
    }) + '\n',
  );
} catch (error) {
  process.stderr.write(String(error.stack) + '\n');
  if (devToolsPage) {
    await devToolsPage
      .screenshot({ path: fileURLToPath(new URL('debug-network.png', output)) })
      .catch(() => {});
    await writeFile(
      new URL('debug-network.txt', output),
      await devToolsPage.locator('body').innerText(),
    ).catch(() => {});
  }
  if (currentPage) {
    process.stdout.write(
      JSON.stringify({
        url: currentPage.url(),
        alerts: await currentPage
          .locator('.ant-alert,.ant-message')
          .allTextContents()
          .catch(() => []),
      }) + '\n',
    );
    await currentPage
      .screenshot({
        path: fileURLToPath(new URL('failure-network.png', output)),
        mask: [currentPage.locator('input[type="password"]')],
      })
      .catch(() => {});
  }
  throw error;
} finally {
  await browser.close();
}
