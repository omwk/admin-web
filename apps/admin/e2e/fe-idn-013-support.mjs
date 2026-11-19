import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

// eslint-disable-next-line n/no-extraneous-import -- Existing workspace browser tooling.
import { chromium } from 'playwright';

export const origin = process.env.FE_IDN_013_ORIGIN || 'http://127.0.0.1:5666';
const backend = process.env.FE_IDN_013_BACKEND || 'http://127.0.0.1:18080';
export const output = new URL(
  '../../../docs/evidence/fe-idn-013/',
  import.meta.url,
);
export const report = {
  task: 'FE-IDN-013',
  startedAt: new Date().toISOString(),
  origin,
  backend,
  backendRevision: 'acae5f0',
  migration: 36,
  checks: [],
  requests: [],
  browserErrors: [],
  navigations: [],
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
  process.stdout.write(`FE-IDN-013 acceptance ${item}: passed\n`);
}
export function database(operation, payload = {}) {
  return new Promise((resolve, reject) => {
    const child = execFile(
      process.env.FE_IDN_013_BUN || 'bun',
      [
        '--env-file=' +
          (process.env.FE_IDN_013_ENV_FILE || 'D:/code/go-admin-api/.env'),
        fileURLToPath(new URL('fe-idn-013-db.mjs', import.meta.url)),
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
export async function api(path, method = 'GET', input) {
  const response = await fetch(backend + '/api/v1' + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'FE-IDN-013 acceptance API',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
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
  assert.ok(
    response.ok,
    method + ' ' + path + ': ' + response.status + ' ' + body.message,
  );
  return body.data;
}
export async function authenticate(tenant, password) {
  const result = await api('/auth/login', 'POST', {
    tenant,
    account: 'owner',
    password,
  });
  token = result.access_token;
  assert.ok(token);
}
export async function cleanupApi(fixture) {
  const start = report.requests.length;
  for (const user of fixture.users.slice(1)) {
    await api('/admin/users/' + user.id + '/roles', 'PUT', { role_ids: [] });
    await api('/admin/users/' + user.id, 'DELETE');
  }
  for (const role of [fixture.audienceRole]) {
    for (const [relation, field] of [
      ['menus', 'menu_ids'],
      ['permissions', 'permission_ids'],
      ['depts', 'dept_ids'],
    ])
      await api('/admin/roles/' + role.id + '/' + relation, 'PUT', {
        [field]: [],
      });
    await api('/admin/roles/' + role.id, 'DELETE');
  }
  // Keep the owner's permission grant until every authenticated delete is done.
  await api('/admin/roles/' + fixture.adminRole.id + '/menus', 'PUT', {
    menu_ids: [],
  });
  const menus = await api('/admin/menus');
  const flat = [];
  function flatten(items) {
    for (const item of items) {
      flat.push(item);
      if (item.children) flatten(item.children);
    }
  }
  flatten(menus);
  async function removeMenus(parent = 0) {
    for (const menu of flat.filter((item) => item.parent_id === parent)) {
      await removeMenus(menu.id);
      await api('/admin/menus/' + menu.id, 'DELETE');
    }
  }
  await removeMenus();
  await api('/admin/users/' + fixture.users[0].id, 'DELETE');
  report.apiCleanup = report.requests.slice(start);
}
export async function setup() {
  const browser = await chromium.launch({
    headless: true,
    channel: process.env.FE_IDN_013_BROWSER_CHANNEL || 'msedge',
  });
  const context = await browser.newContext({
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    viewport: { width: 1800, height: 1200 },
    userAgent: 'FE-IDN-013 acceptance browser',
  });
  const page = await context.newPage();
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame())
      report.navigations.push({
        path: new URL(frame.url()).pathname,
        time: new Date().toISOString(),
      });
  });
  page.on('pageerror', (error) => report.browserErrors.push(error.message));
  page.on('response', (response) => {
    const url = new URL(response.url());
    if (url.pathname.includes('/notifications'))
      report.requests.push({
        path: url.pathname,
        method: response.request().method(),
        status: response.status(),
        query: Object.fromEntries(url.searchParams),
      });
  });
  return { browser, page };
}
export async function login(page, tenant, username, password) {
  await page.goto(origin + '/auth/login?tenant=' + tenant);
  await page.getByLabel('企业代码', { exact: true }).fill(tenant);
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
    mask: [page.locator('input[type="password"]')],
  });
  return name + '.png';
}
export async function response(page, path, method = 'GET') {
  const value = await page.waitForResponse(
    (value) =>
      new URL(value.url()).pathname === '/api/v1/admin/notifications' + path &&
      value.request().method() === method,
  );
  // Read immediately: the preview iframe can navigate before click() resolves.
  const body = await value.json();
  return { status: () => value.status(), json: async () => body };
}
export function button(page, text, root = page) {
  return root.getByRole('button', {
    name: new RegExp('^' + [...text].join('\\s*') + '$'),
  });
}
export async function smtp() {
  let messages = 0;
  const sockets = new Set();
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.on('error', () => socket.destroy());
    let buffer = '';
    let data = false;
    socket.write('220 localhost acceptance SMTP\r\n');
    socket.on('data', (chunk) => {
      buffer += chunk.toString();
      while (buffer.includes('\n')) {
        const index = buffer.indexOf('\n');
        const line = buffer.slice(0, index).replace(/\r$/, '');
        buffer = buffer.slice(index + 1);
        if (data) {
          if (line === '.') {
            messages++;
            data = false;
            socket.write('250 accepted\r\n');
          }
          continue;
        }
        if (/^EHLO|^HELO/i.test(line))
          socket.write('250-localhost\r\n250 8BITMIME\r\n');
        else if (/^DATA/i.test(line)) {
          data = true;
          socket.write('354 Send message\r\n');
        } else if (/^QUIT/i.test(line)) socket.end('221 Bye\r\n');
        else socket.write('250 OK\r\n');
      }
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    port: server.address().port,
    count: () => messages,
    close: async () => {
      for (const socket of sockets) socket.destroy();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}
