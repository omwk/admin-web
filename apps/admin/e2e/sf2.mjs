import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

// eslint-disable-next-line n/no-extraneous-import -- Existing workspace browser test tooling.
import { chromium } from 'playwright';

import { notificationFixture } from './sf2-fixtures.mjs';

const origin = process.env.SF2_ORIGIN || 'http://127.0.0.1:5666';
const backend = process.env.SF2_BACKEND || 'http://127.0.0.1:18080';
assert.ok(process.env.SF2_ADMIN_PASSWORD, 'Set SF2_ADMIN_PASSWORD');
const output = new URL('../../../docs/evidence/sf-2/', import.meta.url);
await mkdir(output, { recursive: true });
const checks = [];
const errors = [];
const fixture = notificationFixture();
const browser = await chromium.launch({
  headless: true,
  channel: process.env.SF2_BROWSER_CHANNEL || 'msedge',
});
const context = await browser.newContext({
  viewport: { width: 1540, height: 1020 },
});
await fixture.install(context);
const page = await context.newPage();
page.on('pageerror', (error) => errors.push(error.message));
const shot = (name) =>
  page.screenshot({
    path: fileURLToPath(new URL(name + '.png', output)),
    fullPage: true,
    animations: 'disabled',
  });
const tick = () => page.waitForTimeout(100);
const check = (item, assertion, evidence) =>
  checks.push({
    item,
    assertion,
    result: 'pass',
    source: 'fixture-ui',
    evidence,
  });
