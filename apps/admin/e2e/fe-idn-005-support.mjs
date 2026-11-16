import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

// eslint-disable-next-line n/no-extraneous-import -- Workspace browser test tooling.
import { chromium } from 'playwright';

export const origin = process.env.FE_IDN_ORIGIN || 'http://127.0.0.1:5666';
export const pageUrl = (path) =>
  origin + (process.env.FE_IDN_HASH === '1' ? '/#' : '') + path;
const output = new URL('../../../docs/reports/fe-idn-005/', import.meta.url);
export const userAgent = 'FE-IDN-005 acceptance browser';
export async function session() {
  assert.ok(process.env.FE_IDN_ADMIN_PASSWORD, 'Set FE_IDN_ADMIN_PASSWORD');
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    channel: process.env.FE_IDN_BROWSER_CHANNEL || 'msedge',
  });
  const context = await browser.newContext({
    viewport: { width: 1700, height: 1100 },
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    userAgent,
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20_000);
  return { browser, context, page };
}
export const save = (name, value) =>
  writeFile(new URL(name, output), JSON.stringify(value, null, 2));
export const shot = (page, name) =>
  page.screenshot({
    path: fileURLToPath(new URL(name + '.png', output)),
    fullPage: true,
    animations: 'disabled',
  });
export const button = (page, label) =>
  page.getByRole('button', {
    name: new RegExp('^' + [...label].join('\\s*') + '$'),
  });
export async function login(page) {
  await page.goto(pageUrl('/auth/login'));
  await page.getByLabel('企业代码', { exact: true }).fill('default');
  await page.getByLabel('账号', { exact: true }).fill('admin');
  await page
    .getByPlaceholder('密码', { exact: true })
    .fill(process.env.FE_IDN_ADMIN_PASSWORD);
  const pending = page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === '/api/v1/auth/login' &&
      r.request().method() === 'POST',
  );
  await button(page, 'login').click();
  const response = await pending;
  assert.equal(response.status(), 200);
  const data = await response.json();
  await page.waitForURL(
    (url) => !url.pathname.startsWith('/auth') && !url.hash.includes('/auth'),
  );
  return data.data.access_token;
}
export async function list(page, action) {
  const pending = page
    .waitForResponse(
      (r) => new URL(r.url()).pathname === '/api/v1/admin/audit-logs',
    )
    .then(async (response) => {
      assert.equal(response.status(), 200);
      return {
        query: Object.fromEntries(new URL(response.url()).searchParams),
        ...(await response.json()).data,
      };
    });
  await action();
  const result = await pending;
  await page
    .getByTestId('audit-log-list')
    .locator('.ant-spin-spinning')
    .waitFor({ state: 'hidden' });
  if (result.list.length)
    await page.locator(`[data-row-key="${result.list[0].id}"]`).waitFor();
  return result;
}
export async function select(page, label, option) {
  await page.getByLabel(label, { exact: true }).click();
  if (label === '模块')
    await page.getByLabel(label, { exact: true }).locator('input').fill(option);
  await page
    .locator('.ant-select-dropdown:visible')
    .getByText(option, { exact: true })
    .click();
}
export async function timeRange(page, start, end) {
  for (const [label, value] of [
    ['开始时间', start],
    ['结束时间', end],
  ]) {
    const input = page.getByPlaceholder(label, { exact: true });
    await input.click();
    await input.press('ArrowRight');
    await input.fill(value);
    await input.press('Enter');
  }
}
export const row = (page, id) =>
  page.getByTestId('audit-log-list').locator(`tr[data-row-key="${id}"]`);
export async function expand(page, id) {
  const target = row(page, id);
  await target.locator('.ant-table-row-expand-icon').click();
  const details = target.locator('xpath=following-sibling::tr[1]');
  await details.getByTestId('audit-source').waitFor();
  return details;
}
const base = {
  actor_type: 'user',
  actor_id: 1,
  actor_name: 'admin',
  actor_tenant_name: 'default',
  action: 'system.tenant.rename',
  resource_type: 'tenant',
  resource_id: '2',
  resource_label: 'acme',
  before: null,
  after: null,
  result: 'success',
  error_code: null,
  error_message: null,
  ip: '192.0.2.9',
  user_agent: 'FE-IDN-005 response fixture',
  trace_id: 'fixture',
  created_at: '2026-11-16T02:00:00Z',
  truncated: false,
};
export const fixtureRows = [
  {
    id: 101,
    action: 'system.tenant.list',
    after: {
      accessed_tenants: Array.from({ length: 12 }, (_, i) => i + 2),
      count: 12,
    },
  },
  {
    id: 102,
    action: 'system.dict.update',
    resource_type: 'dict',
    resource_label: 'order_status',
    before: {
      name: '旧名称',
      same: true,
      password: '***',
      profile: { status: 'old', removed: true },
    },
    after: {
      name: '新名称',
      same: true,
      password: '***',
      profile: { status: 'new', added: null },
    },
  },
  {
    id: 103,
    action: 'system.user.create',
    resource_type: 'user',
    resource_label: 'sales01',
    after: { username: 'sales01', password: '***' },
  },
  {
    id: 104,
    action: 'system.user.delete',
    resource_type: 'user',
    resource_label: 'sales01',
    before: { username: 'sales01', status: 'disabled' },
  },
  {
    id: 105,
    before: { name: 'acme', enabled: false },
    after: { enabled: false, name: 'acme' },
  },
  {
    id: 106,
    actor_name: null,
    actor_tenant_name: null,
    actor_id: 7,
    resource_label: null,
    action: 'future.action',
    ip: '',
    user_agent: '',
  },
  {
    id: 107,
    action: 'system.dict.update',
    resource_type: 'dict',
    resource_label: 'order_status',
    result: 'failure',
    error_code: 20107,
    error_message: '没有权限执行此操作',
  },
  {
    id: 108,
    action: 'system.tenant.list',
    after: { accessed_tenants: [], count: 0 },
  },
  {
    id: 109,
    action: 'system.tenant.members',
    after: { accessed_tenants: [2], count: 8 },
  },
  {
    id: 110,
    before: { name: 'old' },
    after: { name: 'new', target_tenant: 'acme' },
  },
  {
    id: 111,
    before: { summary: '***' },
    after: { summary: '截断后的摘要 ***' },
    truncated: true,
  },
  ...Array.from({ length: 10 }, (_, i) => ({ id: 120 + i })),
].map((entry) => ({ ...base, ...entry }));

export async function fixtures(page, queries) {
  await page.route('**/api/v1/admin/audit-logs?*', async (route) => {
    const query = Object.fromEntries(
      new URL(route.request().url()).searchParams,
    );
    queries.push(query);
    const pageSize = Number(query.page_size || 20);
    const current = Number(query.page || 1);
    await route.fulfill({
      json: {
        code: 0,
        message: 'ok',
        data: {
          list: fixtureRows.slice((current - 1) * pageSize, current * pageSize),
          total: fixtureRows.length,
          page: current,
          page_size: pageSize,
        },
      },
    });
  });
}
