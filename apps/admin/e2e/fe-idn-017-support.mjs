import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

// eslint-disable-next-line n/no-extraneous-import -- Existing workspace browser tooling.
import { chromium } from 'playwright';

export const origin = process.env.FE_IDN_017_ORIGIN || 'http://127.0.0.1:5667';
export const backend =
  process.env.FE_IDN_017_BACKEND || 'http://127.0.0.1:18081';
export const output = new URL(
  '../../../docs/evidence/fe-idn-017/',
  import.meta.url,
);
export const report = {
  task: 'FE-IDN-017',
  startedAt: new Date().toISOString(),
  origin,
  backend,
  checks: [],
  requests: [],
  browserErrors: [],
};
let token;
export const pageURL = (path) => origin + '/#' + path;
export async function persist() {
  await mkdir(output, { recursive: true });
  await writeFile(
    new URL('acceptance.json', output),
    JSON.stringify(report, null, 2) + '\n',
  );
}
export async function record(item, evidence) {
  report.checks.push({ item, result: 'pass', ...evidence });
  await persist();
  console.log(`FE-IDN-017 acceptance ${item}: passed`);
}
export async function api(
  path,
  method = 'GET',
  input,
  accessToken = token,
  expected,
) {
  const response = await fetch(backend + '/api/v1' + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'FE-IDN-017 acceptance API',
      ...(accessToken ? { Authorization: 'Bearer ' + accessToken } : {}),
    },
    ...(input === undefined ? {} : { body: JSON.stringify(input) }),
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  report.requests.push({
    path: '/api/v1' + path,
    method,
    status: response.status,
    traceId: body.trace_id,
  });
  const context = `${method} ${path}: ${response.status} ${body.message}`;
  if (expected === undefined) assert.ok(response.ok, context);
  else assert.equal(response.status, expected, context);
  return response.status >= 400 ? body : body.data;
}
export async function authenticate(
  account = 'admin',
  password = process.env.CH_SEED_ADMIN_PASSWORD,
  primary = true,
) {
  const result = await api(
    '/auth/login',
    'POST',
    { tenant: 'default', account, password },
    null,
  );
  if (primary) token = result.access_token;
  assert.ok(result.access_token);
  return result.access_token;
}
export function database(operation, payload = {}) {
  return new Promise((resolve, reject) => {
    const child = execFile(
      'bun',
      [fileURLToPath(new URL('fe-idn-017-db.mjs', import.meta.url)), operation],
      { timeout: 30_000 },
      (error, stdout, stderr) => {
        if (error)
          return reject(
            new Error('Database helper: ' + (stderr || error.message)),
          );
        try {
          resolve(JSON.parse(stdout));
        } catch (failure) {
          reject(failure);
        }
      },
    );
    child.stdin.on('error', reject);
    child.stdin.end(JSON.stringify(payload));
  });
}
export async function setup() {
  const browser = await chromium.launch({
    headless: true,
    channel: process.env.FE_IDN_017_BROWSER_CHANNEL || 'msedge',
  });
  const context = await browser.newContext({
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    viewport: { width: 1600, height: 1100 },
    userAgent: 'FE-IDN-017 acceptance browser',
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  // Only forward transport to the isolated real API; no responses are simulated.
  await context.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    await route.fulfill({
      response: await route.fetch({ url: backend + url.pathname + url.search }),
    });
  });
  context.on('page', (page) => {
    page.on('pageerror', (error) => report.browserErrors.push(error.message));
    page.on('response', (response) => {
      const url = new URL(response.url());
      if (url.pathname.startsWith('/api/v1/'))
        report.requests.push({
          path: url.pathname,
          method: response.request().method(),
          status: response.status(),
        });
    });
  });
  return { browser, page: await context.newPage(), context };
}
export async function login(
  page,
  account = 'admin',
  password = process.env.CH_SEED_ADMIN_PASSWORD,
) {
  await page.goto(pageURL('/auth/login?tenant=default'));
  await page.getByLabel('企业代码', { exact: true }).fill('default');
  await page.getByLabel('账号', { exact: true }).fill(account);
  await page.getByPlaceholder('密码', { exact: true }).fill(password);
  const pending = response(page, '/auth/login', 'POST');
  await button(page, 'login').click();
  assert.equal((await pending).status, 200);
  await page.getByTestId('home-welcome').waitFor();
}
export function button(page, text, root = page) {
  return root.getByRole('button', {
    name: new RegExp('^' + [...text].join('\\s*') + '$'),
  });
}
export async function response(page, path, method = 'GET') {
  const result = await page.waitForResponse(
    (value) =>
      new URL(value.url()).pathname === '/api/v1' + path &&
      value.request().method() === method,
  );
  return {
    status: result.status(),
    body: result.status() === 204 ? undefined : await result.json(),
  };
}
export async function shot(name, page) {
  await page.screenshot({
    path: fileURLToPath(new URL(name + '.png', output)),
    fullPage: true,
    animations: 'disabled',
    mask: [
      page.locator('input[aria-label="Secret Key"]'),
      page.locator('input[aria-label="Access Key"]'),
      page.locator('input[type="password"]'),
    ],
  });
  return name + '.png';
}
export async function waitUntil(check, message, timeout = 30_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(message);
}
