import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

// eslint-disable-next-line n/no-extraneous-import -- Existing workspace browser tooling.
import { chromium } from 'playwright';

export const origin = process.env.FE_IDN_010_ORIGIN || 'http://127.0.0.1:5666';
const backend = process.env.FE_IDN_010_BACKEND || 'http://127.0.0.1:18080';
export const output = new URL(
  '../../../docs/evidence/fe-idn-010/',
  import.meta.url,
);
export const agents = [
  'FE-IDN-010 acceptance API',
  'FE-IDN-010 acceptance browser',
];
export const report = {
  task: 'FE-IDN-010',
  startedAt: new Date().toISOString(),
  origin,
  backend,
  backendRevision: process.env.FE_IDN_010_BACKEND_REV,
  checks: [],
  requests: [],
  browserErrors: [],
  resources: { providers: [] },
};
let token;
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
  process.stdout.write(`FE-IDN-010 acceptance ${item}: passed\n`);
}
export async function api(path, method = 'GET', body) {
  const response = await fetch(backend + '/api/v1' + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': agents[0],
      Authorization: 'Bearer ' + token,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(20_000),
  });
  const envelope = response.status === 204 ? {} : await response.json();
  report.requests.push({
    source: 'real-api',
    method,
    path,
    status: response.status,
    code: envelope.code,
    traceId: envelope.trace_id,
  });
  assert.ok(
    response.ok,
    `${method} ${path}: ${response.status}/${envelope.code}`,
  );
  return envelope.data;
}
export async function setup() {
  await persist();
  return chromium.launch({
    headless: true,
    channel: process.env.FE_IDN_010_BROWSER_CHANNEL || 'msedge',
  });
}
export async function context(browser) {
  const result = await browser.newContext({
    userAgent: agents[1],
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    viewport: { width: 1540, height: 1250 },
  });
  result.on('page', (page) =>
    page.on('pageerror', (error) => report.browserErrors.push(error.message)),
  );
  return result;
}
export async function login(page, username, password) {
  await page.goto(origin + '/auth/login?tenant=default');
  await page.getByLabel('企业代码', { exact: true }).fill('default');
  await page.getByLabel('账号', { exact: true }).fill(username);
  await page.getByPlaceholder('密码', { exact: true }).fill(password);
  const pending = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/v1/auth/login' &&
      response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'login', exact: true }).click();
  const response = await pending;
  assert.equal(response.status(), 200);
  token = (await response.json()).data.access_token;
  report.requests.push({
    source: 'real-browser',
    method: 'POST',
    path: '/auth/login',
    status: response.status(),
  });
  await page.waitForURL((url) => !url.pathname.startsWith('/auth/'));
  await page.getByTestId('home-welcome').waitFor();
}
export async function shot(name, page) {
  await page.locator('.ant-spin-spinning').first().waitFor({ state: 'hidden' });
  await page.screenshot({
    path: fileURLToPath(new URL(name + '.png', output)),
    fullPage: true,
    animations: 'disabled',
  });
}
export function database(operation, payload) {
  return new Promise((resolve, reject) => {
    const child = execFile(
      process.env.FE_IDN_010_BUN || 'bun',
      [fileURLToPath(new URL('fe-idn-010-db.mjs', import.meta.url)), operation],
      { timeout: 30_000, maxBuffer: 4 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error('Database worker: ' + (stderr || error.message)));
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
