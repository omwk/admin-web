import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import process from 'node:process';
import { setTimeout } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

// eslint-disable-next-line n/no-extraneous-import -- Shared workspace test tooling.
import { chromium } from 'playwright';

export const origin = process.env.FE_UI_ORIGIN || 'http://127.0.0.1:5667';
const backend = process.env.FE_UI_BACKEND || 'http://127.0.0.1:18080';
export const output = new URL(
  '../../../docs/evidence/fe-ui-001/',
  import.meta.url,
);
export const button = (text, page) =>
  page.getByRole('button', {
    name: new RegExp('^' + [...text].join('\\s*') + '$'),
  });
export const summary = (value) => ({
  status: value.status,
  code: value.body.code,
  message: value.body.message,
  traceId: value.body.trace_id,
});
export async function request(path, method = 'GET', input, token) {
  const result = await fetch(backend + '/api/v1' + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    ...(input === undefined ? {} : { body: JSON.stringify(input) }),
  });
  const body = result.status === 204 ? {} : await result.json();
  return { status: result.status, body, data: body.data };
}
export async function api(path, method, input, token) {
  let result = await request(path, method, input, token);
  for (let attempt = 0; result.status === 429 && attempt < 3; attempt++) {
    await setTimeout(60_000);
    result = await request(path, method, input, token);
  }
  assert.ok(
    result.status >= 200 && result.status < 300,
    method + ' ' + path + ': ' + JSON.stringify(summary(result)),
  );
  return result.data;
}
export const login = (account, password, tenant = 'default') =>
  api('/auth/login', 'POST', { tenant, account, password });
export async function setup() {
  assert.ok(
    process.env.FE_UI_ADMIN_PASSWORD,
    'FE_UI_ADMIN_PASSWORD is required',
  );
  await mkdir(output, { recursive: true });
  const admin = await login('admin', process.env.FE_UI_ADMIN_PASSWORD);
  const prefix = 'feui001_' + randomUUID().slice(0, 8);
  const initialPassword = 'Init123_' + randomUUID();
  const password = 'Pass123_' + randomUUID();
  const user = await api(
    '/admin/users',
    'POST',
    {
      username: prefix,
      nickname: 'FE UI 验收',
      email: prefix + '@example.test',
      dept_id: 1,
      status: 'active',
      password: initialPassword,
    },
    admin.access_token,
  );
  const initial = await login(user.username, initialPassword);
  await api(
    '/auth/password',
    'PUT',
    { oldPassword: initialPassword, newPassword: password },
    initial.access_token,
  );
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  return { admin, browser, user, password, prefix };
}
export async function newPage(browser, pair, path = '/profile') {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(origin + '/auth/login');
  await page.evaluate((refresh) => {
    sessionStorage.setItem('vben-web-antd:refresh_token', refresh);
  }, pair.refresh_token);
  await page.goto(origin + path);
  return { context, page, errors };
}
export async function response(page, path, method, action) {
  const pending = page.waitForResponse(
    (value) =>
      new URL(value.url()).pathname === '/api/v1' + path &&
      value.request().method() === method,
  );
  await action();
  const result = await pending;
  const body = result.status() === 204 ? {} : await result.json();
  return { status: result.status(), body, data: body.data };
}
export async function shot(name, page) {
  await page.screenshot({
    path: fileURLToPath(new URL(name + '.png', output)),
    fullPage: true,
    animations: 'disabled',
    mask: [page.locator('input[type="password"]')],
  });
}
export async function cleanup(state) {
  await state.browser.close();
  await api(
    '/admin/users/' + state.user.id,
    'DELETE',
    undefined,
    state.admin.access_token,
  );
  await api('/auth/logout', 'POST', undefined, state.admin.access_token);
}
