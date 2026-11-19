import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import process from 'node:process';

import { smtp } from './fe-idn-015-mail.mjs';
import {
  api,
  authenticate,
  button,
  cleanupApi,
  database,
  login,
  origin,
  output,
  pageURL,
  persist,
  record,
  report,
  response,
  routeLocation,
  setup,
  shot,
} from './fe-idn-015-support.mjs';

const code = 'feidn015_' + Date.now();
const password = 'Acceptance@' + randomBytes(16).toString('hex');
// NANP 555-0100..0199 is reserved for fictional numbers.
const phone =
  '+120255501' + String(Math.floor(Math.random() * 99)).padStart(2, '0');
const occupiedPhone = '+12025550199';
const nickname = '资料验收昵称';
const avatar = origin + '/favicon.ico?fe-idn-015=' + Date.now();
const newEmail = 'updated@example.invalid';
let browser, failure, fixture, mail, page;
async function saveProfile(expected = 200) {
  const pending = response(page, '/auth/profile', 'PUT');
  await button(page, '保存基本信息').click();
  const result = await pending;
  assert.equal(result.status, expected);
  return result;
}
async function profilePage() {
  await page.goto(pageURL('/profile'));
  await page.getByLabel('昵称', { exact: true }).waitFor();
  await page.locator('.ant-spin-spinning').first().waitFor({ state: 'hidden' });
}
function sanitize(text) {
  return text
    .replaceAll(password, '[REDACTED]')
    .replaceAll(phone, '[REDACTED]')
    .replaceAll(occupiedPhone, '[REDACTED]')
    .replace(/#token=[^\s"'<>]+/g, '#token=[REDACTED]');
}
try {
  await persist();
  fixture = await database('bootstrap', { code, password });
  report.fixture = { tenant: fixture.tenant, users: fixture.users };
  await authenticate(code, password);
  const reader = await authenticate(code, password, 'reader');
  await api(
    '/auth/profile',
    'PUT',
    { nickname: '验收读者', phone: occupiedPhone },
    reader,
  );
  mail = await smtp();
  const provider = await api('/admin/notifications/providers', 'POST', {
    name: '资料验收本机 SMTP',
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
  await profilePage();
  assert.equal(
    await page.getByLabel('手机', { exact: true }).isDisabled(),
    false,
  );
  const writesBefore = report.requests.filter(
    (item) => item.path.endsWith('/auth/profile') && item.method === 'PUT',
  ).length;
  await page.getByLabel('手机', { exact: true }).fill('123');
  await button(page, '保存基本信息').click();
  await page
    .getByText(
      '请输入 E.164 格式的手机号，须以 + 和国家代码开头，最多 15 位数字',
      { exact: true },
    )
    .waitFor();
  assert.equal(
    report.requests.filter(
      (item) => item.path.endsWith('/auth/profile') && item.method === 'PUT',
    ).length,
    writesBefore,
  );
  const invalidPhoneScreenshot = await shot('03-phone-invalid', page);
  await page.getByLabel('手机', { exact: true }).fill(phone);
  await page.getByLabel('昵称', { exact: true }).fill(nickname);
  await page.getByLabel('头像 URL', { exact: true }).fill(avatar);
  const preview = page.getByRole('img', { name: '头像预览', exact: true });
  await preview.waitFor();
  await preview.evaluate((image) => image.decode());
  await saveProfile();
  const headerAvatar = page
    .getByRole('img', { name: nickname, exact: true })
    .first();
  await headerAvatar.waitFor();
  assert.equal(await headerAvatar.getAttribute('src'), avatar);
  await headerAvatar.click();
  await page.getByText(nickname, { exact: true }).waitFor();
  await record(1, {
    saveStatus: 200,
    headerNicknameImmediate: true,
    screenshot: await shot('01-nickname-global', page),
  });
  await page.keyboard.press('Escape');
  await record(5, {
    previewLoaded: true,
    roundPreview: await preview.evaluate((image) =>
      image.parentElement.classList.contains('ant-avatar-circle'),
    ),
    headerAvatarImmediate: true,
    screenshot: await shot('05-avatar-preview', page),
  });
  await page.reload();
  await page.getByLabel('昵称', { exact: true }).waitFor();
  assert.ok(
    (await page.getByLabel('手机', { exact: true }).inputValue()) === phone,
    'Saved phone must be echoed after reload',
  );
  assert.equal(
    await page.getByLabel('昵称', { exact: true }).inputValue(),
    nickname,
  );
  assert.equal(
    await page.getByLabel('头像 URL', { exact: true }).inputValue(),
    avatar,
  );
  const phoneShot = await shot('03-phone-saved', page);
  await page.getByLabel('手机', { exact: true }).fill(occupiedPhone);
  const conflict = await saveProfile(409);
  await page.getByText(conflict.body.message, { exact: true }).waitFor();
  assert.equal(conflict.body.message, '该手机号已被使用');
  const conflictShot = await shot('04-phone-conflict', page);
  await record(3, {
    phoneEditable: true,
    localE164Validation: true,
    invalidInputWrites: 0,
    saveStatus: 200,
    phoneEchoAfterReload: true,
    screenshot: phoneShot,
    invalidScreenshot: invalidPhoneScreenshot,
    conflictScreenshot: conflictShot,
  });
  await record(4, {
    status: 409,
    backendMessage: conflict.body.message,
    screenshot: conflictShot,
  });
  await page.getByLabel('手机', { exact: true }).fill(phone);
  await saveProfile();
  await page.getByLabel('邮箱', { exact: true }).fill('invalid');
  await button(page, '保存基本信息').click();
  await page.getByText('请输入有效的邮箱地址', { exact: true }).waitFor();
  await page.getByLabel('邮箱', { exact: true }).fill('reader@example.invalid');
  const emailConflict = response(page, '/auth/profile/email/change', 'POST');
  await saveProfile();
  assert.equal((await emailConflict).status, 409);
  await page.getByText('该邮箱已被使用', { exact: true }).waitFor();
  await page.getByLabel('邮箱', { exact: true }).fill(newEmail);
  const pendingEmail = response(page, '/auth/profile/email/change', 'POST');
  const profileWrite = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === '/api/v1/auth/profile' &&
      request.method() === 'PUT',
  );
  await saveProfile();
  const pending = await pendingEmail;
  assert.equal(pending.status, 202);
  assert.equal(pending.body.data.expires_in_hours, 24);
  assert.equal(
    Object.hasOwn((await profileWrite).postDataJSON(), 'email'),
    false,
  );
  await page
    .getByRole('alert')
    .filter({ hasText: '验证邮件已发送到新邮箱，24 小时内有效' })
    .waitFor();
  const pendingScreenshot = await shot('02-email-pending', page);
  const before = await api('/auth/me');
  assert.equal(before.user.email, 'owner@example.invalid');
  await api(
    '/auth/login',
    'POST',
    { tenant: code, account: 'owner@example.invalid', password },
    null,
    200,
  );
  const link = await mail.verificationLink();
  assert.equal(
    link.searchParams.get('tenant'),
    code,
    'Captured email must retain its tenant code',
  );
  const verifyResponse = page.waitForResponse(
    (value) =>
      new URL(value.url()).pathname === '/api/v1/auth/profile/email/verify' &&
      value.request().method() === 'POST',
  );
  await page.goto(origin + link.pathname + link.search + link.hash);
  const verified = await verifyResponse;
  assert.equal(verified.status(), 200);
  assert.equal(verified.request().headers().authorization, undefined);
  await page.getByText('邮箱变更成功', { exact: true }).waitFor();
  await page.getByText(newEmail, { exact: true }).waitFor();
  assert.ok(
    !page.url().includes('token='),
    'Verification token must be scrubbed from the URL',
  );
  assert.equal(
    await page.evaluate(() => window.history.state.current.includes('token=')),
    false,
  );
  const verifiedScreenshot = await shot('02-email-verified', page);
  await page.waitForURL(
    (url) =>
      routeLocation(url).pathname === '/auth/login' &&
      routeLocation(url).searchParams.get('tenant') === code,
  );
  assert.equal(
    routeLocation(new URL(page.url())).searchParams.get('tenant'),
    code,
  );
  await api(
    '/auth/login',
    'POST',
    { tenant: code, account: 'owner@example.invalid', password },
    null,
    401,
  );
  await login(page, code, newEmail, password);
  await authenticate(code, password, newEmail, true);
  await profilePage();
  assert.equal(
    await page.getByLabel('邮箱', { exact: true }).inputValue(),
    newEmail,
  );
  const loggedInScreenshot = await shot('02-new-email-login', page);
  const reused = response(page, '/auth/profile/email/verify', 'POST');
  await page.goto(origin + link.pathname + link.search + link.hash);
  assert.equal((await reused).status, 400);
  await page
    .getByText('链接已失效，请重新获取验证邮件', { exact: true })
    .waitFor();
  await record(2, {
    changeStatus: 202,
    expiresInHours: 24,
    conflictStatus: 409,
    emailExcludedFromProfileWrite: true,
    oldEmailRetainedBeforeVerification: true,
    oldEmailLoginBefore: 200,
    verifyStatus: 200,
    verificationAnonymous: true,
    tokenRemovedFromURL: true,
    tokenRemovedFromHistoryState: true,
    loginRedirectAutomatic: true,
    tenantRetained: true,
    oldEmailLoginAfter: 401,
    newEmailLogin: 200,
    newEmailEcho: true,
    reusedTokenStatus: 400,
    pendingScreenshot,
    verifiedScreenshot,
    loggedInScreenshot,
    smtpAcceptedMessages: mail.count(),
  });
  await api('/auth/notification-channels/bark', 'PUT', {
    endpoint:
      'https://httpbingo.org/anything/' + randomBytes(12).toString('hex'),
  });
  const delivery = await api('/auth/notification-channels/bark/test', 'POST');
  assert.equal(delivery.status, 'sent');
  await api('/auth/notification-channels/gotify', 'PUT', {
    endpoint: 'https://httpbingo.org/status/503',
  });
  await profilePage();
  await page.getByRole('tab', { name: '通知设置', exact: true }).click();
  const cards = page.getByTestId('personal-notifications');
  await cards
    .getByTestId('personal-email')
    .getByText(newEmail, { exact: true })
    .waitFor();
  for (const name of ['webhook', 'bark', 'gotify'])
    await cards.locator('[data-channel="' + name + '"]').waitFor();
  await cards
    .locator('[data-channel="bark"]')
    .getByText('已验证', { exact: true })
    .waitFor();
  assert.equal(await cards.locator('.ant-card').count(), 4);
  assert.ok(
    !/账户密码|系统消息将|待办任务|配额|定价/.test(await cards.innerText()),
  );
  const channelScreenshot = await shot('06-notification-tab', page);
  await record(6, {
    cards: ['邮件', 'Webhook', 'Bark', 'Gotify'],
    count: 4,
    sharedComponent: 'notification-setting.vue',
    placeholderRemoved: true,
    screenshot: channelScreenshot,
  });
  await cards
    .getByTestId('personal-email')
    .getByText('已启用', { exact: true })
    .waitFor();
  await cards
    .locator('[data-channel="webhook"]')
    .getByText('未配置', { exact: true })
    .waitFor();
  await cards
    .locator('[data-channel="gotify"]')
    .getByText('未验证', { exact: true })
    .waitFor();
  await button(page, '配置', cards.locator('[data-channel="webhook"]')).click();
  await page
    .getByRole('dialog')
    .getByLabel('推送 URL', { exact: true })
    .waitFor();
  await button(page, '取消', page.getByRole('dialog')).click();
  await record(7, {
    email: '已启用',
    webhook: '未配置',
    bark: '已验证',
    gotify: '未验证',
    realBarkDelivery: delivery.id,
    realBarkStatus: delivery.status,
    configurationEntryWorks: true,
    screenshot: channelScreenshot,
  });
  const optionLabels = await cards
    .locator('button,a,input,label,[role="tab"]')
    .allTextContents();
  assert.ok(!/短信|\bsms\b/i.test(optionLabels.join(' ')));
  await page.getByRole('tab', { name: '基本资料', exact: true }).click();
  await page.getByText('仅用于联系，不用于短信通知', { exact: true }).waitFor();
  assert.ok(
    !/短信|\bsms\b/i.test(
      (
        await page
          .locator(
            'button,[role="tab"],input[type="checkbox"],input[type="radio"]',
          )
          .allTextContents()
      ).join(' '),
    ),
  );
  await record(8, {
    noSmsOptions: true,
    contactPurpose: '仅用于联系，不用于短信通知',
  });
  assert.deepEqual(report.browserErrors, []);
} catch (error) {
  failure = error;
  report.failure = sanitize(error.message);
  if (page) {
    try {
      report.failureScreenshot = await shot('failure', page);
    } catch {
      report.failureScreenshot = 'unavailable';
    }
  }
} finally {
  if (fixture) {
    try {
      report.deliveryCleanup = await database('prune-deliveries', { fixture });
      await cleanupApi(fixture);
    } catch (error) {
      report.apiCleanupFailure = sanitize(error.message);
    }
    try {
      report.cleanup = await database('cleanup', {
        fixture,
        startedAt: report.startedAt,
      });
      report.cleanup.sql.unshift(...(report.deliveryCleanup?.sql || []));
      await writeFile(
        new URL('cleanup.json', output),
        JSON.stringify(report.cleanup, null, 2) + '\n',
      );
    } catch (error) {
      report.cleanupFailure = sanitize(error.message);
      failure ||= error;
    }
  }
  if (browser) await browser.close();
  if (mail) await mail.close();
  report.passed = !failure && report.cleanup?.baselinePreserved === true;
  report.finishedAt = new Date().toISOString();
  await persist();
}
if (failure) {
  process.stderr.write(sanitize(failure.message) + '\n');
  process.exitCode = 1;
} else
  process.stdout.write(
    'FE-IDN-015 browser acceptance 1-8: passed; fixture cleanup: passed\n',
  );
