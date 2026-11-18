import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';

import {
  database,
  login,
  origin,
  output,
  persist,
  record,
  report,
  setup,
  shot,
} from './fe-idn-011-support.mjs';

const username = 'feidn011_' + Date.now();
const password = 'Delivery@' + randomBytes(16).toString('hex');
const fixture = await database('bootstrap', { username, password });
report.resources = {
  user: fixture.user,
  templates: fixture.templates,
  deliveries: fixture.deliveries,
};
let browser;
let page;
let failure;
const panel = () => page.getByTestId('notification-deliveries');
const row = (index) =>
  panel().locator(`[data-delivery-id="${fixture.deliveries[index].id}"]`);
const action = (name) =>
  panel().getByRole('button', {
    name: new RegExp('^' + [...name].join('\\s*') + '$'),
  });
async function choose(label, text) {
  const control = panel().getByLabel(label, { exact: true });
  await control.click();
  if (label === '投递模板') await control.fill(text.split(' - ')[0]);
  await page
    .locator('.ant-select-dropdown:visible')
    .getByText(text, { exact: true })
    .click();
}
function listResponse() {
  return page.waitForResponse((response) => {
    const url = new URL(response.url());
    return (
      url.pathname === '/api/v1/admin/notifications/deliveries' &&
      url.searchParams.get('page_size') === '20' &&
      response.request().method() === 'GET'
    );
  });
}
async function query(button = '查询') {
  const pending = listResponse();
  await action(button).click();
  const response = await pending;
  assert.equal(response.status(), 200);
  const body = await response.json();
  await page.waitForFunction(() =>
    [
      ...document.querySelectorAll(
        '[data-testid="notification-deliveries"] button',
      ),
    ].some(
      (button) =>
        button.textContent.replaceAll(/\s/g, '') === '查询' && !button.disabled,
    ),
  );
  return {
    path: new URL(response.url()).pathname,
    query: Object.fromEntries(new URL(response.url()).searchParams),
    traceId: body.trace_id,
    data: body.data,
  };
}
async function tooltip(target, expected, name) {
  await target.hover();
  const tip = page
    .locator('.ant-tooltip-inner:visible')
    .getByText(expected, { exact: true });
  await tip.waitFor();
  if (name) await shot(name, page);
  await page.mouse.move(0, 0);
  await page
    .locator('.ant-tooltip:visible')
    .first()
    .waitFor({ state: 'hidden' });
}
async function retryBatch(ids, name) {
  for (const id of ids)
    await panel()
      .locator(`[data-delivery-id="${id}"]`)
      .getByRole('checkbox')
      .check();
  const pending = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname ===
        '/api/v1/admin/notifications/deliveries/retry' &&
      response.request().method() === 'POST',
  );
  await action('批量重试').click();
  const response = await pending;
  const body = await response.json();
  assert.equal(response.status(), 200);
  const result = body.data;
  await page
    .getByText(`成功 ${result.retried} 条，跳过 ${result.skipped} 条`, {
      exact: true,
    })
    .waitFor();
  await shot(name, page);
  return { ids, status: response.status(), traceId: body.trace_id, ...result };
}
try {
  await persist();
  await writeFile(
    new URL('fixture-baseline.json', output),
    JSON.stringify(fixture, null, 2) + '\n',
  );
  ({ browser, page } = await setup());
  await login(page, username, password);
  await page.goto(origin + '/system/notifications/channels');
  const initialResponse = listResponse();
  await page.getByRole('tab', { name: '投递记录', exact: true }).click();
  const initial = (await (await initialResponse).json()).data;
  const initialRecord = initial.list.find(
    (item) => item.id === fixture.deliveries[0].id,
  );
  const time = row(0).locator('td').nth(1).locator('span');
  const localTime = new Date(initialRecord.created_at).toLocaleString('sv-SE', {
    timeZone: 'Asia/Shanghai',
    hour12: false,
  });
  assert.equal(await time.innerText(), localTime);
  await tooltip(
    time,
    new Date(initialRecord.created_at).toISOString() + '（UTC）',
    'time-local-utc-tooltip-real',
  );
  report.timeDisplay = {
    localTime,
    utc: initialRecord.created_at,
    screenshot: 'time-local-utc-tooltip-real.png',
  };
  await row(0)
    .getByText(fixture.templates[0].subject, { exact: true })
    .waitFor();
  await tooltip(
    row(0).getByText(fixture.templates[0].subject, { exact: true }),
    fixture.templates[0].code,
    '01-template-code-tooltip-real',
  );
  await record(1, '中文模板名，悬浮显示真实 code', {
    template: fixture.templates[0],
    screenshot: '01-template-code-tooltip-real.png',
  });
  await row(0).getByText('a***@example.invalid', { exact: true }).waitFor();
  await row(1).getByText('138****8000', { exact: true }).waitFor();
  assert.equal((await row(2).locator('td').nth(4).innerText()).trim(), '—');
  assert.equal(
    initial.list.find((item) => item.id === fixture.deliveries[2].id)
      .recipient_masked,
    null,
  );
  await shot('02-masked-recipients-real', page);
  await record(2, '掩码邮箱/手机与旧记录破折号', {
    masks: ['a***@example.invalid', '138****8000'],
    oldRecipientMasked: null,
    screenshot: '02-masked-recipients-real.png',
  });
  for (const [index, label, color] of [
    [0, '失败', 'red'],
    [1, '已跳过', 'default'],
    [2, '已发送', 'green'],
    [3, '待发送', 'orange'],
  ]) {
    await row(index)
      .locator('.ant-tag-' + color)
      .getByText(label, { exact: true })
      .waitFor();
  }
  await record(3, '四态文案与橙/绿/红/灰颜色正确', {
    screenshot: '02-masked-recipients-real.png',
  });
  await tooltip(
    row(0).getByText('消息内容已过期或模板已删除', { exact: true }),
    'message_unavailable',
    '04-error-code-tooltip-real',
  );
  await record(4, '中文失败原因，悬浮保留原始错误码', {
    code: 'message_unavailable',
    screenshot: '04-error-code-tooltip-real.png',
  });
  await tooltip(
    row(2).getByRole('button', { name: '重试', exact: true }).locator('..'),
    '已发送的投递无需重试',
    '07-disabled-sent-real',
  );
  assert.equal(
    await row(2)
      .getByRole('button', { name: '重试', exact: true })
      .isDisabled(),
    true,
  );
  assert.equal(
    await row(3)
      .getByRole('button', { name: '重试', exact: true })
      .isDisabled(),
    true,
  );
  await record(7, 'sent 与近期 pending 禁用重试，悬浮解释原因', {
    screenshot: '07-disabled-sent-real.png',
  });
  const stalled = panel().getByTestId('stalled-deliveries');
  assert.match(
    await stalled.innerText(),
    /有 \d+ 条投递长时间未发送，可能是 worker 未启动。/,
  );
  const fixtureStalled = fixture.deliveries.filter(
    (item) =>
      item.status === 'pending' &&
      item.attempts === 0 &&
      Date.now() - Date.parse(item.created_at) > 300_000,
  );
  assert.equal(fixtureStalled.length, 2);
  await shot('09-stalled-worker-warning-real', page);
  const stuckPending = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname.endsWith('/deliveries/retry') &&
      response.request().method() === 'POST',
  );
  await action('全部重新入队').click();
  const stuckResponse = await stuckPending;
  const stuckBody = await stuckResponse.json();
  assert.equal(stuckResponse.status(), 200);
  const stuckIds = stuckResponse.request().postDataJSON().ids;
  assert.deepEqual(
    [...stuckIds].sort((a, b) => a - b),
    fixtureStalled.map((item) => item.id).sort((a, b) => a - b),
  );
  for (const item of fixtureStalled) assert.ok(stuckIds.includes(item.id));
  assert.ok(stuckBody.data.retried >= 2);
  await record(9, '超 5 分钟且 attempts=0 的 pending 显示提示并批量入队', {
    fixtureStalled,
    requestIds: stuckIds,
    response: stuckBody.data,
    traceId: stuckBody.trace_id,
    screenshot: '09-stalled-worker-warning-real.png',
  });
  await query('刷新');
  const singlePending = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname ===
      `/api/v1/admin/notifications/deliveries/${fixture.deliveries[0].id}/retry`,
  );
  const refreshed = listResponse();
  await row(0).getByRole('button', { name: '重试', exact: true }).click();
  const singleResponse = await singlePending;
  const singleBody = await singleResponse.json();
  assert.equal(singleResponse.status(), 200);
  assert.equal(singleBody.data.status, 'pending');
  const refreshedBody = await (await refreshed).json();
  assert.equal(
    refreshedBody.data.list.find((item) => item.id === fixture.deliveries[0].id)
      .status,
    'pending',
  );
  await row(0).getByText('待发送', { exact: true }).waitFor();
  await shot('05-single-retry-pending-real', page);
  await record(5, 'failed 单条真实重试，刷新后该行待发送', {
    id: fixture.deliveries[0].id,
    status: singleResponse.status(),
    traceId: singleBody.trace_id,
    refreshedStatus: 'pending',
    screenshot: '05-single-retry-pending-real.png',
  });
  await query('刷新');
  const mixed = await retryBatch(
    [
      fixture.deliveries[6].id,
      fixture.deliveries[1].id,
      fixture.deliveries[2].id,
    ],
    '06-mixed-batch-retry-real',
  );
  assert.equal(mixed.retried, 2);
  assert.equal(mixed.skipped, 1);
  await record(6, '三条混合状态批量重试，成功 2 条/跳过 1 条', {
    ...mixed,
    screenshot: '06-mixed-batch-retry-real.png',
  });
  await query('重置');
  const filters = [];
  for (const [label, text, key, value] of [
    ['投递状态', '已发送', 'status', 'sent'],
    ['投递渠道', '短信', 'channel', 'sms'],
    [
      '投递模板',
      fixture.templates[0].code + ' - ' + fixture.templates[0].subject,
      'template_code',
      fixture.templates[0].code,
    ],
  ]) {
    await query('重置');
    await choose(label, text);
    const result = await query();
    assert.equal(result.query[key], value);
    assert.ok(result.data.list.length > 0);
    assert.ok(result.data.list.every((item) => item[key] === value));
    filters.push({
      query: result.query,
      ids: result.data.list.map((item) => item.id),
      traceId: result.traceId,
    });
  }
  await query('重置');
  await choose('投递状态', '已发送');
  await choose('投递渠道', '邮件');
  await choose(
    '投递模板',
    fixture.templates[0].code + ' - ' + fixture.templates[0].subject,
  );
  const combined = await query();
  assert.equal(combined.data.total, 1);
  assert.equal(combined.data.list[0].id, fixture.deliveries[2].id);
  await shot('08-combined-filters-real', page);
  await record(8, '状态/渠道/模板单独与三项组合均由真实后端过滤', {
    individual: filters,
    combined: {
      query: combined.query,
      ids: combined.data.list.map((item) => item.id),
      traceId: combined.traceId,
    },
    screenshot: '08-combined-filters-real.png',
  });
  await choose('投递状态', '已跳过');
  const empty = await query();
  assert.equal(empty.data.total, 0);
  await panel().getByText('暂无投递记录', { exact: true }).waitFor();
  await panel().getByText('通知触发后会出现在这里', { exact: true }).waitFor();
  await shot('10-empty-state-real', page);
  await record(10, '真实空查询呈现两行空态文案', {
    query: empty.query,
    total: empty.data.total,
    screenshot: '10-empty-state-real.png',
  });
  assert.deepEqual(report.browserErrors, []);
  report.passed = true;
} catch (error) {
  failure = error;
  report.passed = false;
  report.failure = error.stack || error.message;
  if (page) await shot('failure', page).catch(() => {});
} finally {
  await browser?.close();
  const cleanup = await database('cleanup', {
    fixture,
    startedAt: report.startedAt,
  });
  report.cleanup = cleanup;
  await writeFile(
    new URL('cleanup.json', output),
    JSON.stringify(cleanup, null, 2) + '\n',
  );
  await persist();
}
if (failure) throw failure;
