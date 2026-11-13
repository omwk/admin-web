import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

// eslint-disable-next-line n/no-extraneous-import -- Existing workspace browser tooling.
import { chromium } from 'playwright';

import {
  api,
  bootstrap,
  localSMTP,
  login,
  origin,
  password,
  relay,
  responses,
  sql,
} from './sf2-real-support.mjs';
assert.ok(
  process.env.SF2_SMOKE_HELPER,
  'Require isolated sf2-real.ps1 runtime',
);
const output = new URL('../../../docs/evidence/sf-2/', import.meta.url);
await mkdir(output, { recursive: true });
const checks = [];
const errors = [];
const transport = await localSMTP();
const browser = await chromium.launch({
  headless: true,
  channel: process.env.SF2_BROWSER_CHANNEL || 'msedge',
});
const context = await browser.newContext({
  locale: 'zh-CN',
  viewport: { width: 1540, height: 1020 },
});
await relay(context);
const page = await context.newPage();
page.on('pageerror', (error) => errors.push(error.message));
const shot = (name) =>
  page.screenshot({
    path: fileURLToPath(new URL(name + '.png', output)),
    fullPage: true,
    animations: 'disabled',
  });
const check = (item, assertion, evidence, detail) =>
  checks.push({
    item,
    result: 'pass',
    source: 'real-isolated-backend',
    assertion,
    evidence,
    detail,
  });
