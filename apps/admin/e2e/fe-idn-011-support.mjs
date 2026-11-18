import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

// eslint-disable-next-line n/no-extraneous-import -- Existing workspace browser tooling.
import { chromium } from 'playwright';

export const origin = process.env.FE_IDN_011_ORIGIN || 'http://127.0.0.1:5666';
export const output = new URL(
  '../../../docs/evidence/fe-idn-011/',
  import.meta.url,
);
export const report = {
  task: 'FE-IDN-011',
  startedAt: new Date().toISOString(),
  origin,
  backend: process.env.FE_IDN_011_BACKEND || 'http://127.0.0.1:18080',
  backendRevision: '1da2fdb',
  checks: [],
  requests: [],
  browserErrors: [],
};
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
  process.stdout.write(`FE-IDN-011 acceptance ${item}: passed\n`);
}
export function database(operation, payload) {
  return new Promise((resolve, reject) => {
    const child = execFile(
      process.env.FE_IDN_011_BUN || 'bun',
      [fileURLToPath(new URL('fe-idn-011-db.mjs', import.meta.url)), operation],
      { timeout: 30_000, maxBuffer: 4 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error)
          return reject(
            new Error('Database worker: ' + (stderr || error.message)),
          );
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
export async function setup() {
  const browser = await chromium.launch({
    headless: true,
    channel: process.env.FE_IDN_011_BROWSER_CHANNEL || 'msedge',
  });
  const context = await browser.newContext({
    userAgent: 'FE-IDN-011 acceptance browser',
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    viewport: { width: 1800, height: 1150 },
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => report.browserErrors.push(error.message));
  page.on('response', (response) => {
    const url = new URL(response.url());
    if (url.pathname.includes('/notifications/'))
      report.requests.push({
        method: response.request().method(),
        path: url.pathname,
        query: Object.fromEntries(url.searchParams),
        status: response.status(),
      });
  });
  return { browser, page };
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
  assert.equal((await pending).status(), 200);
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
