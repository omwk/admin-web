import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import process from 'node:process';

import { broadcastAcceptance } from './fe-idn-013-broadcasts.mjs';
import {
  api,
  authenticate,
  button,
  cleanupApi,
  database,
  login,
  origin,
  persist,
  record,
  report,
  response,
  setup,
  shot,
  smtp,
} from './fe-idn-013-support.mjs';

const code = 'feidn013_' + Date.now();
const password = 'Acceptance@' + randomBytes(16).toString('hex');
let fixture;
let browser;
let page;
let mail;
let failure;
const notification = '/admin/notifications';
try {
  await persist();
  fixture = await database('bootstrap', { code, password });
  report.fixture = {
    tenant: fixture.tenant,
    users: fixture.users,
    audienceRole: fixture.audienceRole,
  };
  await authenticate(code, password);
  mail = await smtp();
  const provider = await api(notification + '/providers', 'POST', {
    name: '验收本机 SMTP',
    channel: 'email',
    kind: 'smtp',
    enabled: true,
    priority: -100,
    config: {
      smtp_addr: '127.0.0.1:' + mail.port,
      from_address: 'acceptance@example.invalid',
      tls_mode: 'plain',
    },
  });
  report.fixture.provider = provider.id;
  ({ browser, page } = await setup());
  await login(page, code, 'owner', password);
  await page.goto(origin + '/system/notifications/channels');
  await page.getByRole('tab', { name: '模板', exact: true }).click();
  const templates = page.getByTestId('notification-templates');
  const row = templates
    .getByRole('row')
    .filter({ has: page.getByText('identity.verify', { exact: true }) });
  await button(page, '编辑', row).click();
  const editor = page.getByTestId('notification-template-form');
  const variables = [
    'AppName',
    'UserName',
    'TenantName',
    'Link',
    'ExpiresInHours',
    'ExpiresAt',
    'SupportEmail',
  ];
  for (const name of variables)
    await editor
      .getByRole('button', { name: '插入 ' + name, exact: true })
      .waitFor();
  const catalog = await api(notification + '/templates/variables');
  assert.deepEqual(
    catalog['identity.verify'].map((item) => item.name),
    variables,
  );
  assert.ok(
    catalog['identity.verify'].every(
      (item) =>
        item.description &&
        typeof item.example === 'string' &&
        typeof item.required === 'boolean',
    ),
  );
  await record(1, {
    variables: catalog['identity.verify'],
    screenshot: await shot('01-variables', page),
  });
  await editor
    .getByRole('button', { name: '插入 SupportEmail', exact: true })
    .scrollIntoViewIfNeeded();
  report.checks[0].additionalScreenshot = await shot(
    '01-variables-support',
    page,
  );
  const body = editor.getByLabel('模板正文', { exact: true });
  const originalBody = await body.inputValue();
  await body.fill('前后');
  await body.evaluate((element) => {
    element.focus();
    element.setSelectionRange(1, 1);
    element.dispatchEvent(new Event('select'));
  });
  await editor.getByRole('button', { name: '插入 Link', exact: true }).click();
  assert.equal(await body.inputValue(), '前{{.Link}}后');
  assert.equal(await body.evaluate((element) => element.selectionStart), 10);
  await record(2, { body: await body.inputValue(), caret: 10 });
  await body.fill('{{.NotDeclared}}');
  const putsBefore = report.requests.filter(
    (item) => item.method === 'PUT' && item.path.includes('/templates/'),
  ).length;
  await button(page, '保存', page.locator('.ant-modal:visible')).click();
  await editor
    .getByText('引用了未声明的变量：NotDeclared', { exact: true })
    .waitFor();
  assert.equal(
    report.requests.filter(
      (item) => item.method === 'PUT' && item.path.includes('/templates/'),
    ).length,
    putsBefore,
  );
  await record(3, {
    blocked: true,
    unknown: 'NotDeclared',
    noSaveRequest: true,
    screenshot: await shot('03-unknown-variable', page),
  });
  await body.fill(originalBody);
  const previewPending = response(
    page,
    '/templates/' +
      (await api(notification + '/templates?page=1&page_size=100')).list.find(
        (item) => item.code === 'identity.verify',
      ).id +
      '/preview',
    'POST',
  );
  await button(page, '预览', editor).click();
  const previewResponse = await previewPending;
  const preview = (await previewResponse.json()).data;
  assert.equal(previewResponse.status(), 200);
  assert.ok(preview.subject && preview.body);
  assert.equal(JSON.stringify(preview).includes('{{'), false);
  await page.getByTestId('template-preview').waitFor();
  await record(4, {
    subject: preview.subject,
    body: preview.body,
    screenshot: await shot('04-template-preview', page),
  });
  await page
    .locator('.ant-drawer:visible')
    .getByRole('button', { name: 'Close', exact: true })
    .click();
  const deliveryBefore = await api(
    notification + '/deliveries?page=1&page_size=100',
  );
  await button(page, '发送测试', editor).click();
  await page
    .getByText('已发送测试邮件，可在投递记录查看', { exact: true })
    .waitFor();
  const deliveryAfter = await api(
    notification + '/deliveries?page=1&page_size=100',
  );
  const testDelivery = deliveryAfter.list.find(
    (item) => !deliveryBefore.list.some((before) => before.id === item.id),
  );
  assert.ok(testDelivery, 'Test must create a real delivery');
  await record(5, {
    delivery: {
      id: testDelivery.id,
      template_name: testDelivery.template_name,
      status: testDelivery.status,
    },
    screenshot: await shot('05-test-sent', page),
  });
  await button(page, '取消', page.locator('.ant-modal:visible')).click();
  await page.goto(origin + '/system/notifications');
  await page.getByRole('tab', { name: '通知偏好', exact: true }).click();
  const preferences = page.getByTestId('notification-preferences');
  await preferences.getByText('验证注册邮箱', { exact: true }).waitFor();
  await preferences.getByText('验证注册邮箱', { exact: true }).hover();
  await page
    .locator('.ant-tooltip-inner:visible')
    .getByText('identity.verify', { exact: true })
    .waitFor();
  await record(6, {
    name: '验证注册邮箱',
    tooltip: 'identity.verify',
    screenshot: await shot('06-preference-name', page),
  });
  await page.mouse.move(0, 0);
  const security = preferences.locator(
    '[data-preference="identity.verify:email"]',
  );
  assert.equal(await security.getByRole('switch').isDisabled(), true);
  await security
    .getByText('安全邮件（验证/重置/邀请）不可关闭', { exact: true })
    .waitFor();
  const ordinary = preferences.locator(
    '[data-preference="notification.default:email"]',
  );
  await button(page, '自定义', ordinary).click();
  const originalChecked = await ordinary
    .getByRole('switch')
    .getAttribute('aria-checked');
  await ordinary.getByRole('switch').click();
  const savePreference = response(page, '/preferences', 'PUT');
  await button(page, '保存偏好', preferences).click();
  assert.equal((await savePreference).status(), 200);
  assert.notEqual(
    await ordinary.getByRole('switch').getAttribute('aria-checked'),
    originalChecked,
  );
  await record(7, {
    securityDisabled: true,
    ordinaryToggleSaved: true,
    screenshot: await shot('07-security-preferences', page),
  });
  const badge = page.getByTestId('notification-badge');
  assert.equal(await badge.locator('.ant-badge-count:visible').count(), 0);
  await record(8, {
    unread: (await api(notification + '/unread-count')).count,
    visibleBadgeCount: 0,
    screenshot: await shot('08-zero-badge', page),
  });
  const initialBroadcast = await api(notification + '/broadcasts', 'POST', {
    title: '验收新消息',
    body: '通知中心完整正文\n第二行内容',
    channels: ['inbox'],
    audience: { type: 'users', ids: [fixture.users[0].id] },
  });
  const focusPending = response(page, '/unread-count');
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  const focusResponse = await focusPending;
  assert.equal((await focusResponse.json()).data.count, 1);
  await badge.locator('.ant-badge-count:visible').waitFor();
  await record(9, {
    focusRefresh: true,
    count: 1,
    broadcast_id: initialBroadcast.broadcast_id,
    polling: '60000 ms; unit fake-timer assertion',
    screenshot: await shot('09-focus-badge', page),
  });
  await page.getByRole('tab', { name: '站内通知', exact: true }).click();
  await button(
    page,
    '刷新',
    page.getByRole('tabpanel', { name: '站内通知' }),
  ).click();
  const inboxRow = page
    .getByTestId('notification-list')
    .getByRole('row')
    .filter({ hasText: '验收新消息' });
  await inboxRow.getByText('系统公告', { exact: true }).waitFor();
  await inboxRow.getByText('未读', { exact: false }).waitFor();
  const readPending = page.waitForResponse(
    (value) =>
      /\/api\/v1\/admin\/notifications\/\d+\/read$/.test(
        new URL(value.url()).pathname,
      ) && value.request().method() === 'PUT',
  );
  await inboxRow.getByText('验收新消息', { exact: true }).click();
  assert.equal((await readPending).status(), 200);
  const detail = page.getByTestId('notification-detail');
  await detail
    .getByText('通知中心完整正文\n第二行内容', { exact: true })
    .waitFor();
  await detail.getByText(/已读/).waitFor();
  await record(10, {
    title: '验收新消息',
    summary: '通知中心完整正文 第二行内容',
    template_name: '系统公告',
    read: true,
    screenshot: await shot('10-inbox-detail', page),
  });
  await page
    .locator('.ant-drawer:visible')
    .getByRole('button', { name: 'Close', exact: true })
    .click();
  await page.getByLabel('模板类型', { exact: true }).click();
  await page
    .getByLabel('模板类型', { exact: true })
    .getByRole('combobox')
    .fill('系统公告');
  await page
    .locator('.ant-select-dropdown:visible')
    .getByText('系统公告', { exact: true })
    .waitFor();
  await record(11, {
    option: '系统公告',
    screenshot: await shot('11-template-filter', page),
  });
  await page
    .locator('.ant-select-dropdown:visible')
    .getByText('系统公告', { exact: true })
    .click();
  const filtered = await api(
    notification + '/?page=1&page_size=20&template=notification.broadcast',
  );
  assert.ok(
    filtered.list.every((item) => item.template === 'notification.broadcast'),
  );
  await broadcastAcceptance(page, browser, fixture, code, password);
  assert.deepEqual(report.browserErrors, []);
  report.smtpAcceptedMessages = mail.count();
} catch (error) {
  failure = error;
  report.failure = error.message;
  if (page) {
    try {
      report.failureScreenshot = await shot('failure', page);
    } catch {
      report.failureScreenshot = 'unavailable';
    }
  }
} finally {
  await browser?.close();
  await mail?.close();
  if (fixture) {
    try {
      await cleanupApi(fixture);
    } catch (error) {
      report.apiCleanupFailure = error.message;
      failure ||= error;
      report.failure ||= error.message;
    }
    report.cleanup = await database('cleanup', {
      fixture,
      startedAt: report.startedAt,
    });
  }
  report.completedAt = new Date().toISOString();
  await persist();
}
if (failure) throw new Error(report.failure);
process.stdout.write(
  'FE-IDN-013 real browser acceptance 1-13 passed; development fixtures cleaned\n',
);
