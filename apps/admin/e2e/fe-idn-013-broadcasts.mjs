import assert from 'node:assert/strict';

import {
  button,
  database,
  login,
  origin,
  record,
  response,
  shot,
} from './fe-idn-013-support.mjs';

export async function broadcastAcceptance(
  page,
  browser,
  fixture,
  code,
  password,
) {
  await button(page, '发布公告').click();
  await page.waitForURL('**/system/notifications/broadcasts');
  const broadcast = page.getByTestId('notification-broadcasts');
  await broadcast.getByLabel('公告标题', { exact: true }).fill('验收公告');
  await broadcast
    .getByLabel('公告正文', { exact: true })
    .fill('公告正文：三种范围验收。');
  const counts = {};
  async function previewCount(type, expected) {
    const pending = response(page, '/broadcasts/preview', 'POST');
    await button(page, '预览人数', broadcast).click();
    const result = await pending;
    assert.equal(result.status(), 200);
    counts[type] = (await result.json()).data.recipients;
    assert.equal(counts[type], expected);
    await broadcast
      .getByText('将发送给 ' + expected + ' 人', { exact: true })
      .waitFor();
    await shot('12-audience-' + type, page);
  }
  await previewCount('all', 3);
  await broadcast.getByRole('radio', { name: '指定角色', exact: true }).check();
  await broadcast.getByLabel('公告角色', { exact: true }).click();
  await page
    .locator('.ant-select-dropdown:visible')
    .getByText('公告验收组', { exact: true })
    .click();
  await page.keyboard.press('Escape');
  await previewCount('roles', 2);
  await broadcast.getByRole('radio', { name: '指定用户', exact: true }).check();
  await broadcast.getByLabel('公告用户', { exact: true }).click();
  await broadcast
    .getByLabel('公告用户', { exact: true })
    .getByRole('combobox')
    .fill('owner');
  await page
    .locator('.ant-select-dropdown:visible')
    .getByText('验收管理员（owner）', { exact: true })
    .click();
  await page.keyboard.press('Escape');
  await previewCount('users', 1);
  const publishPending = response(page, '/broadcasts', 'POST');
  await button(page, '发布', broadcast).click();
  await page
    .getByText('将发送给 1 人，渠道：站内信、邮件。', { exact: true })
    .waitFor();
  await shot('12-confirmation', page);
  await button(
    page,
    '确认发布',
    page.locator('.ant-modal-confirm:visible'),
  ).click();
  const publishedResponse = await publishPending;
  assert.equal(publishedResponse.status(), 201);
  const published = (await publishedResponse.json()).data;
  await page.getByText('已发送给 1 人', { exact: true }).waitFor();
  await page
    .getByTestId('broadcast-history')
    .getByText('验收公告', { exact: true })
    .waitFor();
  const actual = await database('inspect', { tenant: fixture.tenant.id });
  assert.ok(
    actual.notifications.some(
      (item) =>
        item.target === 'user:' + fixture.users[0].id &&
        item.payload.title === '验收公告',
    ),
  );
  assert.ok(
    actual.deliveries.some(
      (item) => item.template_code === 'notification.broadcast',
    ),
  );
  await record(12, {
    counts,
    published,
    inboxStored: true,
    emailDeliveryStored: true,
    screenshots: [
      '12-audience-all.png',
      '12-audience-roles.png',
      '12-audience-users.png',
      '12-confirmation.png',
      await shot('12-broadcast-history', page),
    ],
  });
  const denied = await browser.newContext({
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    viewport: { width: 1600, height: 1000 },
    userAgent: 'FE-IDN-013 acceptance browser',
  });
  const deniedPage = await denied.newPage();
  await login(deniedPage, code, 'reader', password);
  let deniedCalls = 0;
  deniedPage.on('request', (request) => {
    if (
      new URL(request.url()).pathname.startsWith(
        '/api/v1/admin/notifications/broadcasts',
      )
    )
      deniedCalls++;
  });
  await deniedPage.goto(origin + '/system/notifications/broadcasts');
  await deniedPage.waitForURL('**/403');
  await deniedPage.getByText('403', { exact: true }).waitFor();
  assert.equal(deniedCalls, 0);
  await record(13, {
    path: '/403',
    businessRequests: 0,
    screenshot: await shot('13-broadcast-forbidden', deniedPage),
  });
  await denied.close();
}