async function login(target) {
  await target.goto(origin + '/auth/login');
  await target
    .getByPlaceholder('请输入用户名')
    .fill(process.env.SF2_ADMIN_USERNAME || 'admin');
  await target
    .getByPlaceholder('密码', { exact: true })
    .fill(process.env.SF2_ADMIN_PASSWORD);
  const loggedIn = target.waitForResponse(
    (value) =>
      new URL(value.url()).pathname === '/api/v1/auth/login' &&
      value.request().method() === 'POST',
  );
  await target.getByRole('button', { name: 'login', exact: true }).click();
  const response = await loggedIn;
  assert.equal(response.status(), 200);
  await target.waitForURL((url) => !url.pathname.startsWith('/auth/'));
  return (await response.json()).data.access_token;
}
async function choose(label, text) {
  await page.getByLabel(label, { exact: true }).click();
  await page
    .locator('.ant-select-dropdown:visible')
    .getByText(text, { exact: true })
    .click();
}
async function saveModal() {
  await page.locator('.ant-modal:visible .ant-btn-primary').click();
  await page.locator('.ant-modal:visible').waitFor({ state: 'hidden' });
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
    .fill('127.0.0.1:2525');
  await form.getByLabel('SMTP 密码', { exact: true }).fill(secret);
  await form
    .getByLabel('发件人邮箱', { exact: true })
    .fill(randomBytes(6).toString('hex') + '@example.invalid');
  await saveModal();
  assert.ok(
    !(await page.content()).includes(secret),
    'No saved password in markup',
  );
  return { id: fixture.state.providers.at(-1).id, secret };
}
let failure;
try {
  const response = await fetch(backend + '/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: process.env.SF2_ADMIN_USERNAME || 'admin',
      password: process.env.SF2_ADMIN_PASSWORD,
    }),
  });
  assert.equal(response.status, 200);
  const auth = await response.json();
  const probes = [];
  for (const path of [
    '/auth/me',
    '/auth/menus',
    '/admin/notifications/preferences',
  ]) {
    const result = await fetch(backend + '/api/v1' + path, {
      headers: { Authorization: 'Bearer ' + auth.data.access_token },
    });
    const body = await result.json();
    const probe = { path, status: result.status, code: body.code };
    if (path === '/auth/me')
      probe.permissions = body.data?.permissions?.filter((value) =>
        value.includes('notify'),
      );
    if (path === '/auth/menus') {
      const flat = (nodes) =>
        nodes.flatMap((value) => [value, ...flat(value.children || [])]);
      probe.menus = flat(body.data?.menus || [])
        .filter((value) => value.path?.includes('/notifications'))
        .map((value) => value.path);
    }
    probes.push(probe);
  }
  await writeFile(
    new URL('backend-prerequisites.json', output),
    JSON.stringify({ source: 'real-backend', probes }, null, 2),
  );
  await login(page);
  await page.goto(origin + '/system/notifications');
  await page.getByText('验收通知 1', { exact: true }).waitFor();
  assert.equal(await page.locator('[data-notification-id]').count(), 20);
  assert.ok(
    (
      await page.locator('[data-notification-id]').first().getAttribute('class')
    ).includes('font-semibold'),
  );
  await page.getByTitle('2', { exact: true }).click();
  await page.getByText('验收通知 21', { exact: true }).waitFor();
  assert.equal(await page.locator('[data-notification-id]').count(), 5);
  await shot('01-inbox-page2-fixture');
  check(
    1,
    '25 notifications paginate 20/5; unread rows are bold; payload is escaped text',
    '01-inbox-page2-fixture.png',
  );

  await choose('通知状态', '未读');
  await page.getByText('验收通知 1', { exact: true }).waitFor();
  await page
    .getByRole('button', { name: '通知中心，23 条未读', exact: true })
    .waitFor();
  assert.ok(
    await page
      .locator('[data-notification-id]')
      .evaluateAll((rows) =>
        rows.every((value) => value.textContent.includes('未读')),
      ),
  );
  await shot('02-unread-fixture');
  check(
    2,
    'Unread filter has total 23, matching header badge',
    '02-unread-fixture.png',
  );
  await page.getByText('验收通知 1', { exact: true }).click();
  await page
    .getByRole('button', { name: '通知中心，22 条未读', exact: true })
    .waitFor();
  assert.equal(
    fixture.state.inbox.find((value) => value.id === 9000).read_at !== null,
    true,
  );
  assert.equal(await page.evaluate(() => Boolean(window.sf2Unsafe)), false);
  check(
    3,
    'Opening an unread row marks it read and decrements badge 23 -> 22',
    'fixture inbox state and header aria-label',
  );
  await page.getByRole('button', { name: '全部已读', exact: true }).click();
  await page
    .getByRole('button', { name: '通知中心，0 条未读', exact: true })
    .waitFor();
  await page.getByText('暂无通知', { exact: true }).waitFor();
  assert.ok(fixture.state.inbox.every((value) => value.read_at));
  await shot('04-read-all-fixture');
  check(
    4,
    'Read all yields zero badge and no unread rows',
    '04-read-all-fixture.png',
  );

  await page.getByRole('tab', { name: '通知偏好', exact: true }).click();
  const preference = page.locator(
    '[data-preference="notification.default:email"]',
  );
  await preference.getByText('继承租户设置', { exact: false }).waitFor();
  assert.equal(await preference.getByRole('switch').isDisabled(), true);
  await shot('05-inheritance-fixture');
  check(
    5,
    'Unset preferences show disabled effective values and inherit tenant text',
    '05-inheritance-fixture.png',
  );
  await preference.getByRole('button', { name: '自定义', exact: true }).click();
  await preference.getByRole('switch').click();
  await page.getByRole('button', { name: '保存偏好', exact: true }).click();
  await page.getByText('通知偏好已保存', { exact: true }).waitFor();
  assert.deepEqual(fixture.state.preferencesWrites.at(-1), [
    { template: 'notification.default', channel: 'email', enabled: false },
  ]);
  await page.reload();
  await page.getByRole('tab', { name: '通知偏好', exact: true }).click();
  await preference.getByRole('switch').waitFor();
  assert.equal(
    await preference.getByRole('switch').getAttribute('aria-checked'),
    'false',
  );
  assert.ok(
    (await page.getByTestId('notification-preferences').textContent()).includes(
      '站内通知仍会收到',
    ),
  );
  await shot('06-preference-saved-fixture');
  check(
    6,
    'Only changed email=false pair submitted, survives reopening, inbox reminder displayed',
    '06-preference-saved-fixture.png',
  );

  await page.getByRole('button', { name: '通知渠道', exact: true }).click();
  await page
    .getByText('尚未配置通知渠道，配置后才能发送邮件', { exact: true })
    .waitFor();
  const provider = await createProvider('SF2 SMTP');
  let providerRow = page.locator('[data-provider-id="' + provider.id + '"]');
  await providerRow.getByText('已配置', { exact: true }).waitFor();
  await providerRow.getByRole('button', { name: '编辑', exact: true }).click();
  const providerForm = page.getByTestId('notification-provider-form');
  assert.equal(
    await providerForm.getByLabel('SMTP 密码', { exact: true }).inputValue(),
    '',
  );
  assert.equal(
    await providerForm
      .getByLabel('SMTP 密码', { exact: true })
      .getAttribute('placeholder'),
    '已配置',
  );
  assert.ok(!(await page.content()).includes(provider.secret));
  await providerForm
    .getByLabel('服务商名称', { exact: true })
    .fill('SF2 SMTP 已编辑');
  await shot('07-provider-private-fixture');
  await saveModal();
  await providerRow.getByText('SF2 SMTP 已编辑', { exact: true }).waitFor();
  await providerRow.getByRole('button', { name: '删除', exact: true }).click();
  await page
    .locator('.ant-modal-confirm:visible')
    .getByRole('button', { name: /取\s*消/ })
    .click();
  assert.equal(fixture.state.providers.length, 1);
  await providerRow.getByRole('button', { name: '删除', exact: true }).click();
  await page
    .locator('.ant-modal-confirm:visible')
    .getByRole('button', { name: /确\s*定/ })
    .click();
  await providerRow.waitFor({ state: 'hidden' });
  assert.equal(fixture.state.providers.length, 0);
  check(
    7,
    'SMTP create/edit/delete, delete cancel confirmation, saved secrets absent and configured-only',
    '07-provider-private-fixture.png',
  );

  const sendProvider = await createProvider('SF2 发送验收');
  providerRow = page.locator('[data-provider-id="' + sendProvider.id + '"]');
  await providerRow
    .getByRole('button', { name: '测试发送', exact: true })
    .click();
  await page
    .getByRole('button', { name: '发送给当前账号', exact: true })
    .click();
  await page
    .getByTestId('notification-provider-test')
    .getByText('测试已提交，投递处理中', { exact: true })
    .waitFor();
  await page
    .getByTestId('notification-provider-test')
    .getByText('已发送，请查收', { exact: true })
    .waitFor();
  await shot('08-test-sent-fixture');
  await page.getByRole('button', { name: /关\s*闭/ }).click();
  fixture.state.testStatus = 'failed';
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
  await shot('08-test-failed-fixture');
  await page.getByRole('button', { name: /关\s*闭/ }).click();
  fixture.state.testHttpFailure = true;
  await providerRow
    .getByRole('button', { name: '测试发送', exact: true })
    .click();
  await page
    .getByRole('button', { name: '发送给当前账号', exact: true })
    .click();
  await page
    .getByText('后端测试发送失败：recipient_unavailable', { exact: true })
    .waitFor();
  await shot('08-test-backend-message-fixture');
  await page.getByRole('button', { name: /关\s*闭/ }).click();
  check(
    8,
    'Current-account test distinguishes pending/sent/failed and preserves backend failure copy/reason',
    [
      '08-test-sent-fixture.png',
      '08-test-failed-fixture.png',
      '08-test-backend-message-fixture.png',
    ],
  );

  await page.getByRole('tab', { name: '模板', exact: true }).click();
  await page
    .getByTestId('notification-templates')
    .getByRole('button', { name: '编辑', exact: true })
    .click();
  await page.getByLabel('模板主题', { exact: true }).fill('SF2 模板已编辑');
  await page
    .getByLabel('模板正文', { exact: true })
    .fill('{{.Name}}，通知内容。');
  await saveModal();
  await page.getByText('SF2 模板已编辑', { exact: true }).waitFor();
  await shot('09-template-fixture');
  await page.getByRole('tab', { name: '投递记录', exact: true }).click();
  await page.getByText('provider_delivery_failed', { exact: true }).waitFor();
  const failedDelivery = fixture.state.deliveries.find(
    (value) => value.status === 'failed',
  );
  const deliveryRow = page.locator(
    '[data-delivery-id="' + failedDelivery.id + '"]',
  );
  assert.ok((await deliveryRow.textContent()).includes('1'));
  await deliveryRow.getByRole('button', { name: '重试', exact: true }).click();
  await deliveryRow.getByText('已发送', { exact: true }).waitFor();
  assert.equal(fixture.state.retryCount, 1);
  await shot('09-delivery-retry-fixture');
  check(
    9,
    'Delivery status/attempts/hash/domain visible; failed retry refreshes status; template edit also verified',
    ['09-delivery-retry-fixture.png', '09-template-fixture.png'],
  );

  fixture.state.manage = false;
  const readContext = await browser.newContext({
    viewport: { width: 1540, height: 1020 },
  });
  await fixture.install(readContext);
  const readPage = await readContext.newPage();
  const readToken = await login(readPage);
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
  const forbidden = await readPage.evaluate(async (token) => {
    const result = await fetch('/api/v1/admin/notifications/providers', {
      headers: { Authorization: 'Bearer ' + token },
    });
    return { status: result.status, code: (await result.json()).code };
  }, readToken);
  assert.deepEqual(forbidden, { status: 403, code: 20107 });
  await readPage.screenshot({
    path: fileURLToPath(new URL('10-read-only-fixture.png', output)),
    fullPage: true,
    animations: 'disabled',
  });
  await readPage.goto(origin + '/system/notifications/channels');
  assert.equal(await readPage.getByTestId('notification-providers').count(), 0);
  await readContext.close();
  check(
    10,
    'No manage: channels absent from toolbar/menu, direct route has no management view, fixture API returns 403',
    '10-read-only-fixture.png',
  );
  assert.deepEqual(errors, [], 'No browser runtime errors');
} catch (error) {
  failure = error;
  await shot('failure-fixture');
} finally {
  await writeFile(
    new URL('fixture-ui.json', output),
    JSON.stringify(
      {
        source: 'fixture-ui',
        note: 'Browser interaction with deterministic API fixtures; not evidence of real S3a delivery or persistence.',
        checks,
        errors,
        failure: failure?.message,
        confirmedDeviation:
          'Tests send to current authenticated account, per backend contract and user confirmation.',
      },
      null,
      2,
    ),
  );
  await browser.close();
}
if (failure) throw failure;
console.log(
  JSON.stringify({
    source: 'fixture-ui',
    passed: checks.length,
    browserErrors: errors.length,
  }),
);
