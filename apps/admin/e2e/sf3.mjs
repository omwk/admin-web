import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

// eslint-disable-next-line n/no-extraneous-import -- Workspace browser test tooling.
import { chromium } from 'playwright';

const origin = process.env.SF3_ORIGIN || 'http://127.0.0.1:5666';
const backend = process.env.SF3_BACKEND || 'http://127.0.0.1:18080';
assert.ok(process.env.SF3_ADMIN_PASSWORD, 'Set SF3_ADMIN_PASSWORD');
const output = new URL('../../../docs/evidence/sf-3/', import.meta.url);
await mkdir(output, { recursive: true });
const prefix = `sf3_${Date.now()}`;
const today = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());
const password = `Sf3@${randomBytes(14).toString('hex')}`;
const attempted = `unknown_${randomBytes(12).toString('hex')}`;
const longUA =
  'SF3 acceptance browser / ' + 'User-Agent source metadata; '.repeat(6).trim();
const checks = [];
const browserErrors = [];
const cleanup = [];
const createdUsers = [];
let createdRole;
let createdMenu;
let token;
let failure;
let page;
const browser = await chromium.launch({
  headless: true,
  channel: process.env.SF3_BROWSER_CHANNEL || 'msedge',
});
const context = await browser.newContext({
  viewport: { width: 1600, height: 1050 },
  locale: 'zh-CN',
  timezoneId: 'Asia/Shanghai',
});
async function request(
  path,
  method = 'GET',
  body,
  bearer = token,
  ua = 'SF3 acceptance setup',
) {
  const response = await fetch(backend + '/api/v1' + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': ua,
      ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const envelope = response.status === 204 ? {} : await response.json();
  return { status: response.status, envelope, data: envelope.data };
}
async function api(path, method = 'GET', body, bearer = token) {
  const result = await request(path, method, body, bearer);
  assert.ok(
    result.status >= 200 && result.status < 300,
    `${method} ${path}: ${result.status}/${result.envelope.code}`,
  );
  return result.data;
}
const check = (item, assertion, evidence = {}) =>
  checks.push({
    item,
    result: 'pass',
    source: 'real-backend-and-browser',
    assertion,
    ...evidence,
  });
const shot = (name, target = page) =>
  target.screenshot({
    path: fileURLToPath(new URL(name + '.png', output)),
    fullPage: true,
    animations: 'disabled',
  });
const flat = (nodes) =>
  nodes.flatMap((node) => [node, ...flat(node.children || [])]);
function watch(target) {
  target.on('pageerror', (error) => browserErrors.push(error.message));
}
async function login(target, username, secret) {
  await target.goto(origin + '/auth/login');
  await target.getByPlaceholder('请输入用户名').fill(username);
  await target.getByPlaceholder('密码', { exact: true }).fill(secret);
  const pending = target.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/v1/auth/login' &&
      response.request().method() === 'POST',
  );
  await target.getByRole('button', { name: 'login', exact: true }).click();
  const response = await pending;
  assert.equal(response.status(), 200);
  await target.waitForURL((url) => !url.pathname.startsWith('/auth/'));
  return (await response.json()).data;
}
async function waitList(kind, action) {
  const pending = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === `/api/v1/admin/${kind}-logs`,
  );
  await action();
  const response = await pending;
  assert.equal(response.status(), 200);
  const result = (await response.json()).data;
  await page
    .getByTestId(`${kind}-log-list`)
    .locator('.ant-spin-spinning')
    .waitFor({ state: 'hidden' });
  if (result.list.length)
    await page.locator(`[data-row-key="${result.list[0].id}"]`).waitFor();
  return {
    ...result,
    query: Object.fromEntries(new URL(response.url()).searchParams),
  };
}
const search = (kind = 'audit') =>
  waitList(kind, () =>
    page.getByRole('button', { name: '查 询', exact: true }).click(),
  );
const clear = (kind = 'audit') =>
  waitList(kind, () =>
    page.getByRole('button', { name: '清空筛选', exact: true }).click(),
  );
