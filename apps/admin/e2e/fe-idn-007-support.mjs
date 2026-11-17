import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

// eslint-disable-next-line n/no-extraneous-import -- Workspace browser test tooling.
import { chromium } from 'playwright';

export const origin = process.env.FE_IDN_007_ORIGIN || 'http://127.0.0.1:5666';
const backend = process.env.FE_IDN_007_BACKEND || 'http://127.0.0.1:18080';
export const output = new URL(
  '../../../docs/evidence/fe-idn-007/',
  import.meta.url,
);
export const report = {
  startedAt: new Date().toISOString(),
  checks: [],
  resources: { templates: [], tenants: [] },
  browserErrors: [],
  cleanup: [],
};
export const secrets = new Set();
let adminToken;
export const setAdminToken = (token) => {
  adminToken = token;
  secrets.add(token);
};
export function redact(value) {
  let result = String(value);
  for (const secret of secrets)
    if (secret) result = result.replaceAll(secret, '[REDACTED]');
  return result.replaceAll(
    /(?:#token=|%23token%3D)[^\s"'<>]+/g,
    '#token=[REDACTED]',
  );
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
  evidence = {},
  source = 'real-backend-and-browser',
) {
  report.checks.push({ item, assertion, source, result: 'pass', ...evidence });
  await persist();
  process.stdout.write(`FE-IDN-007 acceptance ${item}: passed\n`);
}
export async function request(path, method = 'GET', body, bearer = adminToken) {
  const result = await fetch(backend + '/api/v1' + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'FE-IDN-007 acceptance API',
      ...(bearer ? { Authorization: 'Bearer ' + bearer } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(20_000),
  });
  const envelope = result.status === 204 ? {} : await result.json();
  return {
    status: result.status,
    code: envelope.code,
    message: envelope.message,
    traceId: envelope.trace_id,
    data: envelope.data,
  };
}
export async function api(path, method = 'GET', body, bearer = adminToken) {
  const result = await request(path, method, body, bearer);
  assert.ok(
    result.status >= 200 && result.status < 300,
    `${method} ${path}: ${result.status}/${result.code}`,
  );
  return result.data;
}
export async function setup() {
  assert.ok(
    process.env.FE_IDN_007_ADMIN_PASSWORD,
    'Set FE_IDN_007_ADMIN_PASSWORD',
  );
  secrets.add(process.env.FE_IDN_007_ADMIN_PASSWORD);
  await mkdir(output, { recursive: true });
  return chromium.launch({
    headless: true,
    channel: process.env.FE_IDN_007_BROWSER_CHANNEL || 'msedge',
  });
}
export async function context(browser) {
  const result = await browser.newContext({
    userAgent: 'FE-IDN-007 acceptance browser',
    viewport: { width: 1600, height: 1100 },
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
  });
  result.on('page', (page) =>
    page.on('pageerror', (error) =>
      report.browserErrors.push(redact(error.message)),
    ),
  );
  return result;
}
export const button = (text, scope) =>
  scope.getByRole('button', {
    name: new RegExp('^' + [...text].join('\\s*') + '$'),
  });
export const modal = (page) =>
  page.getByRole('dialog').filter({ visible: true });
export const row = (page, id) =>
  page.getByTestId('tenant-template-table').locator(`[data-row-key="${id}"]`);
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
  if (envelope.data?.access_token) secrets.add(envelope.data.access_token);
  if (envelope.data?.refresh_token) secrets.add(envelope.data.refresh_token);
  if (envelope.data?.invite_url) secrets.add(envelope.data.invite_url);
  return {
    status: result.status(),
    code: envelope.code,
    traceId: envelope.trace_id,
    data: envelope.data,
    body: result.request().postDataJSON(),
  };
}
export async function login(page, account, password, tenant = 'default') {
  await page.goto(origin + '/auth/login?tenant=' + encodeURIComponent(tenant));
  await page.getByLabel('企业代码', { exact: true }).fill(tenant);
  await page.getByLabel('账号', { exact: true }).fill(account);
  await page.getByPlaceholder('密码', { exact: true }).fill(password);
  const result = await response(page, '/auth/login', 'POST', () =>
    page.getByRole('button', { name: 'login', exact: true }).click(),
  );
  assert.equal(result.status, 200, 'UI login succeeded');
  await page.waitForURL((url) => !url.pathname.startsWith('/auth/'));
  return result.data;
}
export async function templates(page) {
  await page.goto(origin + '/system/tenants/templates');
  await page.getByTestId('tenant-template-table').waitFor();
  await page
    .getByTestId('tenant-template-table')
    .locator('.ant-spin-spinning')
    .waitFor({ state: 'hidden' });
}
export async function select(page, label, text, scope = modal(page)) {
  await scope.getByLabel(label, { exact: true }).click();
  await page
    .locator('.ant-select-item-option-content')
    .getByText(text, { exact: true })
    .click();
}
export async function remember(kind, value) {
  report.resources[kind].push({ id: value.id, code: value.code });
  await persist();
}
export async function blank(page, code, name) {
  await templates(page);
  await button('新建空白模板', page).click();
  await modal(page).getByLabel('模板 Code', { exact: true }).fill(code);
  await modal(page).getByLabel('模板名称', { exact: true }).fill(name);
  const created = await response(page, '/admin/tenant-templates', 'POST', () =>
    button('创建并编辑', modal(page)).click(),
  );
  assert.equal(created.status, 201);
  await remember('templates', created.data);
  assert.equal(Object.hasOwn(created.body, 'source_tenant_id'), false);
  await page.waitForURL(
    origin + '/system/tenants/templates/' + created.data.id,
  );
  await page.getByTestId('template-editor').waitFor();
  return created;
}
export async function save(page, id) {
  const result = await response(
    page,
    '/admin/tenant-templates/' + id,
    'PUT',
    () => button('保存模板', page).click(),
  );
  assert.equal(result.status, 200);
  assert.equal(typeof result.body.name, 'string');
  assert.ok(Array.isArray(result.body.roles));
  await button('保存模板', page).waitFor({ state: 'visible' });
  await page.getByText('未保存', { exact: true }).waitFor({ state: 'hidden' });
  return result;
}
export async function provision(page, template, code, zero = false) {
  await page.goto(origin + '/system/tenants');
  await page.getByTestId('tenant-table').waitFor();
  await button('开通租户', page).click();
  await modal(page).getByLabel('租户 Code', { exact: true }).fill(code);
  await modal(page)
    .getByLabel('租户名称', { exact: true })
    .fill('FE-IDN-007 验收租户');
  await button('下一步', modal(page)).click();
  await select(
    page,
    '租户模板',
    `${template.name}（${template.roles.length} 个角色）`,
  );
  await modal(page)
    .getByLabel('管理员用户名', { exact: true })
    .fill(code + '_admin');
  assert.equal(await button('确认开通', modal(page)).isEnabled(), true);
  if (zero) {
    await modal(page)
      .getByText('该模板不含角色，开通后除管理员外没有其他角色可用。', {
        exact: true,
      })
      .waitFor();
    await shot('10-zero-role-warning-real', page);
  }
  const created = await response(page, '/admin/tenants', 'POST', () =>
    button('确认开通', modal(page)).click(),
  );
  assert.equal(created.status, 201);
  await remember('tenants', { id: created.data.tenant_id, code });
  const invitation = await modal(page)
    .getByLabel('账号链接', { exact: true })
    .inputValue();
  secrets.add(invitation);
  secrets.add(new URL(invitation).hash.slice(7));
  await shot(
    zero ? '10-zero-role-provisioned-real' : '08-provisioned-real',
    page,
  );
  await modal(page).locator('.ant-modal-close').click();
  return {
    id: created.data.tenant_id,
    invitation,
    status: created.status,
    traceId: created.traceId,
  };
}
