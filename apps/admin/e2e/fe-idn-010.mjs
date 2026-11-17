import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';

import {
  agents,
  api,
  context,
  database,
  login,
  origin,
  output,
  persist,
  record,
  report,
  setup,
  shot,
} from './fe-idn-010-support.mjs';

const prefix = 'feidn010_' + Date.now();
const password = 'Channel@' + randomBytes(16).toString('hex');
const secret = randomBytes(18).toString('hex');
const fixture = await database('bootstrap', { username: prefix, password });
report.resources.user = fixture.user;
let browser;
let page;
let failure;
const form = () => page.getByTestId('notification-provider-form');
const modal = () => page.locator('.ant-modal:visible');
const input = (label) => form().getByLabel(label, { exact: true });
const field = (label) =>
  input(label).locator(
    'xpath=ancestor::div[contains(@class,"ant-form-item ")]',
  );
async function choose(label, text) {
  await input(label).click();
  await page
    .locator('.ant-select-dropdown:visible')
    .getByText(text, { exact: true })
    .click();
}
async function save(source = 'real-browser') {
  const pending = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname ===
        '/api/v1/admin/notifications/providers' &&
      response.request().method() === 'POST',
  );
  await modal()
    .getByRole('button', { name: /确\s*定/ })
    .click();
  const response = await pending;
  const body = await response.json();
  const request = response.request().postDataJSON();
  const evidence = {
    source,
    method: 'POST',
    path: '/admin/notifications/providers',
    status: response.status(),
    code: body.code,
    message: body.message,
    details: body.details,
    traceId: body.trace_id,
    configKeys: Object.keys(request.config),
  };
  report.requests.push(evidence);
  if (response.status() === 201) {
    report.resources.providers.push({ id: body.data.id, name: body.data.name });
    await persist();
  }
  return evidence;
}
async function smtp() {
  await input('服务商名称').fill(prefix);
  await input('SMTP 地址（host:port）').fill('smtp.163.com:465');
  await input('SMTP 用户名').fill('appvae@163.com');
  await input('SMTP 密码').fill(secret);
  await input('发件人邮箱').fill('noreply@example.com');
  await input('发件人名称').fill('订单通知');
}
async function waitError(label, text) {
  await field(label)
    .locator('.ant-form-item-explain-error')
    .getByText(text, { exact: true })
    .waitFor();
  assert.ok(
    (await field(label).getAttribute('class')).includes(
      'ant-form-item-has-error',
    ),
  );
  assert.equal(await form().locator('.ant-alert-error').count(), 0);
}
try {
  browser = await setup();
  const session = await context(browser);
  page = await session.newPage();
  await login(page, prefix, password);
  await page.goto(origin + '/system/notifications/channels');
  await page.getByRole('button', { name: '新增服务商', exact: true }).click();
  await smtp();
  const types = {};
  for (const label of ['SMTP 地址（host:port）', 'SMTP 用户名', '发件人邮箱']) {
    types[label] = await input(label).getAttribute('type');
    assert.equal(types[label], 'text');
    assert.ok(await input(label).inputValue());
  }
  assert.equal(await input('SMTP 密码').getAttribute('type'), 'password');
  await shot('01-smtp-visible-password-masked-real', page);
  await record(1, 'SMTP 地址、用户名、发件人邮箱明文可核对', {
    types,
    screenshot: '01-smtp-visible-password-masked-real.png',
  });
  const guidance = [
    [
      'SMTP 地址（host:port）',
      'smtp.163.com:465',
      '587 端口通常配 STARTTLS，465 配 TLS',
    ],
    ['SMTP 用户名', 'appvae@163.com', '163/QQ 邮箱需填写完整邮箱地址'],
    ['SMTP 密码', '输入授权码', '163 等邮箱使用授权码，不是登录密码'],
    ['发件人邮箱', 'noreply@example.com', '必须与发件人权限一致'],
    ['发件人名称', '订单通知', '显示在收件人邮箱里'],
  ];
  for (const [label, placeholder, hint] of guidance) {
    assert.equal(await input(label).getAttribute('placeholder'), placeholder);
    await field(label).getByText(hint, { exact: true }).waitFor();
  }
  const masked = [];
  for (const [kind, label, file] of [
    ['SendGrid', 'API Key', '02-sendgrid-masked-real'],
    ['阿里云邮件', 'Access Key Secret', '02-aliyun-masked-real'],
    ['HTTP Webhook', '签名 Secret', '02-secret-masked-real'],
  ]) {
    await choose('服务商类型', kind);
    await input('服务地址').fill('https://example.com/hook');
    await input(label).fill(secret);
    assert.equal(await input(label).getAttribute('type'), 'password');
    assert.equal(await input('服务地址').getAttribute('type'), 'text');
    assert.equal(
      await input('服务地址').getAttribute('placeholder'),
      'https://example.com/hook',
    );
    await field('服务地址')
      .getByText('必须是 http(s)', { exact: true })
      .waitFor();
    if (kind === '阿里云邮件') {
      await input('Access Key ID').fill('example-access-id');
      assert.equal(await input('Access Key ID').getAttribute('type'), 'text');
    }
    await shot(file, page);
    masked.push({
      kind,
      label,
      inputType: 'password',
      screenshot: file + '.png',
    });
  }
  await record(
    2,
    '密码、API Key、Access Key Secret、Secret 均为 password 输入框',
    { smtpScreenshot: '01-smtp-visible-password-masked-real.png', masked },
  );
  await record(3, '六个字段的占位与提示均与 §2.2 一致', {
    guidance,
    endpoint: ['https://example.com/hook', '必须是 http(s)'],
  });
  await choose('服务商类型', 'SMTP');
  await smtp();
  await input('SMTP 地址（host:port）').fill('smtp.163.com');
  const addressFailure = await save();
  assert.equal(addressFailure.status, 400);
  assert.equal(addressFailure.details.field, 'smtp_addr');
  await waitError('SMTP 地址（host:port）', addressFailure.message);
  await shot('04-smtp-port-field-error-real', page);
  await record(4, '真实 400 的 smtp_addr 错误显示在地址输入框下方并标红', {
    response: addressFailure,
    screenshot: '04-smtp-port-field-error-real.png',
  });
  await input('SMTP 地址（host:port）').fill('smtp.163.com:465');
  await field('SMTP 地址（host:port）')
    .locator('.ant-form-item-explain-error')
    .waitFor({ state: 'hidden' });
  await input('SMTP 用户名').fill('');
  const usernameFailure = await save();
  assert.equal(usernameFailure.status, 400);
  assert.equal(usernameFailure.details.field, 'username');
  assert.match(usernameFailure.message, /用户名/);
  await waitError('SMTP 用户名', usernameFailure.message);
  await shot('05-username-field-error-real', page);
  await record(5, '仅填写密码时真实 400 定位到用户名，文案提到用户名', {
    response: usernameFailure,
    screenshot: '05-username-field-error-real.png',
  });
  await input('SMTP 用户名').fill('appvae@163.com');
  await field('SMTP 用户名')
    .locator('.ant-form-item-explain-error')
    .waitFor({ state: 'hidden' });
  await shot('06-field-errors-cleared-real', page);
  await record(6, '分别编辑地址和用户名后，对应字段错误与红框消失', {
    screenshot: '06-field-errors-cleared-real.png',
  });
  await input('服务商优先级').fill('17');
  await input('启用服务商').click();
  await input('SMTP 用户名').fill('');
  const repeated = await save();
  await waitError('SMTP 用户名', repeated.message);
  await choose('服务商类型', '阿里云邮件');
  for (const label of [
    '服务地址',
    'Access Key ID',
    'Access Key Secret',
    '区域',
    '发件人邮箱',
    '发件人名称',
  ])
    assert.equal(await input(label).inputValue(), '');
  assert.equal(await form().locator('.ant-form-item-explain-error').count(), 0);
  assert.equal(await input('服务商名称').inputValue(), prefix);
  assert.equal(await input('服务商优先级').inputValue(), '17');
  assert.equal(await input('启用服务商').getAttribute('aria-checked'), 'false');
  await shot('08-kind-switch-cleared-real', page);
  await record(
    8,
    '切换类型清空共享及专属 config、字段错误；保留 name/priority/enabled',
    {
      retained: { name: prefix, priority: 17, enabled: false },
      screenshot: '08-kind-switch-cleared-real.png',
    },
  );
  await choose('服务商类型', 'SMTP');
  await smtp();
  const routePattern = '**/api/v1/admin/notifications/providers';
  await page.route(routePattern, (route) =>
    route.request().method() === 'POST'
      ? route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            code: 10001,
            message: '通道配置无效（无字段响应夹具）',
            trace_id: 'fe-idn-010-fieldless-fixture',
          }),
        })
      : route.continue(),
  );
  const bannerFailure = await save('fieldless-response-fixture');
  await form()
    .locator('.ant-alert-error')
    .getByText(bannerFailure.message)
    .waitFor();
  await shot('07-top-banner-response-fixture', page);
  await page.unroute(routePattern);
  await record(7, '无 field 时使用顶部横幅兜底（明确标记的响应夹具）', {
    source: 'fieldless-response-fixture',
    response: bannerFailure,
    screenshot: '07-top-banner-response-fixture.png',
  });
  await choose('服务商类型', 'HTTP Webhook');
  assert.equal(await form().locator('.ant-alert-error').count(), 0);
  await choose('服务商类型', 'SMTP');
  for (const label of [
    'SMTP 地址（host:port）',
    'SMTP 用户名',
    'SMTP 密码',
    '发件人邮箱',
    '发件人名称',
  ])
    assert.equal(await input(label).inputValue(), '');
  await smtp();
  await field('TLS 模式')
    .getByRole('status')
    .getByText('465 通常使用隐式 TLS')
    .waitFor();
  await shot('10-465-starttls-warning-real', page);
  await choose('TLS 模式', 'TLS');
  assert.equal(await field('TLS 模式').getByRole('status').count(), 0);
  await input('SMTP 地址（host:port）').fill('smtp.163.com:587');
  await field('TLS 模式')
    .getByRole('status')
    .getByText('587 通常使用 STARTTLS')
    .waitFor();
  await shot('10-587-tls-warning-real', page);
  await choose('TLS 模式', 'STARTTLS');
  assert.equal(await field('TLS 模式').getByRole('status').count(), 0);
  await input('SMTP 地址（host:port）').fill('smtp.163.com:2525');
  assert.equal(await field('TLS 模式').getByRole('status').count(), 0);
  await input('SMTP 地址（host:port）').fill('smtp.163.com:465');
  const saved = await save();
  assert.equal(saved.status, 201);
  await modal().waitFor({ state: 'hidden' });
  const row = page
    .getByTestId('notification-providers')
    .getByRole('row')
    .filter({ hasText: prefix });
  await row.waitFor();
  await shot('09-created-provider-list-real', page);
  await record(9, '完整 SMTP 配置真实返回 201，随后出现在列表', {
    response: saved,
    screenshot: '09-created-provider-list-real.png',
  });
  await record(
    10,
    '465+STARTTLS 与 587+TLS 显示警告；匹配或其他端口不显示；警告不阻止 201',
    {
      screenshots: [
        '10-465-starttls-warning-real.png',
        '10-587-tls-warning-real.png',
      ],
      nonblockingStatus: saved.status,
    },
  );
  await row.getByRole('button', { name: '编辑', exact: true }).click();
  for (const label of [
    'SMTP 地址（host:port）',
    'SMTP 用户名',
    'SMTP 密码',
    '发件人邮箱',
  ]) {
    assert.equal(await input(label).inputValue(), '');
    assert.equal(await input(label).getAttribute('placeholder'), '已配置');
  }
  await shot('edit-configured-flags-real', page);
  await modal()
    .getByRole('button', { name: /取\s*消/ })
    .click();
  assert.deepEqual(report.browserErrors, []);
} catch (error) {
  failure = error;
  report.failure = error.message;
  if (page)
    await shot('failure', page).catch((captureError) => {
      report.captureFailure = captureError.message;
    });
} finally {
  try {
    for (const provider of report.resources.providers)
      await api('/admin/notifications/providers/' + provider.id, 'DELETE');
    await browser?.close();
    const cleanup = await database('cleanup', {
      agents,
      startedAt: report.startedAt,
      before: fixture.before,
      user: fixture.user,
      prefix,
    });
    await writeFile(
      new URL('cleanup.json', output),
      JSON.stringify(cleanup, null, 2) + '\n',
    );
    report.cleanup = cleanup;
  } catch (error) {
    report.cleanupFailure = error.message;
    failure ||= error;
  }
  report.finishedAt = new Date().toISOString();
  report.passed = !failure;
  await persist();
}
if (failure) throw failure;
