import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve, sep } from 'node:path';
import process from 'node:process';
import { setTimeout } from 'node:timers/promises';

// eslint-disable-next-line n/no-extraneous-import -- Shared workspace test tooling.
import { chromium } from 'playwright';

import {
  api,
  button,
  login,
  origin,
  output,
  response,
  shot,
  summary,
} from './fe-ui-001-support.mjs';

assert.ok(process.env.FE_UI_ADMIN_PASSWORD, 'FE_UI_ADMIN_PASSWORD is required');
const admin = await login('admin', process.env.FE_UI_ADMIN_PASSWORD);
const browserProfile = await mkdtemp(join(tmpdir(), 'fe-ui-001-live-'));
const code = 'feui001_' + randomUUID().slice(0, 8);
const account = 'shell_admin';
const password = 'Shell123_' + randomUUID();
const report = {
  phase: 'a',
  checkedAt: new Date().toISOString(),
  source: 'real-18080-and-msedge',
  checks: [],
  browserErrors: [],
  rateLimitWaits: 0,
  cleanup: {},
};
let tenant;
let template;
let templateCreated = false;
let context;
let page;

async function open() {
  context = await chromium.launchPersistentContext(browserProfile, {
    headless: true,
    channel: 'msedge',
    viewport: { width: 1440, height: 1100 },
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
  });
  page = context.pages()[0] || (await context.newPage());
  page.on('pageerror', (error) => report.browserErrors.push(error.message));
  await page.goto(origin + '/auth/login');
  await page.getByLabel('企业代码', { exact: true }).waitFor();
}

async function submit(tenantCode, username, secret) {
  await page.getByLabel('企业代码', { exact: true }).fill(tenantCode);
  await page.getByLabel('账号', { exact: true }).fill(username);
  await page.getByLabel('密码', { exact: true }).fill(secret);
  let result;
  for (let attempt = 0; attempt < 4; attempt++) {
    result = await response(page, '/auth/login', 'POST', () =>
      page.getByRole('button', { name: 'login', exact: true }).click(),
    );
    if (result.status !== 429) break;
    report.rateLimitWaits++;
    await setTimeout(60_000);
  }
  return result;
}

