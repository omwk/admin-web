import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

// eslint-disable-next-line n/no-extraneous-import -- Workspace browser test tooling.
import { chromium } from 'playwright';

export const origin = process.env.FE_IDN_008_ORIGIN || 'http://127.0.0.1:5666';
const backend = process.env.FE_IDN_008_BACKEND || 'http://127.0.0.1:18080';
export const output = new URL(
  '../../../docs/evidence/fe-idn-008/',
  import.meta.url,
);
export const userAgents = [
  'FE-IDN-008 acceptance API',
  'FE-IDN-008 acceptance browser',
];
export const report = {
  task: 'FE-IDN-008',
  startedAt: new Date().toISOString(),
  checks: [],
  resources: { tenants: [], templates: [] },
  browserErrors: [],
};
export const secrets = new Set();
let adminToken;
export function redact(value) {
  let result = String(value);
  for (const secret of secrets)
    if (secret) result = result.replaceAll(secret, '[REDACTED]');
  return result.replaceAll(/#token=[^\s"'<>]+/g, '#token=[REDACTED]');
}
export async function persist() {
  await writeFile(
    new URL('acceptance.json', output),
    redact(JSON.stringify(report, null, 2)) + '\n',
  );
}
export async function record(
  item,
  assertion,
  evidence,
  source = 'real-backend-and-browser',
) {
  report.checks.push({ item, assertion, result: 'pass', source, ...evidence });
  await persist();
  process.stdout.write(`FE-IDN-008 acceptance ${item}: passed\n`);
}
export function rememberSecrets(data) {
  for (const key of ['access_token', 'refresh_token', 'invite_url']) {
    if (data?.[key]) secrets.add(data[key]);
  }
}
export async function request(path, method = 'GET', body, token = adminToken) {
  const result = await fetch(backend + '/api/v1' + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': userAgents[0],
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(20_000),
  });
  const envelope = result.status === 204 ? {} : await result.json();
  rememberSecrets(envelope.data);
  return {
    status: result.status,
    code: envelope.code,
    message: envelope.message,
    traceId: envelope.trace_id,
    data: envelope.data,
  };
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
    process.env.FE_IDN_008_ADMIN_PASSWORD,
    'Set FE_IDN_008_ADMIN_PASSWORD',
  );
  secrets.add(process.env.FE_IDN_008_ADMIN_PASSWORD);
  await mkdir(output, { recursive: true });
  return chromium.launch({
    headless: true,
    channel: process.env.FE_IDN_008_BROWSER_CHANNEL || 'msedge',
  });
}
export async function login(page) {
  await page.goto(origin + '/auth/login?tenant=default');
  await page.getByLabel('企业代码', { exact: true }).fill('default');
  await page.getByLabel('账号', { exact: true }).fill('admin');
  await page
    .getByPlaceholder('密码', { exact: true })
    .fill(process.env.FE_IDN_008_ADMIN_PASSWORD);
  const result = await response(page, '/auth/login', 'POST', () =>
    page.getByRole('button', { name: 'login', exact: true }).click(),
  );
  assert.equal(result.status, 200);
  adminToken = result.data.access_token;
  await page.waitForURL((url) => !url.pathname.startsWith('/auth/'));
}
export const button = (name, scope) =>
  scope.getByRole('button', {
    name: new RegExp('^' + [...name].join('\\s*') + '$'),
  });
export const modal = (page) =>
  page.getByRole('dialog').filter({ visible: true });
export const row = (page, id) =>
  page.getByTestId('tenant-table').locator(`[data-row-key="${id}"]`);
export async function response(page, path, method, action) {
  const pending = page.waitForResponse(
    (result) =>
      new URL(result.url()).pathname === '/api/v1' + path &&
      result.request().method() === method,
  );
  await action();
  const result = await pending;
  const envelope = result.status() === 204 ? {} : await result.json();
  rememberSecrets(envelope.data);
  return {
    status: result.status(),
    code: envelope.code,
    message: envelope.message,
    traceId: envelope.trace_id,
    data: envelope.data,
    url: new URL(result.url()),
    body: result.request().postDataJSON(),
  };
}
export const publicResult = ({ status, code, message, traceId }) => ({
  status,
  code,
  message,
  traceId,
});
export async function shot(name, page) {
  await page.screenshot({
    path: fileURLToPath(new URL(name + '.png', output)),
    fullPage: true,
    animations: 'disabled',
    mask: [page.locator('[aria-label="账号链接"],input[type="password"]')],
  });
}
export async function openTenants(page) {
  const result = await response(page, '/admin/tenants', 'GET', () =>
    page.goto(origin + '/system/tenants'),
  );
  await page.getByTestId('tenant-table').waitFor();
  await idle(page);
  return result;
}
export async function idle(page) {
  await page
    .getByTestId('tenant-table')
    .locator('.ant-spin-spinning')
    .waitFor({ state: 'hidden' });
}
export async function archivedFilter(page, checked) {
  const toggle = page.getByRole('switch', { name: '包含已归档', exact: true });
  if ((await toggle.getAttribute('aria-checked')) === String(checked)) return;
  const result = await response(page, '/admin/tenants', 'GET', () =>
    toggle.click(),
  );
  assert.equal(
    result.url.searchParams.get('include_archived'),
    checked ? 'true' : null,
  );
  await idle(page);
  return result;
}
