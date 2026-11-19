import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

// eslint-disable-next-line n/no-extraneous-import -- Existing workspace browser tooling.
import { chromium } from 'playwright';

export const origin = process.env.FE_IDN_015_ORIGIN || 'http://127.0.0.1:5666';
export const hashHistory = process.env.FE_IDN_015_HISTORY === 'hash';
export const pageURL = (path) => origin + (hashHistory ? '/#' : '') + path;
export const routeLocation = (url) =>
  url.hash.startsWith('#/') ? new URL(url.hash.slice(1), url.origin) : url;
const backend = process.env.FE_IDN_015_BACKEND || 'http://127.0.0.1:18080';
export const output = new URL(
  '../../../docs/evidence/fe-idn-015/',
  import.meta.url,
);
export const report = {
  task: 'FE-IDN-015',
  startedAt: new Date().toISOString(),
  origin,
  backend,
  checks: [],
  requests: [],
  browserErrors: [],
};
let token;
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
  process.stdout.write(`FE-IDN-015 acceptance ${item}: passed\n`);
}
export function database(operation, payload = {}) {
  return new Promise((resolve, reject) => {
    const child = execFile(
      process.env.FE_IDN_015_BUN || 'bun',
      [
        '--env-file=' +
          (process.env.FE_IDN_015_ENV_FILE || 'D:/code/go-admin-api/.env'),
        fileURLToPath(new URL('fe-idn-015-db.mjs', import.meta.url)),
        operation,
      ],
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
      'User-Agent': 'FE-IDN-015 acceptance API',
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
  const context =
    method + ' ' + path + ': ' + response.status + ' ' + body.message;
  if (expected === undefined) assert.ok(response.ok, context);
  else assert.equal(response.status, expected, context);
  return response.status >= 400 ? body : body.data;
}
export async function authenticate(
  tenant,
  password,
  account = 'owner',
  primary = account === 'owner',
) {
  const result = await api('/auth/login', 'POST', {
    tenant,
    account,
    password,
  });
  if (primary) token = result.access_token;
  assert.ok(result.access_token);
  return result.access_token;
}
export async function setup() {
  const browser = await chromium.launch({
    headless: true,
    channel: process.env.FE_IDN_015_BROWSER_CHANNEL || 'msedge',
  });
  const context = await browser.newContext({
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    viewport: { width: 1600, height: 1100 },
    userAgent: 'FE-IDN-015 acceptance browser',
  });
  // Forward the browser to the same real backend as the API fixture helpers.
  await context.route('**/api/v1/**', async (route) => {
    const requestURL = new URL(route.request().url());
    const result = await route.fetch({
      url: backend + requestURL.pathname + requestURL.search,
    });
    await route.fulfill({ response: result });
  });
  const page = await context.newPage();
  page.on('requestfailed', (request) => {
    if (new URL(request.url()).pathname === '/favicon.ico') {
      report.avatarRequestFailure = request.failure()?.errorText;
    }
  });
  page.on('pageerror', (error) => report.browserErrors.push(error.message));
  page.on('response', (response) => {
    const url = new URL(response.url());
    if (
      url.pathname.startsWith('/api/v1/') &&
      !url.pathname.includes('/auth/refresh')
    )
      report.requests.push({
        path: url.pathname,
        method: response.request().method(),
        status: response.status(),
      });
  });
  return { browser, page };
}
export async function login(page, tenant, username, password) {
  await page.goto(pageURL('/auth/login?tenant=' + tenant));
  await page.getByLabel('企业代码', { exact: true }).fill(tenant);
  await page.getByLabel('账号', { exact: true }).fill(username);
  await page.getByPlaceholder('密码', { exact: true }).fill(password);
  const pending = response(page, '/auth/login', 'POST');
  await page.getByRole('button', { name: 'login', exact: true }).click();
  assert.equal((await pending).status, 200);
  await page.waitForURL(
    (url) => !routeLocation(url).pathname.startsWith('/auth/'),
  );
  await page.getByTestId('home-welcome').waitFor();
}
export async function shot(name, page) {
  await page.locator('.ant-spin-spinning').first().waitFor({ state: 'hidden' });
  await page.screenshot({
    path: fileURLToPath(new URL(name + '.png', output)),
    fullPage: true,
    animations: 'disabled',
    mask: [
      page.locator('input[type="password"]'),
      page.locator('input[aria-label="推送 URL"]'),
    ],
  });
  return name + '.png';
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
export function button(page, text, root = page) {
  return root.getByRole('button', {
    name: new RegExp('^' + [...text].join('\\s*') + '$'),
  });
}
export async function cleanupApi(fixture) {
  const start = report.requests.length;
  if (report.fixture.provider)
    await api(
      '/admin/notifications/providers/' + report.fixture.provider,
      'DELETE',
      undefined,
      token,
      204,
    );
  for (const item of (await api('/auth/notification-channels')).channels)
    await api(
      '/auth/notification-channels/' + item.channel,
      'DELETE',
      undefined,
      token,
      204,
    );
  for (const user of fixture.users.slice(1)) {
    await api('/admin/users/' + user.id + '/roles', 'PUT', { role_ids: [] });
    await api('/admin/users/' + user.id, 'DELETE', undefined, token, 204);
  }
  for (const [relation, field] of [
    ['menus', 'menu_ids'],
    ['permissions', 'permission_ids'],
    ['depts', 'dept_ids'],
  ])
    await api(
      '/admin/roles/' + fixture.audienceRole.id + '/' + relation,
      'PUT',
      { [field]: [] },
    );
  await api(
    '/admin/roles/' + fixture.audienceRole.id,
    'DELETE',
    undefined,
    token,
    204,
  );
  await api('/admin/roles/' + fixture.adminRole.id + '/menus', 'PUT', {
    menu_ids: [],
  });
  const flat = [];
  function flatten(items) {
    for (const item of items) {
      flat.push(item);
      flatten(item.children || []);
    }
  }
  flatten(await api('/admin/menus'));
  async function removeMenus(parent = 0) {
    for (const menu of flat.filter((item) => item.parent_id === parent)) {
      await removeMenus(menu.id);
      await api('/admin/menus/' + menu.id, 'DELETE', undefined, token, 204);
    }
  }
  await removeMenus();
  await api(
    '/admin/users/' + fixture.users[0].id,
    'DELETE',
    undefined,
    token,
    204,
  );
  report.apiCleanup = report.requests.slice(start);
}
