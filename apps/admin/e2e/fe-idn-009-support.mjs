import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

// eslint-disable-next-line n/no-extraneous-import -- Existing workspace browser tooling.
import { chromium } from 'playwright';

export const origin = process.env.FE_IDN_009_ORIGIN || 'http://127.0.0.1:5666';
const backend = process.env.FE_IDN_009_BACKEND || 'http://127.0.0.1:18080';
export const output = new URL(
  '../../../docs/evidence/fe-idn-009/',
  import.meta.url,
);
export const agents = [
  'FE-IDN-009 acceptance API',
  'FE-IDN-009 acceptance browser',
];
export const report = {
  task: 'FE-IDN-009',
  startedAt: new Date().toISOString(),
  origin,
  backend,
  checks: [],
  requests: [],
  browserErrors: [],
  resources: { users: [], roles: [], products: [], templates: [] },
};
let adminToken;
export async function persist() {
  await mkdir(output, { recursive: true });
  await writeFile(
    new URL('acceptance.json', output),
    JSON.stringify(report, null, 2) + '\n',
  );
}
export async function record(item, assertion, evidence) {
  report.checks.push({ item, assertion, result: 'pass', ...evidence });
  await persist();
  process.stdout.write(`FE-IDN-009 acceptance ${item}: passed\n`);
}
export async function request(path, method = 'GET', body, token = adminToken) {
  const result = await fetch(backend + '/api/v1' + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': agents[0],
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(20_000),
  });
  const envelope = result.status === 204 ? {} : await result.json();
  report.requests.push({
    method,
    path,
    status: result.status,
    code: envelope.code,
    traceId: envelope.trace_id,
  });
  return { status: result.status, data: envelope.data, code: envelope.code };
}
export async function api(path, method = 'GET', body, token = adminToken) {
  const result = await request(path, method, body, token);
  assert.ok(
    result.status >= 200 && result.status < 300,
    `${method} ${path}: ${result.status}/${result.code}`,
  );
  return result.data;
}
export async function setup() {
  assert.ok(
    process.env.FE_IDN_009_ADMIN_PASSWORD,
    'Set FE_IDN_009_ADMIN_PASSWORD',
  );
  assert.ok(process.env.FE_IDN_009_DATABASE_URL, 'Set FE_IDN_009_DATABASE_URL');
  await persist();
  return chromium.launch({
    headless: true,
    channel: process.env.FE_IDN_009_BROWSER_CHANNEL || 'msedge',
  });
}
export async function context(browser) {
  const result = await browser.newContext({
    userAgent: agents[1],
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    viewport: { width: 1680, height: 1100 },
  });
  result.on('page', (page) =>
    page.on('pageerror', (error) => report.browserErrors.push(error.message)),
  );
  return result;
}
export async function login(
  page,
  account = 'admin',
  password = process.env.FE_IDN_009_ADMIN_PASSWORD,
) {
  await page.goto(origin + '/auth/login?tenant=default');
  await page.getByLabel('企业代码', { exact: true }).fill('default');
  await page.getByLabel('账号', { exact: true }).fill(account);
  await page.getByPlaceholder('密码', { exact: true }).fill(password);
  const pending = page.waitForResponse(
    (result) =>
      new URL(result.url()).pathname === '/api/v1/auth/login' &&
      result.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'login', exact: true }).click();
  const response = await pending;
  assert.equal(response.status(), 200);
  const auth = (await response.json()).data;
  if (account === 'admin') adminToken = auth.access_token;
  await page.waitForURL((url) => !url.pathname.startsWith('/auth/'));
  await page.getByTestId('home-welcome').waitFor();
  return auth;
}
export async function shot(name, page) {
  await page.locator('.ant-spin-spinning').first().waitFor({ state: 'hidden' });
  await page.screenshot({
    path: fileURLToPath(new URL(name + '.png', output)),
    fullPage: true,
    animations: 'disabled',
    mask: [page.locator('input[type="password"]')],
  });
}
export const flatten = (nodes) =>
  nodes.flatMap((node) => [node, ...flatten(node.children ?? [])]);
export const sidebar = (page) => page.locator('aside').first();
export async function openDirectory(page, name) {
  const entry = sidebar(page).getByText(name, { exact: true }).first();
  await entry.click();
}
export async function expect404(page) {
  await page.getByText('404 · 页面不存在', { exact: true }).waitFor();
  assert.equal(await page.getByText('商品概览', { exact: true }).count(), 0);
}
export function database(operation, payload = {}) {
  return new Promise((resolve, reject) => {
    const child = execFile(
      process.env.FE_IDN_009_BUN || 'bun',
      [fileURLToPath(new URL('fe-idn-009-db.mjs', import.meta.url)), operation],
      { timeout: 20_000, maxBuffer: 4 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error('Database fixture: ' + (stderr || error.message)));
          return;
        }
        try {
          resolve(JSON.parse(stdout));
        } catch (parseError) {
          reject(parseError);
        }
      },
    );
    child.stdin.on('error', reject);
    child.stdin.end(JSON.stringify(payload));
  });
}