try {
  const templates = await api(
    '/admin/tenant-templates?page_size=100',
    'GET',
    undefined,
    admin.access_token,
  );
  template = templates.list.find((item) => item.code === 'feui001_shell');
  if (!template) {
    template = await api(
      '/admin/tenant-templates',
      'POST',
      {
        source_tenant_id: 1,
        code: 'feui001_shell',
        name: 'FE-UI-001 验收模板',
        description: 'Default tenant menu snapshot for shell acceptance.',
      },
      admin.access_token,
    );
    templateCreated = true;
  }
  tenant = await api(
    '/admin/tenants',
    'POST',
    {
      code,
      name: 'FE-UI-001 验收 ' + code,
      template_id: template.id,
      admin_username: account,
      admin_email: code + '@example.test',
    },
    admin.access_token,
  );
  const invitation = new URL(tenant.invite_url, origin);
  await api('/auth/invite/accept', 'POST', {
    tenant_id: tenant.tenant_id,
    username: account,
    password,
    token: new URLSearchParams(invitation.hash.slice(1)).get('token'),
  });
  await open();
  const loginPayloads = [];
  const capture = (request) => {
    if (new URL(request.url()).pathname !== '/api/v1/auth/login') return;
    const data = request.postDataJSON();
    assert.deepEqual(Object.keys(data).sort(), [
      'account',
      'password',
      'tenant',
    ]);
    loginPayloads.push({
      tenant: data.tenant,
      fields: Object.keys(data).sort(),
    });
  };
  page.on('request', capture);
  assert.equal(
    await page.getByLabel('企业代码', { exact: true }).inputValue(),
    'default',
  );
  await shot('01-login-default-real', page);
  const platform = await submit(
    'default',
    'admin',
    process.env.FE_UI_ADMIN_PASSWORD,
  );
  assert.equal(platform.status, 200);
  await page.getByTestId('home-shortcuts').waitFor();
  assert.equal(
    (await page.getByTestId('current-tenant').textContent()).trim(),
    '租户：default',
  );
  await shot('04-header-default-real', page);
  await page
    .locator('button')
    .filter({ has: page.locator('svg.lucide-log-out') })
    .click();
  await button('确认', page.getByRole('dialog')).click();
  await page.waitForURL((url) => url.pathname === '/auth/login');
  const badTenant = await submit('missing_' + code, account, password);
  assert.equal(badTenant.status, 401);
  await page
    .getByText('企业代码、账号或密码错误', { exact: true })
    .last()
    .waitFor();
  const first = (
    await page.locator('.ant-message-error').last().textContent()
  ).trim();
  const badPassword = await submit(code, account, 'WrongPassword123');
  assert.equal(badPassword.status, 401);
  await page
    .getByText('企业代码、账号或密码错误', { exact: true })
    .last()
    .waitFor();
  const second = (
    await page.locator('.ant-message-error').last().textContent()
  ).trim();
  assert.equal(first, second);
  await shot('03-login-errors-real', page);
  report.checks.push({
    item: 3,
    status: 'pass',
    tenantFailure: summary(badTenant),
    passwordFailure: summary(badPassword),
    displayed: first,
  });
  await context.close();
  await open();
  page.on('request', capture);
  assert.equal(
    await page.getByLabel('企业代码', { exact: true }).inputValue(),
    code,
  );
  assert.equal(await page.getByLabel('密码', { exact: true }).inputValue(), '');
  assert.equal(await page.getByLabel('账号', { exact: true }).inputValue(), '');
  const storage = await page.evaluate(() =>
    Object.fromEntries(Object.entries(localStorage)),
  );
  assert.equal(storage['vben-web-antd:last-tenant-code'], code);
  const serialized = JSON.stringify(storage);
  for (const secret of [
    password,
    'WrongPassword123',
    account,
    platform.data.access_token,
    platform.data.refresh_token,
  ]) {
    assert.ok(!serialized.includes(secret), 'Credentials are not persisted');
  }
  await shot('02-login-browser-restarted-real', page);
  report.checks.push({
    item: 2,
    status: 'pass',
    browserProcessRestarted: true,
    rememberedTenant: code,
    passwordEmpty: true,
    accountEmpty: true,
    noCredentialsInLocalStorage: true,
  });
  const other = await submit(code, account, password);
  assert.equal(other.status, 200);
  await page.getByTestId('home-shortcuts').waitFor();
  const me = await api('/auth/me', 'GET', undefined, other.data.access_token);
  assert.equal(me.user.tenant_id, tenant.tenant_id);
  assert.equal(me.user.tenant_code, code);
  assert.equal(
    (await page.getByTestId('current-tenant').textContent()).trim(),
    '租户：' + code,
  );
  await shot('04-header-other-tenant-real', page);
  const menus = await api(
    '/auth/menus',
    'GET',
    undefined,
    other.data.access_token,
  );
  const paths = [];
  const collect = (items) => {
    for (const item of items) {
      if (item.path) paths.push(item.path);
      collect(item.children || []);
    }
  };
  collect(menus.menus);
  const shortcuts = await page
    .getByTestId('home-shortcuts')
    .getByRole('link')
    .evaluateAll((links) => links.map((link) => new URL(link.href).pathname));
  assert.ok(shortcuts.length > 0 && shortcuts.length <= 6);
  for (const path of shortcuts)
    assert.ok(paths.includes(path), 'Shortcut belongs to tenant menu: ' + path);
  await page.getByTestId('home-shortcuts').getByRole('link').first().click();
  await page.waitForURL((url) => url.pathname === shortcuts[0]);
  assert.equal(
    await page.getByText('404 · 页面不存在', { exact: true }).count(),
    0,
  );
  assert.equal(
    await page
      .getByText('抱歉，您没有权限访问此页面。', { exact: true })
      .count(),
    0,
  );
  await shot('01-other-tenant-menu-real', page);
  report.checks.push({
    item: 1,
    status: 'pass',
    defaultLogin: platform.status,
    otherLogin: other.status,
    otherTenant: { id: tenant.tenant_id, code },
    enteredMenu: shortcuts[0],
    shortcutPaths: shortcuts,
    exactPayloads: loginPayloads,
  });
  report.checks.push({
    item: 4,
    status: 'pass',
    defaultCode: 'default',
    otherCode: code,
    source: '/auth/me.user.tenant_code',
  });
  await api('/auth/logout', 'POST', undefined, other.data.access_token);
  assert.deepEqual(report.browserErrors, []);
} catch (error) {
  report.failure = error.message;
  if (page) await shot('failure-login-real', page);
  throw error;
} finally {
  await context?.close();
  if (tenant) {
    const disabled = await api(
      '/admin/tenants/' + tenant.tenant_id + '/disable',
      'POST',
      undefined,
      admin.access_token,
    );
    report.cleanup.tenant = {
      id: tenant.tenant_id,
      code,
      status: disabled.status,
      retainedReason: 'No tenant deletion API; disabled after acceptance.',
    };
    report.cleanup.template = {
      id: template.id,
      code: template.code,
      created: templateCreated,
      retainedReason: 'Referenced immutable snapshot.',
    };
  } else if (templateCreated) {
    await api(
      '/admin/tenant-templates/' + template.id,
      'DELETE',
      undefined,
      admin.access_token,
    );
    report.cleanup.unusedTemplateDeleted = true;
  }
  await api('/auth/logout', 'POST', undefined, admin.access_token);
  assert.ok(
    resolve(browserProfile).startsWith(resolve(tmpdir()) + sep) &&
      basename(browserProfile).startsWith('fe-ui-001-live-'),
  );
  await rm(browserProfile, { recursive: true, force: true });
  await writeFile(
    new URL('phase-a-real.json', output),
    JSON.stringify(report, null, 2),
  );
  process.stdout.write(JSON.stringify(report) + '\n');
}
