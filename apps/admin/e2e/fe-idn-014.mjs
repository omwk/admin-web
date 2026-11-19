import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import process from 'node:process';

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
} from './fe-idn-014-support.mjs';

const code = 'feidn014_' + Date.now();
const password = 'Acceptance@' + randomBytes(16).toString('hex');
const channelsPath = '/auth/notification-channels';
const preferencesPath = '/admin/notifications/preferences';
const successfulEndpoint = new URL(
  '/status/200',
  process.env.FE_IDN_014_PUBLIC_ORIGIN || 'https://httpbingo.org',
);
successfulEndpoint.searchParams.set('probe', randomBytes(12).toString('hex'));
const failedEndpoint = new URL('/status/503', successfulEndpoint);
failedEndpoint.searchParams.set('probe', randomBytes(12).toString('hex'));
let fixture;
let browser;
let page;
let failure;
async function personalPage() {
  await page.goto(origin + '/profile/notifications');
  await page
    .getByTestId('personal-email')
    .getByText('owner@example.invalid', { exact: true })
    .waitFor();
}
async function configure(channel, endpoint) {
  const card = page.locator('[data-channel="' + channel + '"]');
  await button(page, '配置', card).click();
  const modal = page.locator('.ant-modal:visible');
  await modal.getByLabel('推送 URL', { exact: true }).fill(endpoint);
  const saved = response(page, channelsPath + '/' + channel, 'PUT');
  const tested = response(page, channelsPath + '/' + channel + '/test', 'POST');
  await button(page, '保存并测试', modal).click();
  const savedResult = await saved;
  assert.equal(savedResult.status, 200);
  const result = await tested;
  assert.equal(result.status, 200);
  await card.getByTestId('channel-endpoint').waitFor();
  return result.body.data;
}
try {
  await persist();
  fixture = await database('bootstrap', { code, password });
  report.fixture = { tenant: fixture.tenant, users: fixture.users };
  await authenticate(code, password);
  ({ browser, page } = await setup());
  await login(page, code, 'owner', password);
  await page.goto(origin + '/profile');
  await page.getByRole('link', { name: '通知方式', exact: true }).click();
  await page.waitForURL('**/profile/notifications');
  await page
    .getByTestId('personal-email')
    .getByText('owner@example.invalid', { exact: true })
    .waitFor();
  assert.equal(await page.locator('[data-channel]').count(), 3);
  assert.equal(
    await page.getByTestId('personal-email').locator('input').count(),
    0,
  );
  assert.equal(
    (await page.getByTestId('personal-notifications').innerText()).includes(
      '短信',
    ),
    false,
  );
  await record(1, {
    emailReadOnly: true,
    channels: ['email', 'webhook', 'bark', 'gotify'],
    screenshot: await shot('01-personal-channels', page),
  });

  const delivery = await configure('bark', successfulEndpoint.href);
  assert.equal(delivery.status, 'sent');
  await page
    .locator('[data-channel="bark"]')
    .getByText('已验证', { exact: true })
    .waitFor();
  const savedChannels = await api(channelsPath);
  const bark = savedChannels.channels.find((item) => item.channel === 'bark');
  assert.ok(bark?.verified_at);
  await record(2, {
    saveStatus: 200,
    testStatus: 200,
    deliveryID: delivery.id,
    deliveryStatus: delivery.status,
    verifiedAt: bark.verified_at,
    screenshot: await shot('02-bark-verified', page),
  });
  assert.equal(
    JSON.stringify(savedChannels).includes(successfulEndpoint.href),
    false,
  );
  assert.equal(
    (await page.getByTestId('personal-notifications').innerText()).includes(
      successfulEndpoint.searchParams.get('probe'),
    ),
    false,
  );
  assert.ok(bark.endpoint_masked.includes('****'));
  await record(3, {
    endpointMasked: bark.endpoint_masked,
    fullDestinationAbsentFromListAndDOM: true,
  });

  await page.goto(origin + '/system/notifications/preferences');
  const preferences = page.getByTestId('notification-preferences');
  const barkCell = preferences.locator(
    '[data-preference="notification.default:bark"]',
  );
  await barkCell.getByRole('switch').waitFor();
  assert.equal((await preferences.innerText()).includes('短信'), false);
  await button(page, '自定义', barkCell).click();
  assert.equal(await barkCell.getByRole('switch').isEnabled(), true);
  await barkCell.getByRole('switch').click();
  let preferenceSave = response(page, preferencesPath, 'PUT');
  await button(page, '保存偏好', preferences).click();
  assert.equal((await preferenceSave).status, 200);
  await barkCell.getByRole('switch').click();
  preferenceSave = response(page, preferencesPath, 'PUT');
  await button(page, '保存偏好', preferences).click();
  assert.equal((await preferenceSave).status, 200);
  const barkPreference = (await api(preferencesPath)).preferences.find(
    (item) =>
      item.template === 'notification.default' && item.channel === 'bark',
  );
  assert.equal(barkPreference.available, true);
  assert.equal(barkPreference.enabled, true);
  await page.setViewportSize({ width: 1600, height: 2400 });
  await preferences
    .getByRole('columnheader', { name: 'Bark', exact: true })
    .first()
    .scrollIntoViewIfNeeded();
  await record(6, {
    directPath: '/system/notifications/preferences',
    barkAvailable: true,
    overrideSaved: true,
    screenshot: await shot('06-bark-preferences', page),
  });
  await page.setViewportSize({ width: 1600, height: 1100 });
  const security = preferences.locator(
    '[data-preference="identity.verify:email"]',
  );
  assert.equal(await security.getByRole('switch').isDisabled(), true);
  assert.equal(
    await security.getByRole('switch').getAttribute('aria-checked'),
    'true',
  );
  await security
    .getByText('安全邮件（验证/重置/邀请）不可关闭', { exact: true })
    .waitFor();
  await record(7, {
    checked: true,
    disabled: true,
    explanation: '安全邮件（验证/重置/邀请）不可关闭',
  });

  await personalPage();
  const failed = await configure('gotify', failedEndpoint.href);
  assert.equal(failed.status, 'failed');
  await page.getByRole('alert').filter({ hasText: '测试失败' }).waitFor();
  await page
    .locator('[data-channel="gotify"]')
    .getByText('未验证', { exact: true })
    .waitFor();
  const gotify = (await api(channelsPath)).channels.find(
    (item) => item.channel === 'gotify',
  );
  assert.equal(gotify.verified_at, null);
  await record(4, {
    testHTTPStatus: 200,
    deliveryStatus: failed.status,
    reason: failed.last_error_message || failed.last_error,
    verifiedAt: gotify.verified_at,
    screenshot: await shot('04-test-failed', page),
  });

  await button(page, '配置', page.locator('[data-channel="webhook"]')).click();
  const modal = page.locator('.ant-modal:visible');
  await modal
    .getByLabel('推送 URL', { exact: true })
    .fill('https://127.0.0.1/');
  const blocked = response(page, channelsPath + '/webhook', 'PUT');
  await button(page, '保存并测试', modal).click();
  assert.equal((await blocked).status, 400);
  await modal
    .getByText('个人渠道地址必须使用公网主机', { exact: true })
    .waitFor();
  assert.equal(
    report.requests.filter((item) => item.path.endsWith('/webhook/test'))
      .length,
    0,
  );
  report.ssrf = {
    saveStatus: 400,
    localizedReasonVisible: true,
    testNotSent: true,
  };
  await button(page, '取消', modal).click();

  const barkCard = page.locator('[data-channel="bark"]');
  await button(page, '删除', barkCard).click();
  const confirmation = page.locator('.ant-modal-confirm:visible');
  await confirmation
    .getByText('删除 Bark 通知方式？', { exact: true })
    .waitFor();
  await button(page, '取消', confirmation).click();
  assert.equal(
    (await api(channelsPath)).channels.some((item) => item.channel === 'bark'),
    true,
  );
  await button(page, '删除', barkCard).click();
  const removed = response(page, channelsPath + '/bark', 'DELETE');
  await button(
    page,
    '删除',
    page.locator('.ant-modal-confirm:visible'),
  ).click();
  assert.equal((await removed).status, 204);
  await barkCard.getByText('未配置', { exact: true }).waitFor();
  await page.goto(origin + '/system/notifications/preferences');
  const unavailable = page.locator(
    '[data-preference="notification.default:bark"]',
  );
  await unavailable.getByText('未配置', { exact: true }).waitFor();
  assert.equal(await unavailable.getByRole('switch').count(), 0);
  assert.equal(
    await unavailable
      .getByRole('link', { name: '去配置' })
      .getAttribute('href'),
    '/profile/notifications',
  );
  await unavailable.getByRole('link', { name: '去配置' }).click();
  await page.waitForURL('**/profile/notifications');
  await page
    .locator('[data-channel="bark"]')
    .getByText('未配置', { exact: true })
    .waitFor();
  await record(5, {
    confirmationRequired: true,
    cancelPreservesChannel: true,
    deleteStatus: 204,
    preference: '未配置',
    configurationLinkWorks: true,
  });

  await page.goto(origin + '/system/notifications/channels');
  await page
    .getByTestId('notification-providers')
    .getByText('企业微信、钉钉机器人：系统公告专用，不发送个人通知。', {
      exact: true,
    })
    .waitFor();
  await record(8, {
    text: '企业微信、钉钉机器人：系统公告专用，不发送个人通知。',
    screenshot: await shot('08-admin-purpose', page),
  });
  const context = await browser.newContext({
    locale: 'zh-CN',
    viewport: { width: 1600, height: 1100 },
  });
  const reader = await context.newPage();
  reader.on('pageerror', (error) => report.browserErrors.push(error.message));
  await login(reader, code, 'reader', password);
  await reader.goto(origin + '/profile/notifications');
  await reader
    .getByTestId('personal-email')
    .getByText('reader@example.invalid', { exact: true })
    .waitFor();
  assert.equal(
    await reader.locator('a[href="/system/notifications/channels"]').count(),
    0,
  );
  await reader.goto(origin + '/system/notifications/channels');
  await reader.waitForLoadState('networkidle');
  assert.equal(await reader.getByTestId('notification-providers').count(), 0);
  const readerToken = await authenticate(code, password, 'reader');
  await api(
    '/admin/notifications/providers',
    'GET',
    undefined,
    readerToken,
    403,
  );
  await record(9, {
    ordinaryUserPersonalPageAccessible: true,
    adminMenuHidden: true,
    adminPageNotRendered: true,
    adminAPIStatus: 403,
    screenshot: await shot('09-reader-permission', reader),
  });
  await context.close();
  assert.deepEqual(report.browserErrors, []);
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
  'FE-IDN-014 real browser acceptance 1-9 passed; development fixtures cleaned\n',
);
