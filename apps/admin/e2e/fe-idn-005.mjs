import assert from 'node:assert/strict';
import process from 'node:process';

import {
  button,
  expand,
  fixtures,
  list,
  login,
  origin,
  pageUrl,
  row,
  save,
  select,
  session,
  shot,
  timeRange,
} from './fe-idn-005-support.mjs';

const { browser, context, page } = await session();
const checks = [];
const browserErrors = [];
const fixtureQueries = [];
const realQueries = [];
let failure;
const check = (item, assertion, evidence) => {
  checks.push({ item, assertion, ...evidence });
  process.stdout.write(`FE-IDN-005 check ${item} passed\n`);
};
page.on('pageerror', (error) => browserErrors.push(error.message));
const search = () => list(page, () => button(page, '查询').click());
const clear = () => list(page, () => button(page, '清空筛选').click());
const remember = (name, result) =>
  realQueries.push({
    name,
    query: result.query,
    total: result.total,
    ids: result.list.map((r) => r.id),
  });

try {
  const token = await login(page);
  const real = await list(page, () => page.goto(pageUrl('/system/audit-logs')));
  assert.ok(real.list.length >= 2);
  assert.ok(
    real.list.every(
      (r, i) =>
        i === 0 ||
        Date.parse(real.list[i - 1].created_at) >= Date.parse(r.created_at),
    ),
  );
  const named = real.list.find(
    (r) => r.actor_name === 'admin' && r.actor_tenant_name === 'default',
  );
  assert.ok(named, 'Backend returns immutable actor names');
  await row(page, named.id)
    .getByText('admin（default）', { exact: true })
    .waitFor();
  await row(page, named.id)
    .getByText('身份 / 登录（成功或失败）', { exact: true })
    .hover();
  await page
    .getByRole('tooltip')
    .getByText('identity.login', { exact: true })
    .waitFor();
  await shot(page, '01-real-names-actions');
  await save('real-audits.json', real);

  for (const [name, keyword] of [
    ['actor', 'admin'],
    ['resource', 'admin'],
    ['action', 'identity.login'],
  ]) {
    await page.getByLabel('关键字', { exact: true }).fill(keyword);
    const result = await search();
    assert.equal(result.query.keyword, keyword);
    assert.ok(result.list.length > 0);
    assert.ok(
      result.list.every((r) =>
        [r.actor_name, r.resource_label, r.action].some((v) =>
          v?.toLowerCase().includes(keyword.toLowerCase()),
        ),
      ),
    );
    remember('keyword-' + name, result);
  }
  await clear();
  await select(page, '模块', '租户');
  const moduleResult = await search();
  assert.equal(moduleResult.query.action_prefix, 'system.tenant.');
  assert.ok(moduleResult.list.length > 0);
  assert.ok(
    moduleResult.list.every((r) => r.action.startsWith('system.tenant.')),
  );
  remember('module', moduleResult);
  await clear();
  await select(page, '结果', '成功');
  const success = await search();
  assert.ok(success.list.every((r) => r.result === 'success'));
  remember('success', success);
  await select(page, '结果', '失败');
  const failed = await search();
  assert.equal(failed.query.result, 'failure');
  assert.ok(failed.list.every((r) => r.result === 'failure'));
  remember('failure', failed);
  await clear();
  await timeRange(page, '2026-11-16 00:00:00', '2026-11-16 23:59:59');
  const timed = await search();
  assert.equal(timed.query.from, '2026-11-15T16:00:00.000Z');
  assert.equal(timed.query.to, '2026-11-16T15:59:59.000Z');
  assert.ok(timed.list.length > 0);
  remember('time', timed);
  await page.getByLabel('关键字', { exact: true }).fill('admin');
  await select(page, '模块', '身份');
  await select(page, '结果', '成功');
  const combined = await search();
  assert.ok(combined.list.length > 0);
  assert.equal(combined.query.action_prefix, 'identity.');
  assert.equal(combined.query.keyword, 'admin');
  assert.equal(combined.query.result, 'success');
  assert.equal(combined.query.from, timed.query.from);
  remember('combined', combined);
  await shot(page, '08-real-combined-filters');
  await page
    .getByLabel('关键字', { exact: true })
    .fill('FE-IDN-005-no-such-object');
  const empty = await search();
  assert.equal(empty.total, 0);
  await page.getByText('当前筛选条件下没有记录', { exact: true }).waitFor();
  await shot(page, '08-real-empty');
  const reset = await clear();
  assert.deepEqual(reset.query, { page: '1', page_size: '20' });
  assert.equal(
    await page.getByLabel('关键字', { exact: true }).inputValue(),
    '',
  );
  remember('reset', reset);
  const actorResponse = await context.request.get(
    origin + '/api/v1/admin/audit-logs?actor_name=admin&page=1&page_size=20',
    { headers: { Authorization: 'Bearer ' + token } },
  );
  assert.equal(actorResponse.status(), 200);
  const actorRows = (await actorResponse.json()).data.list;
  assert.ok(
    actorRows.length && actorRows.every((r) => r.actor_name === 'admin'),
  );
  await save('real-queries.json', realQueries);
  check(
    9,
    '真实 keyword/action_prefix/result/时间单独及组合查询、空态与重置通过；actor_name 契约通过',
    {
      source: 'real-backend',
      screenshot: '08-real-combined-filters.png',
      queries: 'real-queries.json',
    },
  );

  await page.goto(pageUrl('/system/users'));
  const users = page.getByTestId('user-table');
  await users.getByRole('columnheader', { name: 'ID', exact: true }).waitFor();
  const firstID = users.locator('tr[data-row-key]').first();
  const id = await firstID.getAttribute('data-row-key');
  const idCell = firstID.locator('td').first();
  await idCell.getByRole('button').click();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), id);
  assert.match(await idCell.innerText(), new RegExp('^' + id));
  assert.match(
    await idCell
      .locator('.font-mono')
      .evaluate((el) => getComputedStyle(el).fontFamily),
    /mono/i,
  );
  const idVisibility = await users.evaluate((table) => {
    const scroll = table.querySelector('.ant-table-content');
    scroll.scrollLeft = scroll.scrollWidth;
    const visible = scroll.getBoundingClientRect();
    const id = table.querySelector('tr[data-row-key] .font-mono');
    const bounds = id.getBoundingClientRect();
    return {
      id: id.textContent,
      fullyVisible:
        bounds.left >= visible.left && bounds.right <= visible.right,
    };
  });
  assert.equal(idVisibility.id, id);
  assert.ok(idVisibility.fullyVisible, 'User ID stays visible while scrolling');
  await shot(page, '10-real-copyable-user-id');
  check(10, '真实用户列表 ID 等宽显示，可复制，剪贴板内容等于该行 ID', {
    source: 'real-backend',
    userId: id,
    idVisibility,
    screenshot: '10-real-copyable-user-id.png',
  });

  await fixtures(page, fixtureQueries);
  await list(page, () => page.goto(pageUrl('/system/audit-logs')));
  const scope = await expand(page, 101);
  await scope.getByText('访问范围：12 个租户', { exact: true }).waitFor();
  assert.equal(await scope.getByTestId('audit-diff').count(), 0);
  await shot(page, '02-read-scope-fixture');
  for (const [id, count] of [
    [108, 0],
    [109, 1],
  ]) {
    const details = await expand(page, id);
    await details
      .getByText(`访问范围：${count} 个租户`, { exact: true })
      .waitFor();
    assert.equal(await details.getByTestId('audit-diff').count(), 0);
  }
  check(
    1,
    '访问范围显示 12/0/1 个租户；成员 count=8 不误显示为 8 个租户，均无字段对比',
    { source: 'response-fixture', screenshot: '02-read-scope-fixture.png' },
  );
  const updated = await expand(page, 102);
  assert.deepEqual(await updated.locator('tbody th').allTextContents(), [
    'name',
    'profile.status',
    'profile.removed',
    'profile.added',
  ]);
  assert.match(await updated.locator('del').first().innerText(), /旧名称/);
  assert.match(
    await updated
      .locator('del')
      .first()
      .evaluate((el) => getComputedStyle(el).textDecorationLine),
    /line-through/,
  );
  assert.match(await updated.locator('mark').first().innerText(), /新名称/);
  assert.equal(await updated.getByText('same', { exact: true }).count(), 0);
  await updated.scrollIntoViewIfNeeded();
  await shot(page, '03-update-fields-fixture');
  check(
    2,
    '只列出四个变化字段；旧值 del 删除线，新值 mark 高亮，未变化字段隐藏',
    { source: 'response-fixture', screenshot: '03-update-fields-fixture.png' },
  );
  for (const [id, label, shape] of [
    [103, '新建', 'created'],
    [104, '删除', 'deleted'],
  ]) {
    const details = await expand(page, id);
    await details.getByRole('heading', { name: label, exact: true }).waitFor();
    assert.equal(
      await details.locator(`[data-shape="${shape}"] table`).count(),
      1,
    );
    assert.equal(await details.locator('thead th').count(), 2);
    await details.scrollIntoViewIfNeeded();
    await shot(page, `04-${shape}-fixture`);
  }
  check(3, '仅 after 显示新建字段表和 ***；仅 before 显示删除字段表', {
    source: 'response-fixture',
    screenshots: ['04-created-fixture.png', '04-deleted-fixture.png'],
  });
  const same = await expand(page, 105);
  assert.equal(
    (await same.getByTestId('audit-diff').innerText()).trim(),
    '无变化',
  );
  await same.scrollIntoViewIfNeeded();
  await shot(page, '05-unchanged-fixture');
  const absent = await expand(page, 106);
  assert.equal(
    (await absent.getByTestId('audit-diff').innerText()).trim(),
    '—',
  );
  assert.deepEqual(
    await absent.getByTestId('audit-source').locator('dd').allTextContents(),
    ['—', '—'],
  );
  await row(page, 106).getByText('用户 #7', { exact: true }).waitFor();
  await row(page, 106).getByText('#2', { exact: true }).waitFor();
  await row(page, 106).getByText('future.action', { exact: true }).waitFor();
  assert.equal(
    (await row(page, 106).locator('td').nth(7).innerText()).trim(),
    '—',
  );
  await absent.scrollIntoViewIfNeeded();
  await shot(page, '06-empty-source-fallback-fixture');
  check(4, '相同对象忽略字段顺序显示无变化；before/after 都空显示 —', {
    source: 'response-fixture',
    screenshots: [
      '05-unchanged-fixture.png',
      '06-empty-source-fallback-fixture.png',
    ],
  });
  check(
    5,
    '空 IP 单元格和详情中的 IP/UA 显示 —；操作者/对象缺名按用户 #7、#2 回退',
    {
      source: 'response-fixture',
      screenshot: '06-empty-source-fallback-fixture.png',
    },
  );
  for (const [id, label] of [
    [101, '租户 acme'],
    [103, '用户 sales01'],
    [102, '字典 order_status'],
  ])
    await row(page, id).getByText(label, { exact: true }).waitFor();
  check(
    7,
    '真实审计显示 admin（default）；夹具验证租户 acme、用户 sales01、字典 order_status，以及用户 #7、#2 回退',
    {
      source: 'real-backend-and-response-fixture',
      screenshots: [
        '01-real-names-actions.png',
        '06-empty-source-fallback-fixture.png',
      ],
    },
  );
  check(
    8,
    '中文操作悬停显示原始 identity.login；未登记 action 保留 future.action',
    {
      source: 'real-backend-and-response-fixture',
      screenshots: [
        '01-real-names-actions.png',
        '06-empty-source-fallback-fixture.png',
      ],
    },
  );
  await row(page, 110)
    .locator('td')
    .nth(5)
    .getByText('acme', { exact: true })
    .waitFor();
  const failedRow = row(page, 107);
  await failedRow.locator('.ant-badge-status-error').waitFor();
  await failedRow.getByText('失败', { exact: true }).hover();
  await page
    .getByRole('tooltip')
    .getByText('没有权限执行此操作', { exact: true })
    .waitFor();
  const failedDetails = await expand(page, 107);
  assert.deepEqual(
    (
      await failedDetails
        .getByTestId('audit-failure')
        .locator('dd')
        .allTextContents()
    ).map((v) => v.trim()),
    ['20107', '没有权限执行此操作'],
  );
  await failedDetails.scrollIntoViewIfNeeded();
  await shot(page, '07-failure-details-fixture');
  check(
    11,
    '失败结果红点、失败原因 tooltip、展开 error_code/error_message 原样显示；目标租户 acme 可读',
    {
      source: 'response-fixture',
      screenshot: '07-failure-details-fixture.png',
    },
  );
  const truncated = await expand(page, 111);
  await truncated.getByText('内容已截断', { exact: true }).waitFor();
  await page.getByLabel('关键字', { exact: true }).fill('admin');
  await select(page, '模块', '身份');
  await select(page, '结果', '成功');
  await search();
  await page.getByLabel('关键字', { exact: true }).fill('draft-not-submitted');
  const next = await list(page, () =>
    page.locator('.ant-pagination-item-2').click(),
  );
  assert.equal(next.query.page, '2');
  assert.equal(next.query.keyword, 'admin');
  assert.equal(next.query.action_prefix, 'identity.');
  assert.equal(next.query.result, 'success');
  await list(page, () => button(page, '刷新').click());
  assert.equal(fixtureQueries.at(-1).keyword, 'admin');
  await clear();
  assert.deepEqual(fixtureQueries.at(-1), { page: '1', page_size: '20' });
  await page.getByLabel('关键字', { exact: true }).fill('admin');
  await search();
  await list(page, async () => {
    await page
      .locator('.ant-pagination-options-size-changer .ant-select-selector')
      .click();
    await page
      .locator('.ant-select-dropdown:visible')
      .getByText('50 条/页', { exact: true })
      .click();
  });
  await page.locator('.ant-spin-spinning').waitFor({ state: 'hidden' });
  assert.equal(fixtureQueries.at(-1).page_size, '50');
  assert.equal(fixtureQueries.at(-1).page, '1');
  for (const label of [/导出/, /编辑/, /删除/, /新增/, /保存/])
    assert.equal(await page.getByRole('button', { name: label }).count(), 0);
  await save('fixture-queries.json', fixtureQueries);
  await save('fixture-shapes.json', {
    source: 'browser-response-fixtures-only',
    persistedRows: 0,
    cases: [101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111],
    pagination: fixtureQueries,
  });
  assert.deepEqual(browserErrors, []);
} catch (error) {
  failure = { name: error.name, message: error.message, stack: error.stack };
  await shot(page, 'failure').catch(() => {});
} finally {
  await save('ui.json', {
    date: new Date().toISOString(),
    checks: checks.sort((a, b) => a.item - b.item),
    browserErrors,
    fixtureQueries,
    realQueries,
    cleanup: {
      createdResources: [],
      modifiedSettings: [],
      sampleAuditRowsInserted: 0,
      auditNoiseUserAgent: 'FE-IDN-005 acceptance browser',
    },
    ...(failure ? { failure } : {}),
  });
  await browser.close();
}
assert.ok(!failure, failure?.message);
assert.equal(checks.length, 10);
process.stdout.write(
  JSON.stringify({
    checks: checks.length,
    browserErrors: browserErrors.length,
    source: 'real-backend-plus-explicit-response-fixtures',
  }) + '\n',
);
