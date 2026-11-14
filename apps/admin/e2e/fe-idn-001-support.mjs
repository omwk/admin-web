import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

// eslint-disable-next-line n/no-extraneous-import -- Workspace browser test tooling.
import { chromium } from 'playwright';

export const origin = process.env.FE_IDN_ORIGIN || 'http://127.0.0.1:5668';
const hashRouting = process.env.FE_IDN_ROUTER_MODE !== 'history';
const pageURL = (path) => origin + (hashRouting ? '/#' : '') + path;
const backend = process.env.FE_IDN_BACKEND || 'http://127.0.0.1:18080';
export const output = new URL(
  '../../../docs/evidence/fe-idn-001/',
  import.meta.url,
);
export const checks = [];
export const browserErrors = [];
export const secrets = new Set();
let adminToken;
export function redact(value) {
  let text = String(value);
  for (const secret of secrets)
    if (secret) text = text.replaceAll(secret, '[REDACTED]');
  return text.replaceAll(/#token=[^\s"'<>]+/g, '#token=[REDACTED]');
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
  return { status: response.status, code: envelope.code, data: envelope.data };
}
export async function api(path, method = 'GET', body, bearer = adminToken) {
  const result = await request(path, method, body, bearer);
  assert.ok(
    result.status >= 200 && result.status < 300,
    method + ' ' + path + ': ' + result.status + '/' + result.code,
  );
  return result.data;
}
export async function setup() {
  assert.ok(process.env.FE_IDN_ADMIN_PASSWORD, 'Set FE_IDN_ADMIN_PASSWORD');
  secrets.add(process.env.FE_IDN_ADMIN_PASSWORD);
  const auth = await api(
    '/auth/login',
    'POST',
    {
      tenant: 'default',
      account: 'admin',
      password: process.env.FE_IDN_ADMIN_PASSWORD,
    },
    null,
  );
  adminToken = auth.access_token;
  secrets.add(adminToken);
  secrets.add(auth.refresh_token);
  await mkdir(output, { recursive: true });
  return chromium.launch({
    headless: true,
    channel: process.env.FE_IDN_BROWSER_CHANNEL || 'msedge',
  });
}
export async function login(page) {
  await page.goto(pageURL('/auth/login?tenant=default'));
  await page.getByLabel('企业代码', { exact: true }).fill('default');
  await page.getByLabel('账号', { exact: true }).fill('admin');
  await page
    .getByPlaceholder('密码', { exact: true })
    .fill(process.env.FE_IDN_ADMIN_PASSWORD);
  const result = await response(page, '/auth/login', 'POST', () =>
    page.getByRole('button', { name: 'login', exact: true }).click(),
  );
  assert.equal(result.status, 200);
  secrets.add(result.data.access_token);
  secrets.add(result.data.refresh_token);
  await page.waitForURL(
    (url) =>
      !(hashRouting ? url.hash.slice(1) : url.pathname).startsWith('/auth/'),
  );
}
export const button = (text, root) =>
  root.getByRole('button', {
    name: new RegExp('^' + [...text].join('\\s*') + '$'),
  });
export const modal = (page) =>
  page.getByRole('dialog').filter({ visible: true });
export const row = (page, id) =>
  page.getByTestId('tenant-table').locator('[data-row-key="' + id + '"]');
export async function openTenants(page) {
  const targetURL = pageURL('/system/tenants');
  await response(page, '/admin/tenants', 'GET', () =>
    page.url() === targetURL ? page.reload() : page.goto(targetURL),
  );
  await page.getByTestId('tenant-table').waitFor();
  await page
    .getByTestId('tenant-table')
    .locator('.ant-spin-spinning')
    .waitFor({ state: 'hidden' });
}
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
    (item) =>
      new URL(item.url()).pathname === '/api/v1' + path &&
      item.request().method() === method,
  );
  await action();
  const result = await pending;
  const envelope = await result.json();
  return {
    status: result.status(),
    code: envelope.code,
    data: envelope.data,
    url: new URL(result.url()),
  };
}
export function invitation(page) {
  return page
    .getByLabel('账号链接')
    .inputValue()
    .then((value) => {
      secrets.add(value);
      secrets.add(new URL(value).hash.slice(7));
      return value;
    });
}
export async function closeLink(page) {
  await modal(page).locator('.ant-modal-close').click();
  await modal(page).waitFor({ state: 'hidden' });
}
export function check(item, assertion, evidence) {
  checks.push({ item, result: 'pass', assertion, ...evidence });
  process.stdout.write('FE-IDN-001 acceptance ' + item + ': passed\n');
}
