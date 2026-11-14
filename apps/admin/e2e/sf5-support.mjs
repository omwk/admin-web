import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

// eslint-disable-next-line n/no-extraneous-import -- Workspace browser test tooling.
import { chromium } from 'playwright';

export const origin = process.env.SF5_ORIGIN || 'http://127.0.0.1:5666';
const backend = process.env.SF5_BACKEND || 'http://127.0.0.1:18080';
export const output = new URL('../../../docs/evidence/sf-5/', import.meta.url);
export const checks = [];
export const browserErrors = [];
export const httpErrors = [];
export const secrets = new Set();
export const cleanup = [];
let adminToken;
export function redact(value) {
  let text = String(value);
  for (const secret of secrets)
    if (secret) text = text.replaceAll(secret, '[REDACTED]');
  return text.replaceAll(
    /(?:#token=|%23token%3D)[^\s"'<>]+/g,
    '#token=[REDACTED]',
  );
}
export async function request(path, method = 'GET', body, bearer = adminToken) {
  const response = await fetch(backend + '/api/v1' + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(bearer ? { Authorization: 'Bearer ' + bearer } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const envelope = response.status === 204 ? {} : await response.json();
  return { status: response.status, envelope, data: envelope.data };
}
export async function api(path, method = 'GET', body, bearer = adminToken) {
  const result = await request(path, method, body, bearer);
  assert.ok(
    result.status >= 200 && result.status < 300,
    method + ' ' + path + ': ' + result.status + '/' + result.envelope.code,
  );
  return result.data;
}
export async function setup() {
  assert.ok(process.env.SF5_ADMIN_PASSWORD, 'Set SF5_ADMIN_PASSWORD');
  secrets.add(process.env.SF5_ADMIN_PASSWORD);
  await mkdir(output, { recursive: true });
  const auth = await api(
    '/auth/login',
    'POST',
    {
      username: 'admin',
      password: process.env.SF5_ADMIN_PASSWORD,
    },
    null,
  );
  adminToken = auth.access_token;
  secrets.add(adminToken);
  secrets.add(auth.refresh_token);
  const browser = await chromium.launch({
    headless: true,
    channel: process.env.SF5_BROWSER_CHANNEL || 'msedge',
  });
  return browser;
}
export async function context(browser) {
  const result = await browser.newContext({
    viewport: { width: 1600, height: 1100 },
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  result.on('page', (page) =>
    page.on('pageerror', (error) => browserErrors.push(redact(error.message))),
  );
  return result;
}
export const button = (text, root) =>
  root.getByRole('button', {
    name: new RegExp('^' + [...text].join('\\s*') + '$'),
  });
export const modal = (page) =>
  page.getByRole('dialog').filter({ visible: true });
export const row = (page, id, table = 'tenant-table') =>
  page.getByTestId(table).locator('[data-row-key="' + id + '"]');
export async function shot(name, page) {
  await page.screenshot({
    path: fileURLToPath(new URL(name + '.png', output)),
    fullPage: true,
    animations: 'disabled',
    mask: [page.locator('[aria-label="账号链接"],input[type="password"]')],
  });
}
export async function response(page, path, method, action) {
  const pending = page.waitForResponse(
    (result) =>
      new URL(result.url()).pathname === '/api/v1' + path &&
      result.request().method() === method,
  );
  await action();
  const result = await pending;
  const envelope = result.status() === 204 ? {} : await result.json();
  if (result.status() >= 400)
    httpErrors.push({
      path,
      method,
      status: result.status(),
      code: envelope.code,
      message: envelope.message,
      traceId: envelope.trace_id,
    });
  return {
    status: result.status(),
    envelope,
    data: envelope.data,
    body: result.request().postDataJSON(),
  };
}
export async function login(page, username, password, tenantCode = 'default') {
  await page.goto(
    origin + '/auth/login?tenant=' + encodeURIComponent(tenantCode),
  );
  await page.getByLabel('企业代码', { exact: true }).fill(tenantCode);
  await page.getByLabel('账号', { exact: true }).fill(username);
  await page.getByPlaceholder('密码', { exact: true }).fill(password);
  const result = await response(page, '/auth/login', 'POST', () =>
    page.getByRole('button', { name: 'login', exact: true }).click(),
  );
  assert.equal(result.status, 200, 'UI login succeeded');
  assert.equal(result.body.tenant, tenantCode);
  assert.equal(result.body.account, username);
  assert.equal(Object.hasOwn(result.body, 'tenant_id'), false);
  secrets.add(result.data.access_token);
  secrets.add(result.data.refresh_token);
  await page.waitForURL((url) => !url.pathname.startsWith('/auth/'));
  return result.data;
}
export async function openTenants(page) {
  await page.goto(origin + '/system/tenants');
  await page.getByTestId('tenant-table').waitFor();
  await page
    .getByTestId('tenant-table')
    .locator('.ant-spin-spinning')
    .waitFor({ state: 'hidden' });
}
export async function templatesTab(page) {
  await page.getByRole('tab', { name: '租户模板', exact: true }).click();
  await page.getByTestId('tenant-template-table').waitFor();
}
export async function select(page, label, text) {
  await modal(page).getByLabel(label, { exact: true }).click();
  await page
    .locator('.ant-select-item-option-content')
    .filter({ hasText: text })
    .click();
}
export function check(item, assertion, evidence = {}) {
  checks.push({
    item,
    result: 'pass',
    source: 'real-backend-and-browser',
    assertion,
    ...evidence,
  });
  process.stdout.write('SF5 acceptance ' + item + ': passed\n');
}
export function summary(result) {
  return {
    status: result.status,
    code: result.envelope.code,
    message: result.envelope.message,
    traceId: result.envelope.trace_id,
  };
}
export function menuPaths(menus, parent = '') {
  return menus
    .flatMap((menu) => {
      const path = menu.path?.startsWith('/')
        ? menu.path
        : parent + '/' + (menu.path || '');
      if (
        menu.type === 'button' ||
        menu.visible === false ||
        menu.status === 'disabled'
      )
        return [];
      if (path === '/system/tenants' || path.startsWith('/system/tenants/'))
        return [];
      return [
        { path, name: menu.name, type: menu.type },
        ...menuPaths(menu.children || [], path),
      ];
    })
    .sort((a, b) => a.path.localeCompare(b.path));
}
export async function clean(resource, action) {
  try {
    await action();
    cleanup.push({ resource, result: 'restored-or-removed' });
  } catch (error) {
    cleanup.push({
      resource,
      result: 'failed',
      message: redact(error.message),
    });
  }
}