const modal = () => page.locator('.ant-modal:visible');
async function saveModal() {
  await modal()
    .getByRole('button', { name: /确\s*定/ })
    .click();
  await modal().waitFor({ state: 'hidden' });
}
async function choose(label, text) {
  await page.getByLabel(label, { exact: true }).click();
  await page
    .locator('.ant-select-dropdown:visible')
    .getByText(text, { exact: true })
    .click();
}
async function createProvider(name) {
  await page.getByRole('button', { name: '新增服务商', exact: true }).click();
  const form = page.getByTestId('notification-provider-form');
  const secret = randomBytes(20).toString('hex');
  await form
    .getByLabel('SMTP 用户名', { exact: true })
    .fill(randomBytes(8).toString('hex'));
  await form.getByLabel('服务商名称', { exact: true }).fill(name);
  await form
    .getByLabel('SMTP 地址（host:port）', { exact: true })
    .fill(transport.address);
  await form.getByLabel('SMTP 密码', { exact: true }).fill(secret);
  await form
    .getByLabel('发件人邮箱', { exact: true })
    .fill(randomBytes(6).toString('hex') + '@example.invalid');
  await choose('TLS 模式', '本机明文（仅回环地址）');
  await saveModal();
  const provider = (await api('/admin/notifications/providers')).list.find(
    (value) => value.name === name,
  );
  assert.ok(
    provider?.config.password_configured,
    'Stored provider has configured flag',
  );
  assert.ok(
    !JSON.stringify(provider).includes(secret),
    'Real API does not echo secret',
  );
  assert.ok(
    !(await page.content()).includes(secret),
    'Saved markup does not echo secret',
  );
  return provider;
}
let failure;
try {
  await bootstrap();
  const me = await api('/auth/me');
  assert.ok(me.permissions.includes('system:notify:manage'));
  sql(
    "WITH changed AS (UPDATE sys_user SET email=$1 WHERE id=$2 RETURNING id) SELECT jsonb_build_object('updated',count(*)) FROM changed",
    [randomBytes(8).toString('hex') + '@example.invalid', me.user.id],
  );
  const seeded = sql(
    `WITH added AS (INSERT INTO notification(tenant_id,channel,target,template,payload,status,read_at,created_at)
    SELECT 1,'inbox','user:'||$1::bigint::text,'notification.default',jsonb_build_object('summary','真实通知 '||g::text,'detail','<script>window.sf2Unsafe=true</script>'),'sent',CASE WHEN g>23 THEN now() ELSE NULL END,now()-g*interval '1 minute'
    FROM generate_series(1,25) AS g RETURNING id) SELECT jsonb_build_object('inserted',count(*)) FROM added`,
    [me.user.id],
  );
  assert.equal(seeded.inserted, 25);
  await login(page);
  await page.goto(origin + '/system/notifications');
  await page.getByRole('cell', { name: '真实通知 1', exact: true }).waitFor();
  assert.equal(await page.locator('[data-notification-id]').count(), 20);
  assert.ok(
    (
      await page.locator('[data-notification-id]').first().getAttribute('class')
    ).includes('font-semibold'),
  );
  await page.getByTitle('2', { exact: true }).click();
  await page.getByText('真实通知 21', { exact: true }).waitFor();
  assert.equal(await page.locator('[data-notification-id]').count(), 5);
  await shot('01-inbox-real');
  check(
    1,
    'Real API returns 25 persisted notifications; unread bold; pagination 20/5',
    '01-inbox-real.png',
    { inserted: 25, pages: [20, 5] },
  );
  await choose('通知状态', '未读');
  await page.getByRole('cell', { name: '真实通知 1', exact: true }).waitFor();
  await page
    .getByRole('button', { name: '通知中心，23 条未读', exact: true })
    .waitFor();
  assert.equal((await api('/admin/notifications?unread=true')).total, 23);
  await shot('02-unread-real');
  check(2, 'Unread filter/API total and badge equal 23', '02-unread-real.png');
  await page.getByRole('cell', { name: '真实通知 1', exact: true }).click();
  await page
    .getByRole('button', { name: '通知中心，22 条未读', exact: true })
    .waitFor();
  assert.equal((await api('/admin/notifications/unread-count')).count, 22);
  assert.equal(await page.evaluate(() => window.sf2Unsafe), undefined);
  await shot('03-read-real');
  check(
    3,
    'Click persists read_at, badge 23 to 22, payload escaped',
    '03-read-real.png',
  );
  await page.getByRole('button', { name: '全部已读', exact: true }).click();
  await page
    .getByRole('button', { name: '通知中心，0 条未读', exact: true })
    .waitFor();
  assert.equal((await api('/admin/notifications?unread=true')).total, 0);
  await choose('通知状态', '全部');
  await page.getByRole('cell', { name: '真实通知 1', exact: true }).waitFor();
  assert.equal(
    await page.locator('[data-notification-id].font-semibold').count(),
    0,
  );
  await shot('04-read-all-real');
  check(
    4,
    'Read-all persists zero unread; visible rows all read',
    '04-read-all-real.png',
  );
  await page.getByRole('button', { name: '通知渠道', exact: true }).click();
  await page
    .getByText('尚未配置通知渠道，配置后才能发送邮件', { exact: true })
    .waitFor();
  const crud = await createProvider('SF2 CRUD SMTP');
  const crudRow = page.locator('[data-provider-id="' + crud.id + '"]');
  await crudRow.getByRole('button', { name: '编辑', exact: true }).click();
  const form = page.getByTestId('notification-provider-form');
  assert.equal(
    await form.getByLabel('SMTP 密码', { exact: true }).inputValue(),
    '',
  );
  assert.equal(
    await form
      .getByLabel('SMTP 密码', { exact: true })
      .getAttribute('placeholder'),
    '已配置',
  );
  await form.getByLabel('服务商名称', { exact: true }).fill('SF2 SMTP 已编辑');
  await shot('07-provider-private-real');
  await saveModal();
  await crudRow.getByText('SF2 SMTP 已编辑', { exact: true }).waitFor();
  await crudRow.getByRole('button', { name: '删除', exact: true }).click();
  await page
    .locator('.ant-modal-confirm:visible')
    .getByRole('button', { name: /取\s*消/ })
    .click();
  assert.equal((await api('/admin/notifications/providers')).total, 1);
  await crudRow.getByRole('button', { name: '删除', exact: true }).click();
  await page
    .locator('.ant-modal-confirm:visible')
    .getByRole('button', { name: /确\s*定/ })
    .click();
  await crudRow.waitFor({ state: 'hidden' });
  assert.equal((await api('/admin/notifications/providers')).total, 0);
  check(
    7,
    'SMTP create/update/delete and cancel; API/markup configured flags only',
    '07-provider-private-real.png',
  );
  const provider = await createProvider('SF2 SMTP 发送');
  await page.goto(origin + '/system/notifications');
  await page.getByRole('tab', { name: '通知偏好', exact: true }).click();
  const preference = page.locator(
    '[data-preference="notification.default:email"]',
  );
  await preference.getByText('继承租户设置', { exact: false }).waitFor();
  assert.equal(await preference.getByRole('switch').isDisabled(), true);
  assert.equal(
    await preference.getByRole('switch').getAttribute('aria-checked'),
    'true',
  );
  await shot('05-inheritance-real');
  check(
    5,
    'Unset personal preference inherits enabled tenant SMTP setting and is gray',
    '05-inheritance-real.png',
  );
  await preference.getByRole('button', { name: '自定义', exact: true }).click();
  await preference.getByRole('switch').click();
  const written = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname.endsWith('/notifications/preferences') &&
      request.method() === 'PUT',
  );
  await page.getByRole('button', { name: '保存偏好', exact: true }).click();
  assert.deepEqual((await written).postDataJSON(), {
    preferences: [
      { template: 'notification.default', channel: 'email', enabled: false },
    ],
  });
  await page.getByText('通知偏好已保存', { exact: true }).waitFor();
  await page.reload();
  await page.getByRole('tab', { name: '通知偏好', exact: true }).click();
  await preference.getByRole('switch').waitFor();
  assert.equal(
    await preference.getByRole('switch').getAttribute('aria-checked'),
    'false',
  );
  const saved = (
    await api('/admin/notifications/preferences')
  ).preferences.find(
    (value) =>
      value.template === 'notification.default' && value.channel === 'email',
  );
  assert.deepEqual(saved, {
    template: 'notification.default',
    channel: 'email',
    enabled: false,
    inherited: false,
  });
  await shot('06-preference-saved-real');
  check(
    6,
    'Only email=false pair submitted; reload/API persist false; inbox reminder',
    '06-preference-saved-real.png',
  );
  await page.getByRole('button', { name: '通知渠道', exact: true }).click();
  const providerRow = page.locator('[data-provider-id="' + provider.id + '"]');
  await providerRow
    .getByRole('button', { name: '测试发送', exact: true })
    .click();
  await page
    .getByRole('button', { name: '发送给当前账号', exact: true })
    .click();
  await page
    .getByTestId('notification-provider-test')
    .getByText('已发送，请查收', { exact: true })
    .waitFor();
  assert.equal(transport.state.received, 1);
  await shot('08-test-sent-real');
  await modal()
    .getByRole('button', { name: /关\s*闭/ })
    .click();
  transport.state.reject = true;
  await providerRow
    .getByRole('button', { name: '测试发送', exact: true })
    .click();
  await page
    .getByRole('button', { name: '发送给当前账号', exact: true })
    .click();
  await page
    .getByTestId('notification-provider-test')
    .getByText('失败原因：provider_delivery_failed', { exact: true })
    .waitFor();
  await shot('08-test-failed-real');
  await modal()
    .getByRole('button', { name: /关\s*闭/ })
    .click();
  check(
    8,
    'Current-account real loopback SMTP success; rejection displays backend reason',
    ['08-test-sent-real.png', '08-test-failed-real.png'],
    { smtp_received: 1 },
  );
  await page.getByRole('tab', { name: '模板', exact: true }).click();
  const templateRow = page
    .locator('tr')
    .filter({ has: page.getByText('notification.default', { exact: true }) });
  await templateRow.getByRole('button', { name: '编辑', exact: true }).click();
  await page.getByLabel('模板主题', { exact: true }).fill('SF2 真实模板已编辑');
  await page
    .getByLabel('模板正文', { exact: true })
    .fill('{{.Name}}，通知内容。');
  await saveModal();
  await page.getByText('SF2 真实模板已编辑', { exact: true }).waitFor();
  await shot('09-template-real');
  await page.getByRole('tab', { name: '投递记录', exact: true }).click();
  const failed = (await api('/admin/notifications/deliveries')).list.find(
    (value) => value.status === 'failed',
  );
  assert.equal(failed.attempts, 1);
  const deliveryRow = page.locator('[data-delivery-id="' + failed.id + '"]');
  await deliveryRow
    .getByText('provider_delivery_failed', { exact: true })
    .waitFor();
  assert.ok(
    !(await page.getByTestId('notification-deliveries').textContent()).includes(
      '@example.invalid',
    ),
    'No full recipient',
  );
  transport.state.reject = false;
  await deliveryRow.getByRole('button', { name: '重试', exact: true }).click();
  await deliveryRow.getByText('已发送', { exact: true }).waitFor();
  const retried = (await api('/admin/notifications/deliveries')).list.find(
    (value) => value.id === failed.id,
  );
  assert.equal(retried.status, 'sent');
  assert.equal(retried.attempts, 2);
  await shot('09-delivery-retry-real');
  check(
    9,
    'Real retry persists sent and attempts 1 to 2; hash/domain; template override',
    ['09-delivery-retry-real.png', '09-template-real.png'],
    { before_attempts: 1, after_attempts: 2 },
  );
  const role = await api(
    '/admin/roles',
    'POST',
    {
      code: 'sf2_readonly',
      name: 'SF2 只读',
      data_scope: 'self',
      remark: null,
      status: 'active',
    },
    undefined,
    201,
  );
  const permissions = Object.values(await api('/admin/permissions')).flat();
  await api('/admin/roles/' + role.id + '/permissions', 'PUT', {
    permission_ids: [
      permissions.find((value) => value.code === 'system:notify:list').id,
    ],
  });
  const flatten = (nodes) =>
    nodes.flatMap((node) => [node, ...flatten(node.children || [])]);
  const menus = flatten(await api('/admin/menus'));
  await api('/admin/roles/' + role.id + '/menus', 'PUT', {
    menu_ids: menus
      .filter((value) =>
        [
          '/system',
          '/system/notifications',
          '/system/notifications/channels',
        ].includes(value.path),
      )
      .map((value) => value.id),
  });
  const readonlyPassword = password();
  const user = await api(
    '/admin/users',
    'POST',
    {
      username: 'sf2_readonly',
      password: password(),
      dept_id: 1,
      avatar: null,
      nickname: 'SF2 只读',
      email: null,
      status: 'active',
    },
    undefined,
    201,
  );
  await api('/admin/users/' + user.id + '/roles', 'PUT', {
    role_ids: [role.id],
  });
  const reset = new URL(
    (
      await api(
        '/admin/users/' + user.id + '/reset-link',
        'POST',
        undefined,
        undefined,
        201,
      )
    ).link,
    origin,
  );
  await api(
    '/auth/password/reset',
    'POST',
    {
      tenant_id: Number(reset.searchParams.get('tenant_id')),
      token: new URLSearchParams(reset.hash.slice(1)).get('token'),
      newPassword: readonlyPassword,
    },
    null,
    204,
  );
  const readonlyToken = (
    await api(
      '/auth/login',
      'POST',
      { username: 'sf2_readonly', password: readonlyPassword },
      null,
    )
  ).access_token;
  await api(
    '/admin/notifications/providers',
    'GET',
    undefined,
    readonlyToken,
    403,
  );
  const readContext = await browser.newContext({
    locale: 'zh-CN',
    viewport: { width: 1540, height: 1020 },
  });
  await relay(readContext);
  const readPage = await readContext.newPage();
  await login(readPage, 'sf2_readonly', readonlyPassword);
  await readPage.goto(origin + '/system/notifications');
  await readPage.getByRole('tab', { name: '站内通知', exact: true }).waitFor();
  assert.equal(
    await readPage
      .getByRole('button', { name: '通知渠道', exact: true })
      .count(),
    0,
  );
  assert.equal(
    await readPage
      .locator('aside')
      .getByText('通知渠道', { exact: true })
      .count(),
    0,
  );
  await readPage.screenshot({
    path: fileURLToPath(new URL('10-read-only-real.png', output)),
    fullPage: true,
    animations: 'disabled',
  });
  await readPage.goto(origin + '/system/notifications/channels');
  await readPage.waitForLoadState('networkidle');
  assert.equal(await readPage.getByTestId('notification-providers').count(), 0);
  await readContext.close();
  check(
    10,
    'Real read-only role has no channels menu/toolbar/view; real providers HTTP 403',
    '10-read-only-real.png',
    { api_status: 403 },
  );
  assert.deepEqual(errors, [], 'No browser runtime errors');
} catch (error) {
  failure = error;
  await shot('failure-real');
} finally {
  await writeFile(
    new URL('real-ui.json', output),
    JSON.stringify(
      {
        source: 'real-isolated-backend',
        backend_revision: process.env.SF2_BACKEND_REV,
        note: 'Actual S3a API/PostgreSQL/Redis with isolated test data and real loopback SMTP; notification APIs are not mocked.',
        checks,
        errors,
        responses,
        failure: failure?.message,
      },
      null,
      2,
    ),
  );
  await browser.close();
  await transport.close();
}
if (failure) {
  console.error(failure.message);
  process.exitCode = 1;
} else
  console.log(
    JSON.stringify({
      source: 'real-isolated-backend',
      passed: checks.length,
      browserErrors: errors.length,
    }),
  );
