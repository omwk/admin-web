import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve, sep } from 'node:path';
import process from 'node:process';

// eslint-disable-next-line n/no-extraneous-import -- Shared workspace test tooling.
import { chromium } from 'playwright';

import { origin, output, shot } from './fe-ui-001-support.mjs';

const profile = await mkdtemp(join(tmpdir(), 'fe-ui-001-'));
const password = 'FixturePass123';
const account = 'account-ui-fixture';
const code = 'server-authoritative';
const pair = {
  access_token: 'fixture.eyJzaWQiOiJjdXJyZW50In0.signature',
  refresh_token: 'frontend-refresh-fixture',
  expires_in: 900,
  token_type: 'Bearer',
};
const overview = {
  user: {
    id: 9,
    username: account,
    nickname: '界面验收用户',
    email: 'fixture@example.test',
    phone: '13800000000',
    dept_id: 7,
    dept_name: '验收部门',
    tenant_id: 8,
    tenant_code: code,
    is_super: false,
    roles: [{ id: 1, code: 'operator', name: '运营' }],
  },
  permissions: ['system:user:list'],
};
const report = {
  source: 'frontend-response-fixtures-not-live-backend',
  checks: [],
  browserErrors: [],
};
let context;
let page;
async function open() {
  context = await chromium.launchPersistentContext(profile, {
    headless: true,
    channel: 'msedge',
    viewport: { width: 1440, height: 1100 },
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
  });
  await context.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const envelope = (data) => ({ code: 0, data, message: 'ok' });
    if (path.endsWith('/auth/login')) {
      const data = route.request().postDataJSON();
      assert.deepEqual(Object.keys(data).sort(), [
        'account',
        'password',
        'tenant',
      ]);
      if (data.tenant === 'missing-enterprise' || data.password !== password) {
        return route.fulfill({
          status: 401,
          json: {
            code: 20101,
            message:
              data.tenant === 'missing-enterprise' ? '企业不存在' : '密码错误',
          },
        });
      }
      return route.fulfill({ json: envelope(pair) });
    }
    if (path.endsWith('/auth/refresh'))
      return route.fulfill({ json: envelope(pair) });
    if (path.endsWith('/auth/me'))
      return route.fulfill({ json: envelope(overview) });
    if (path.endsWith('/auth/menus'))
      return route.fulfill({ json: envelope({ ...overview, menus: [] }) });
    if (path.endsWith('/auth/sessions'))
      return route.fulfill({
        json: envelope({
          list: [
            {
              sid: 'current',
              user_id: 9,
              created_at: '2026-11-14T01:00:00Z',
              ip: '192.0.2.1',
              user_agent: 'Microsoft Edge · current desktop',
            },
            {
              sid: 'other',
              user_id: 9,
              created_at: '2026-11-13T01:00:00Z',
              ip: '192.0.2.2',
              user_agent:
                'A long browser User-Agent used to verify truncation and the full tooltip: Firefox on another desktop device',
            },
          ],
          total: 2,
          page: 1,
          page_size: 20,
        }),
      });
    throw new Error('Unexpected API call in isolated UI fixture: ' + path);
  });
  page = context.pages()[0] || (await context.newPage());
  page.on('pageerror', (error) => report.browserErrors.push(error.message));
  await page.goto(origin + '/auth/login');
  await page.getByLabel('企业代码', { exact: true }).waitFor();
}
async function submit(tenant, secret) {
  await page.getByLabel('企业代码', { exact: true }).fill(tenant);
  await page.getByLabel('账号', { exact: true }).fill(account);
  await page.getByLabel('密码', { exact: true }).fill(secret);
  await page.getByRole('button', { name: 'login', exact: true }).click();
}
try {
  await open();
  assert.equal(
    await page.getByLabel('企业代码', { exact: true }).inputValue(),
    'default',
  );
  await shot('01-login-default-ui', page);
  await submit('missing-enterprise', password);
  await page
    .getByText('企业代码、账号或密码错误', { exact: true })
    .last()
    .waitFor();
  const first = await page.locator('.ant-message-error').last().textContent();
  await submit('acme', 'wrong-password-ui-fixture');
  await page
    .getByText('企业代码、账号或密码错误', { exact: true })
    .last()
    .waitFor();
  const second = await page.locator('.ant-message-error').last().textContent();
  assert.equal(first, second);
  await shot('03-login-errors-ui-fixture', page);
  report.checks.push({
    item: 3,
    status: 'pass-ui-fixture',
    message: first.trim(),
    distinctServerMessagesHidden: true,
    onlyThreeLoginFields: true,
  });
  await context.close();
  await open();
  assert.equal(
    await page.getByLabel('企业代码', { exact: true }).inputValue(),
    'acme',
  );
  assert.equal(await page.getByLabel('密码', { exact: true }).inputValue(), '');
  assert.equal(await page.getByLabel('账号', { exact: true }).inputValue(), '');
  const storage = await page.evaluate(() =>
    Object.fromEntries(Object.entries(localStorage)),
  );
  const serialized = JSON.stringify(storage);
  assert.equal(storage['vben-web-antd:last-tenant-code'], 'acme');
  for (const secret of [
    password,
    account,
    pair.access_token,
    pair.refresh_token,
    'wrong-password-ui-fixture',
  ]) {
    assert.ok(
      !serialized.includes(secret),
      'No credential or account is cached',
    );
  }
  assert.ok(
    !Object.keys(storage).some((key) =>
      key.startsWith('REMEMBER_ME_USERNAME_'),
    ),
  );
  await shot('02-login-browser-restarted-ui', page);
  report.checks.push({
    item: 2,
    status: 'pass',
    browserProcessRestarted: true,
    rememberedTenant: 'acme',
    passwordEmpty: true,
    noAccountOrCredentialsInLocalStorage: true,
  });
  await submit('acme', password);
  await page.getByTestId('home-welcome').waitFor();
  assert.equal(
    (await page.getByTestId('current-tenant').textContent()).trim(),
    '租户：' + code,
  );
  await shot('04-header-tenant-ui-fixture', page);
  report.checks.push({
    item: 4,
    status: 'pass-ui-fixture',
    submittedCode: 'acme',
    displayedCodeFromMe: code,
  });
  await page.goto(origin + '/profile');
  for (const [label, value] of [
    ['昵称', '界面验收用户'],
    ['邮箱', 'fixture@example.test'],
    ['手机', '13800000000'],
    ['部门', '验收部门'],
    ['角色', '运营'],
    ['租户', code],
  ]) {
    await page.getByLabel(label, { exact: true }).waitFor();
    assert.equal(
      await page.getByLabel(label, { exact: true }).inputValue(),
      value,
    );
  }
  await shot('05-profile-fields-ui-fixture', page);
  report.checks.push({
    item: 5,
    status: 'pass-ui-fixture',
    fieldsRenderedFromMe: [
      'nickname',
      'email',
      'phone',
      'dept_name',
      'roles',
      'tenant_code',
    ],
  });
  await page.goto(origin + '/profile/sessions');
  await page.getByRole('cell', { name: '192.0.2.1', exact: true }).waitFor();
  await page.getByRole('cell', { name: '当前', exact: true }).waitFor();
  await page.getByRole('cell', { name: '其他', exact: true }).waitFor();
  await page.getByText('A long browser User-Agent', { exact: false }).hover();
  await page
    .getByRole('tooltip')
    .getByText('A long browser User-Agent', { exact: false })
    .waitFor();
  await shot('09-sessions-metadata-ui-fixture', page);
  report.checks.push({
    item: 9,
    status: 'pass-ui-fixture',
    currentAndOther: true,
    ipAndUserAgent: true,
    fullUserAgentTooltip: true,
  });
  assert.deepEqual(report.browserErrors, []);
} catch (error) {
  report.failure = error.message;
  if (page) await shot('failure-login-ui', page);
  throw error;
} finally {
  await context?.close();
  assert.ok(
    resolve(profile).startsWith(resolve(tmpdir()) + sep) &&
      basename(profile).startsWith('fe-ui-001-'),
  );
  await rm(profile, { recursive: true, force: true });
  await writeFile(
    new URL('phase-a-ui.json', output),
    JSON.stringify(report, null, 2),
  );
  process.stdout.write(JSON.stringify(report) + '\n');
}