async function chooseResult(label) {
  await page.getByLabel('结果', { exact: true }).click();
  await page
    .locator('.ant-select-dropdown:visible')
    .getByText(label, { exact: true })
    .click();
}
function assertDescending(list) {
  assert.ok(
    list.every(
      (row, i) =>
        !i ||
        Date.parse(list[i - 1].created_at) > Date.parse(row.created_at) ||
        (list[i - 1].created_at === row.created_at && list[i - 1].id > row.id),
    ),
  );
}
async function timeRange(start, end) {
  await page.getByPlaceholder('开始时间', { exact: true }).click();
  await page.getByPlaceholder('开始时间', { exact: true }).press('ArrowRight');
  await page.getByPlaceholder('开始时间', { exact: true }).fill(start);
  await page.getByPlaceholder('开始时间', { exact: true }).press('Enter');
  await page.getByPlaceholder('结束时间', { exact: true }).click();
  await page.getByPlaceholder('结束时间', { exact: true }).press('ArrowRight');
  await page.getByPlaceholder('结束时间', { exact: true }).fill(end);
  await page.getByPlaceholder('结束时间', { exact: true }).press('Enter');
}
async function createUser(suffix, status = 'active') {
  const user = await api('/admin/users', 'POST', {
    username: prefix + '_' + suffix,
    nickname: 'SF3 ' + suffix,
    password: password + '0',
    dept_id: 1,
    status,
  });
  createdUsers.push(user);
  return user;
}
async function setStatus(user, status) {
  return api(`/admin/users/${user.id}`, 'PUT', {
    nickname: user.nickname,
    avatar: user.avatar,
    email: user.email,
    dept_id: user.dept_id,
    status,
  });
}
async function resetOwnPassword(user) {
  const initial = await api(
    '/auth/login',
    'POST',
    { username: user.username, password: password + '0' },
    null,
  );
  await api(
    '/auth/password',
    'PUT',
    { oldPassword: password + '0', newPassword: password },
    initial.access_token,
  );
}
try {
  const auth = await api(
    '/auth/login',
    'POST',
    {
      username: process.env.SF3_ADMIN_USERNAME || 'admin',
      password: process.env.SF3_ADMIN_PASSWORD,
    },
    null,
  );
  token = auth.access_token;
  const me = await api('/auth/me');
  const menus = flat((await api('/auth/menus')).menus);
  const auditMenu = menus.find((menu) => menu.path === '/system/audit-logs');
  const loginMenu = menus.find((menu) => menu.path === '/system/login-logs');
  const userMenu = menus.find((menu) => menu.path === '/system/users');
  assert.ok(auditMenu && loginMenu && userMenu);
  const locked = await createUser('locked');
  await resetOwnPassword(locked);
  await setStatus(locked, 'locked');
  const disabled = await createUser('disabled', 'disabled');
  const limited = await createUser('limited');
  await resetOwnPassword(limited);
  const menuInput = {
    name: 'SF3 审计验收',
    type: 'button',
    parent_id: auditMenu.id,
    path: null,
    component: null,
    icon: null,
    permission_code: null,
    redirect: null,
    sort: 999,
    status: 'active',
    visible: false,
    is_external: false,
    keep_alive: false,
    meta: {
      profile: {
        name: 'before',
        password: 'sf3-mask-probe',
        secret: 'sf3-mask-probe',
      },
    },
  };
  createdMenu = await api('/admin/menus', 'POST', menuInput);
  await api(`/admin/menus/${createdMenu.id}`, 'PUT', {
    ...menuInput,
    meta: {
      profile: {
        name: 'after',
        password: 'sf3-mask-probe',
        secret: 'sf3-mask-probe',
      },
      added: true,
    },
  });
  const small = (
    await api('/admin/audit-logs?action=system:menu:update&page_size=100')
  ).list.find((row) => row.resource_id === String(createdMenu.id));
  assert.ok(JSON.stringify(small).includes('***'));
  assert.ok(!JSON.stringify(small).includes('sf3-mask-probe'));
  await api(`/admin/menus/${createdMenu.id}`, 'PUT', {
    ...menuInput,
    meta: { description: 'SF3 large snapshot '.repeat(500) },
  });
  const large = (
    await api('/admin/audit-logs?action=system:menu:update&page_size=100')
  ).list.find((row) => row.resource_id === String(createdMenu.id));
  assert.equal(large.truncated, true);
  const unknown = await request(
    '/auth/login',
    'POST',
    { username: attempted, password: 'Unknown@invalid123' },
    null,
    longUA,
  );
  assert.equal(unknown.status, 401);
  const failed = await request(
    '/auth/login',
    'POST',
    { username: limited.username, password: 'Wrong@invalid123' },
    null,
    longUA,
  );
  assert.equal(failed.status, 401);
  const success = await request(
    '/auth/login',
    'POST',
    { username: limited.username, password },
    null,
    longUA,
  );
  assert.equal(success.status, 200);
  page = await context.newPage();
  watch(page);
  await login(
    page,
    process.env.SF3_ADMIN_USERNAME || 'admin',
    process.env.SF3_ADMIN_PASSWORD,
  );
  const audit = await waitList('audit', () =>
    page.goto(origin + '/system/audit-logs'),
  );
  assert.ok(audit.list.length >= 5);
  assertDescending(audit.list);
  for (const label of ['时间', '操作者', '动作', '资源', '结果', 'IP'])
    assert.ok(
      await page
        .getByRole('columnheader', { name: label, exact: true })
        .count(),
    );
  await shot('01-audit-real');
  check(1, '真实审计至少五行，created_at/id 倒序，六列齐全', {
    rows: audit.list.length,
    total: audit.total,
    ids: audit.list.map((row) => row.id),
    screenshot: '01-audit-real.png',
  });

  const filtering = [];
  await page.getByLabel('操作类型', { exact: true }).fill('identity.login');
  let result = await search();
  assert.ok(result.list.every((row) => row.action === 'identity.login'));
  filtering.push({
    scenario: 'action',
    query: result.query,
    total: result.total,
  });
  await chooseResult('成功');
  result = await search();
  assert.ok(
    result.list.every(
      (row) => row.action === 'identity.login' && row.result === 'success',
    ),
  );
  const next = await waitList('audit', () =>
    page.getByTitle('2', { exact: true }).click(),
  );
  assert.equal(next.query.action, 'identity.login');
  assert.equal(next.query.result, 'success');
  assert.equal(next.query.page, '2');
  filtering.push({
    scenario: 'action+result+page2',
    query: next.query,
    total: next.total,
  });
  await clear();
  await chooseResult('失败');
  result = await search();
  assert.ok(
    result.list.length && result.list.every((row) => row.result === 'failure'),
  );
  filtering.push({
    scenario: 'result',
    query: result.query,
    total: result.total,
  });
  await clear();
  await timeRange(`${today} 00:00:00`, `${today} 23:59:59`);
  result = await search();
  assert.ok(result.query.from && result.query.to);
  assert.ok(
    result.list.every(
      (row) =>
        Date.parse(row.created_at) >= Date.parse(result.query.from) &&
        Date.parse(row.created_at) <= Date.parse(result.query.to),
    ),
  );
  filtering.push({
    scenario: 'time',
    query: result.query,
    total: result.total,
  });
  await page.getByLabel('操作类型', { exact: true }).fill('identity.login');
  await chooseResult('失败');
  await page.getByLabel('资源类型', { exact: true }).fill('user');
  result = await search();
  assert.ok(
    result.list.length &&
      result.list.every(
        (row) =>
          row.action === 'identity.login' &&
          row.result === 'failure' &&
          row.resource_type === 'user',
      ),
  );
  filtering.push({
    scenario: 'action+result+resource+time',
    query: result.query,
    total: result.total,
  });
  await shot('02-audit-filter-real');
  check(2, 'action/result/时间单独及组合筛选，翻页保持提交的筛选条件', {
    filtering,
    screenshot: '02-audit-filter-real.png',
  });

  await clear();
  await page.getByLabel('操作类型', { exact: true }).fill('system:menu:update');
  await page.getByLabel('操作者 ID', { exact: true }).fill(String(me.user.id));
  result = await search();
  assert.ok(result.list.every((row) => row.actor_id === me.user.id));
  await page
    .locator(`[data-row-key="${small.id}"] .ant-table-row-expand-icon`)
    .click();
  await page
    .getByTestId('audit-diff')
    .getByText('password: "***"', { exact: true })
    .first()
    .waitFor();
  assert.ok(
    (await page.getByTestId('audit-diff').locator('[role="tree"]').count()) ===
      2,
  );
  assert.ok(!(await page.content()).includes('sf3-mask-probe'));
  await shot('03-json-diff-real');
  check(3, '真实嵌套 before/after 为两棵树，修改/新增有标记，敏感值原样 ***', {
    auditId: small.id,
    screenshot: '03-json-diff-real.png',
  });
  await page
    .locator(`[data-row-key="${large.id}"]`)
    .getByText('内容已截断', { exact: true })
    .waitFor();
  await page
    .locator(`[data-row-key="${large.id}"] .ant-table-row-expand-icon`)
    .click();
  await shot('04-truncated-real');
  check(
    4,
    '真实 >4KB 快照由后端 bounded summary 返回，列表和详情显示截断标记',
    {
      auditId: large.id,
      truncated: large.truncated,
      serializedBytes:
        Buffer.byteLength(JSON.stringify(large.before)) +
        Buffer.byteLength(JSON.stringify(large.after)),
      screenshot: '04-truncated-real.png',
    },
  );
  await page.getByLabel('操作类型', { exact: true }).fill(prefix + '_absent');
  await search();
  await page.getByText('当前筛选条件下没有记录', { exact: true }).waitFor();
  await shot('empty-audit-real');
  await clear();

  const logins = await waitList('login', () =>
    page.goto(origin + '/system/login-logs'),
  );
  assertDescending(logins.list);
  assert.ok(
    logins.list.some((row) => row.result === 'success') &&
      logins.list.some((row) => row.result === 'failure'),
  );
  const sourced = logins.list.find(
    (row) => row.user_id === limited.id && row.user_agent === longUA,
  );
  assert.ok(sourced?.ip);
  const sourceRow = page.locator(`[data-row-key="${sourced.id}"]`);
  assert.ok((await sourceRow.innerText()).includes(sourced.ip));
  const uaCell = sourceRow.locator('span.truncate');
  assert.ok(
    await uaCell.evaluate(
      (element) => element.scrollWidth > element.clientWidth,
    ),
  );
  await uaCell.hover();
  await page.getByRole('tooltip').getByText(longUA, { exact: true }).waitFor();
  await shot('05-login-history-real');
  check(
    5,
    '成功与失败均存在，真实 IP/UA 与响应一致，长 UA 省略并有全文 tooltip',
    {
      results: [...new Set(logins.list.map((row) => row.result))],
      ip: sourced.ip,
      uaLength: longUA.length,
      screenshot: '05-login-history-real.png',
    },
  );
  const unknownRow = logins.list.find(
    (row) => row.user_id === null && row.user_agent === longUA,
  );
  assert.ok(unknownRow);
  assert.equal(unknownRow.username, '未知账号');
  assert.equal(unknownRow.resource_id, 'unknown');
  assert.ok(!JSON.stringify(logins).includes(attempted));
  assert.ok(!(await page.content()).includes(attempted));
  assert.ok(
    !(
      await page.locator(`[data-row-key="${unknownRow.id}"]`).innerText()
    ).includes(attempted),
  );
  await shot('06-unknown-account-real');
  check(6, '真实未知账号显示固定文案，列表网络响应和页面均无尝试输入的账号串', {
    id: unknownRow.id,
    user_id: unknownRow.user_id,
    username: unknownRow.username,
    resource_id: unknownRow.resource_id,
    responseContainsAttempt: false,
    pageContainsAttempt: false,
    screenshot: '06-unknown-account-real.png',
  });
  await page.getByLabel('用户 ID', { exact: true }).fill(String(limited.id));
  await chooseResult('失败');
  result = await search('login');
  assert.ok(
    result.list.length &&
      result.list.every(
        (row) => row.user_id === limited.id && row.result === 'failure',
      ),
  );
  await timeRange(`${today} 00:00:00`, `${today} 23:59:59`);
  result = await search('login');
  assert.ok(result.query.from && result.query.to);
  await page.getByLabel('用户 ID', { exact: true }).fill('9007199254740000');
  await search('login');
  await page.getByText('暂无登录记录', { exact: true }).waitFor();
  await shot('empty-login-real');
  await clear('login');

  for (const kind of ['audit', 'login']) {
    if (kind === 'audit')
      await waitList(kind, () => page.goto(origin + '/system/audit-logs'));
    for (const name of [/导出/, /编辑/, /删除/, /新增/, /保存/])
      assert.equal(await page.getByRole('button', { name }).count(), 0);
    await shot(`09-${kind}-readonly-real`);
    if (kind === 'audit')
      await waitList('login', () => page.goto(origin + '/system/login-logs'));
  }
  check(
    9,
    '两页无新增、编辑、删除、保存、导出按钮；仅查询、清空筛选、刷新及只读展开',
    {
      screenshots: ['09-audit-readonly-real.png', '09-login-readonly-real.png'],
    },
  );

  await page.goto(origin + '/system/users');
  await page.getByPlaceholder('用户名、昵称或邮箱').fill(prefix);
  await page.getByRole('button', { name: '查 询', exact: true }).click();
  const lockedRow = page
    .getByTestId('user-table')
    .locator(`[data-row-key="${locked.id}"]`);
  const disabledRow = page
    .getByTestId('user-table')
    .locator(`[data-row-key="${disabled.id}"]`);
  await lockedRow.getByRole('button', { name: '解 锁', exact: true }).waitFor();
  assert.equal(
    await disabledRow
      .getByRole('button', { name: '解 锁', exact: true })
      .count(),
    0,
  );
  await lockedRow.getByRole('button', { name: '解 锁', exact: true }).click();
  await page.getByText('解锁后该用户可立即尝试登录', { exact: true }).waitFor();
  await shot('07-unlock-confirm-real');
  await page
    .locator('.ant-modal-confirm')
    .getByRole('button', { name: '取 消', exact: true })
    .click();
  assert.equal((await api(`/admin/users/${locked.id}`)).status, 'locked');
  await lockedRow.getByRole('button', { name: '解 锁', exact: true }).click();
  const unlocking = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname ===
      `/api/v1/admin/users/${locked.id}/unlock`,
  );
  await page
    .locator('.ant-modal-confirm')
    .getByRole('button', { name: '确 定', exact: true })
    .click();
  const unlocked = await unlocking;
  assert.equal(unlocked.status(), 200);
  assert.equal((await unlocked.json()).data.status, 'active');
  await lockedRow
    .locator('.ant-tag')
    .getByText('启用', { exact: true })
    .waitFor();
  assert.equal(
    await lockedRow.getByRole('button', { name: '解 锁', exact: true }).count(),
    0,
  );
  const afterLogin = await request(
    '/auth/login',
    'POST',
    { username: locked.username, password },
    null,
  );
  assert.equal(afterLogin.status, 200);
  const afterLoginOverview = await request(
    '/auth/me',
    'GET',
    undefined,
    afterLogin.data.access_token,
  );
  assert.equal(afterLoginOverview.status, 200);
  await shot('07-unlocked-active-real');
  check(
    7,
    '取消不变更；确认后真实 POST=200，状态 active，解锁入口消失，随后可正常登录',
    {
      userId: locked.id,
      unlockStatus: 200,
      status: 'active',
      loginStatus: afterLogin.status,
      overviewStatus: afterLoginOverview.status,
      screenshots: [
        '07-unlock-confirm-real.png',
        '07-unlocked-active-real.png',
      ],
    },
  );
  const disabledUnlock = await request(
    `/admin/users/${disabled.id}/unlock`,
    'POST',
  );
  assert.equal(disabledUnlock.status, 409);
  await setStatus(locked, 'locked');
  await page.getByRole('button', { name: '查 询', exact: true }).click();
  await lockedRow.getByRole('button', { name: '解 锁', exact: true }).waitFor();
  await lockedRow.getByRole('button', { name: '解 锁', exact: true }).click();
  await setStatus(locked, 'disabled');
  const conflict = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname ===
      `/api/v1/admin/users/${locked.id}/unlock`,
  );
  await page
    .locator('.ant-modal-confirm')
    .getByRole('button', { name: '确 定', exact: true })
    .click();
  assert.equal((await conflict).status(), 409);
  await page
    .getByText('该用户已禁用，无法解锁，请刷新列表', { exact: true })
    .waitFor();
  await shot('08-disabled-conflict-real');
  check(
    8,
    'disabled 无解锁按钮，直调真实接口 409；确认期间变为 disabled 时页面提示明确',
    {
      directStatus: disabledUnlock.status,
      code: disabledUnlock.envelope.code,
      concurrentStatus: 409,
      screenshot: '08-disabled-conflict-real.png',
    },
  );

  const dictionary = await api('/admin/permissions');
  const permission = Object.values(dictionary)
    .flat()
    .find((entry) => entry.code === 'system:user:list');
  createdRole = await api('/admin/roles', 'POST', {
    code: prefix,
    name: 'SF3 无审计权限',
    data_scope: 'all',
    remark: null,
    status: 'active',
  });
  await api(`/admin/roles/${createdRole.id}/permissions`, 'PUT', {
    permission_ids: [permission.id],
  });
  await api(`/admin/roles/${createdRole.id}/menus`, 'PUT', {
    menu_ids: [
      ...new Set([auditMenu.id, loginMenu.id, userMenu.id, userMenu.parent_id]),
    ].filter(Boolean),
  });
  await api(`/admin/users/${limited.id}/roles`, 'PUT', {
    role_ids: [createdRole.id],
  });
  const limitedContext = await browser.newContext({
    viewport: { width: 1600, height: 1050 },
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
  });
  const limitedPage = await limitedContext.newPage();
  watch(limitedPage);
  const limitedAuth = await login(limitedPage, limited.username, password);
  await limitedPage.goto(origin + '/system/users');
  await limitedPage.getByTestId('user-table').waitFor();
  assert.equal(
    await limitedPage
      .getByRole('menuitem')
      .filter({ hasText: /审计日志|登录历史/ })
      .count(),
    0,
  );
  assert.equal(
    await limitedPage
      .getByRole('button', { name: '解 锁', exact: true })
      .count(),
    0,
  );
  const forbidden = [];
  for (const kind of ['audit', 'login']) {
    const denied = await request(
      `/admin/${kind}-logs`,
      'GET',
      undefined,
      limitedAuth.access_token,
    );
    assert.equal(denied.status, 403);
    assert.equal(denied.envelope.code, 20_107);
    forbidden.push({
      path: `/admin/${kind}-logs`,
      status: denied.status,
      code: denied.envelope.code,
      traceId: denied.envelope.trace_id,
    });
    await limitedPage.goto(origin + `/system/${kind}-logs`);
    await limitedPage.locator('p.text-2xl').waitFor();
    assert.match(
      await limitedPage.locator('p.text-2xl').innerText(),
      /访问|权限/,
    );
    assert.equal(await limitedPage.getByTestId(`${kind}-log-list`).count(), 0);
    await shot(`10-${kind}-forbidden-real`, limitedPage);
  }
  await limitedContext.close();
  check(
    10,
    '真实仅 system:user:list 角色保留菜单授权仍隐藏两菜单；直连前端403，直接两接口403；无更新权限无解锁入口',
    {
      forbidden,
      screenshots: [
        '10-audit-forbidden-real.png',
        '10-login-forbidden-real.png',
      ],
    },
  );
  assert.deepEqual(browserErrors, []);
} catch (error) {
  failure = { name: error.name, message: error.message, stack: error.stack };
  if (page) await shot('failure').catch(() => {});
} finally {
  await browser.close();
  async function clean(resource, action) {
    try {
      await action();
      cleanup.push({ resource, result: 'removed' });
    } catch (error) {
      cleanup.push({ resource, result: 'failed', message: error.message });
    }
  }
  if (createdMenu)
    await clean('temporary menu', () =>
      api(`/admin/menus/${createdMenu.id}`, 'DELETE'),
    );
  for (const user of createdUsers)
    await clean(`temporary user ${user.id}`, async () => {
      await api(`/admin/users/${user.id}/roles`, 'PUT', { role_ids: [] });
      await api(`/admin/users/${user.id}`, 'DELETE');
    });
  if (createdRole)
    await clean('temporary role', async () => {
      await api(`/admin/roles/${createdRole.id}/menus`, 'PUT', {
        menu_ids: [],
      });
      await api(`/admin/roles/${createdRole.id}/permissions`, 'PUT', {
        permission_ids: [],
      });
      await api(`/admin/roles/${createdRole.id}`, 'DELETE');
    });
  const report = {
    source: 'real-18080',
    date: new Date().toISOString(),
    checks: checks.sort((a, b) => a.item - b.item),
    browserErrors,
    cleanup,
    ...(failure ? { failure } : {}),
  };
  await writeFile(
    new URL('real-ui.json', output),
    JSON.stringify(report, null, 2),
  );
}
assert.ok(!failure, failure?.message);
assert.ok(
  cleanup.every((entry) => entry.result === 'removed'),
  'Temporary resources cleaned',
);
assert.equal(checks.length, 10);
process.stdout.write(
  JSON.stringify({
    passed: checks.length,
    browserErrors: browserErrors.length,
    cleanup: cleanup.length,
  }) + '\n',
);
