import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

// eslint-disable-next-line n/no-extraneous-import -- Workspace browser test tooling.
import { chromium } from 'playwright';

const origin = process.env.SF1_ORIGIN || 'http://127.0.0.1:5666';
const backend = process.env.SF1_BACKEND || 'http://127.0.0.1:18080';
assert.ok(process.env.SF1_ADMIN_PASSWORD, 'Set SF1_ADMIN_PASSWORD');
const output = new URL('../../../docs/evidence/sf-1/', import.meta.url);
await mkdir(output, { recursive: true });
const checks = [];
const responses = [];
const errors = [];
const cleanupErrors = [];
const createdIds = new Set();
const suffix = randomBytes(4).toString('hex');
const password =
  process.env.SF1_TEST_PASSWORD || 'Sf1!' + randomBytes(16).toString('hex');
const writeCodes = [
  'system:dept:create',
  'system:dept:update',
  'system:dept:delete',
];
let token;
let baseline;
let missingCodes = [];
let role;
let user;
let departmentMenu;
let failure;
let browser;
let page;
let mode;

async function request(path, method = 'GET', data, bearer = token) {
  const response = await fetch(backend + '/api/v1' + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Accept-Language': 'zh-CN',
      ...(bearer ? { Authorization: 'Bearer ' + bearer } : {}),
    },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  const body = response.status === 204 ? undefined : await response.json();
  responses.push({
    source: 'api',
    path,
    method,
    status: response.status,
    code: body?.code,
    trace_id: body?.trace_id,
    message: response.ok ? undefined : body?.message,
  });
  return { response, body };
}
async function api(path, method = 'GET', data, bearer = token) {
  const { response, body } = await request(path, method, data, bearer);
  assert.ok(
    response.ok,
    method + ' ' + path + ': HTTP ' + response.status + ' / ' + body?.code,
  );
  return body?.data;
}
const flatten = (nodes) =>
  nodes.flatMap((node) => [node, ...flatten(node.children ?? [])]);
const editable = (department, changes = {}) => ({
  parent_id: department.parent_id,
  name: department.name,
  sort: department.sort,
  status: department.status,
  ...changes,
});
const row = (id, target = page) =>
  target.locator('[data-dept-id="' + id + '"]');
const form = () => page.getByTestId('department-form');
const detail = () => page.getByTestId('department-detail');
function watchErrors(target) {
  target.on('pageerror', (error) =>
    errors.push({
      message: error.message,
      stack: error.stack,
      afterCheck: checks.at(-1)?.item,
      url: target.url(),
    }),
  );
}
const shot = (name, target = page) =>
  target.screenshot({
    path: fileURLToPath(new URL(name + '.png', output)),
    fullPage: true,
    animations: 'disabled',
  });
async function login(target, username, accountPassword) {
  await target.goto(origin + '/auth/login');
  await target.getByPlaceholder('请输入用户名').fill(username);
  await target.getByPlaceholder('密码', { exact: true }).fill(accountPassword);
  const response = target.waitForResponse(
    (value) =>
      new URL(value.url()).pathname === '/api/v1/auth/login' &&
      value.request().method() === 'POST',
  );
  await target.getByRole('button', { name: 'login', exact: true }).click();
  const result = await response;
  assert.equal(result.status(), 200, 'Browser login');
  await target.waitForURL((url) => !url.pathname.startsWith('/auth/'));
  return (await result.json()).data;
}
async function watchWrite(path, method, action, expected) {
  const response = page.waitForResponse(
    (value) =>
      new URL(value.url()).pathname === '/api/v1' + path &&
      value.request().method() === method,
  );
  const treeReload =
    expected < 400
      ? page.waitForResponse(
          (value) =>
            new URL(value.url()).pathname === '/api/v1/admin/depts' &&
            value.request().method() === 'GET',
        )
      : undefined;
  // A rejected write does not reload the tree; keep its pending waiter handled.
  treeReload?.catch(() => {});
  await action();
  const result = await response;
  assert.equal(result.status(), expected);
  const body = expected === 204 ? undefined : await result.json();
  if (treeReload) {
    assert.equal((await treeReload).status(), 200);
    await form().waitFor({ state: 'hidden' });
  }
  return body;
}
async function refresh(id) {
  const loaded = page.waitForResponse(
    (value) =>
      new URL(value.url()).pathname === '/api/v1/admin/depts' &&
      value.request().method() === 'GET',
  );
  await page.getByRole('button', { name: /^刷\s*新$/, exact: true }).click();
  assert.equal((await loaded).status(), 200);
  await row(id).waitFor();
  await row(id).locator('span').first().click();
  await detail().waitFor();
}
async function pickParent(name) {
  await form().getByLabel('上级部门', { exact: true }).click();
  await page
    .locator('.ant-select-dropdown:visible')
    .getByText(name, { exact: true })
    .last()
    .click();
}
async function create(name, parent) {
  let result;
  if (mode === 'ui') {
    await (
      parent
        ? row(parent).getByRole('button', { name: '新增子部门', exact: true })
        : page.getByRole('button', { name: '新增根部门', exact: true })
    ).click();
    await form().getByLabel('部门名称', { exact: true }).fill(name);
    result = (
      await watchWrite(
        '/admin/depts',
        'POST',
        () =>
          form()
            .getByRole('button', { name: /^保\s*存$/ })
            .click(),
        201,
      )
    ).data;
  } else {
    result = await api('/admin/depts', 'POST', {
      parent_id: parent,
      name,
      sort: 0,
      status: 'active',
    });
    createdIds.add(result.id);
    await refresh(result.id);
  }
  createdIds.add(result.id);
  await row(result.id).waitFor();
  return result;
}
async function update(department, changes) {
  if (mode === 'ui') {
    await row(department.id)
      .getByRole('button', { name: /^编\s*辑$/ })
      .click();
    await form().waitFor();
    if (changes.name !== undefined)
      await form().getByLabel('部门名称', { exact: true }).fill(changes.name);
    if (changes.parent_id !== undefined) {
      const parents = flatten(await api('/admin/depts'));
      await pickParent(
        changes.parent_id
          ? parents.find((node) => node.id === changes.parent_id).name
          : '无（根）',
      );
    }
    if (changes.sort !== undefined)
      await form()
        .getByLabel('部门排序', { exact: true })
        .fill(String(changes.sort));
    if (changes.status !== undefined) {
      await form().getByLabel('部门状态', { exact: true }).click();
      await page
        .locator('.ant-select-dropdown:visible')
        .getByText(changes.status === 'active' ? '启用' : '停用', {
          exact: true,
        })
        .click();
    }
    return (
      await watchWrite(
        '/admin/depts/' + department.id,
        'PUT',
        () =>
          form()
            .getByRole('button', { name: /^保\s*存$/ })
            .click(),
        200,
      )
    ).data;
  }
  const result = await api(
    '/admin/depts/' + department.id,
    'PUT',
    editable(department, changes),
  );
  await refresh(department.id);
  return result;
}
async function remove(department, status) {
  if (mode !== 'ui') {
    const result = await request('/admin/depts/' + department.id, 'DELETE');
    assert.equal(result.response.status, status);
    if (status === 204) await refresh(baseline[0].id);
    return result.body;
  }
  await row(department.id)
    .getByRole('button', { name: /^删\s*除$/ })
    .click();
  const dialog = page.getByRole('dialog').last();
  await dialog
    .getByText(
      '删除「' +
        department.name +
        '」后不可恢复。若该部门下有子部门或在册用户，后端会拒绝删除。',
      { exact: true },
    )
    .waitFor();
  const result = await watchWrite(
    '/admin/depts/' + department.id,
    'DELETE',
    () => dialog.getByRole('button', { name: '确认删除', exact: true }).click(),
    status,
  );
  await dialog.waitFor({ state: 'hidden' });
  return result;
}
function mutationCheck(item, assertion, evidence) {
  checks.push({
    item,
    result: mode === 'ui' ? 'passed' : 'api-and-component-verified-ui-blocked',
    assertion,
    ...evidence,
  });
}

try {
  token = (
    await api(
      '/auth/login',
      'POST',
      {
        username: 'admin',
        password: process.env.SF1_ADMIN_PASSWORD,
      },
      null,
    )
  ).access_token;
  const authMenus = await api('/auth/menus');
  const dictionary = await api('/admin/permissions');
  missingCodes = writeCodes.filter(
    (code) => !authMenus.permissions.includes(code),
  );
  mode = missingCodes.length ? 'backend-blocked' : 'ui';
  baseline = await api('/admin/depts');
  assert.equal(flatten(baseline).length, 8, 'Eight baseline departments');
  assert.equal(baseline.length, 1);
  assert.equal(baseline[0].children.length, 3);
  assert.equal(
    baseline[0].children.reduce((sum, node) => sum + node.children.length, 0),
    4,
  );
  const menus = flatten(await api('/admin/menus'));
  departmentMenu = menus.find(
    (menu) =>
      menu.component?.replace(/^\/|\.vue$/g, '') === 'system/dept/index',
  );
  assert.ok(departmentMenu, 'Department menu has already been provisioned');
  const projectedMenu = flatten(authMenus.menus).find(
    (menu) => menu.path === departmentMenu.path,
  );
  assert.ok(projectedMenu, 'Department navigation is projected by /auth/menus');
  assert.equal(
    flatten(authMenus.menus).filter((menu) => menu.type === 'button').length,
    0,
    'Button permissions are supplied independently of navigation nodes',
  );
  await writeFile(
    new URL('backend-prerequisites.json', output),
    JSON.stringify(
      {
        ready: missingCodes.length === 0,
        source: '/auth/menus.permissions[]',
        permissions: writeCodes.filter((code) =>
          authMenus.permissions.includes(code),
        ),
        missingCodes,
        navigation: projectedMenu,
        buttonNodes: 0,
      },
      null,
      2,
    ),
  );
  browser = await chromium.launch({
    channel: process.platform === 'win32' ? 'chrome' : undefined,
    headless: true,
  });
  const context = await browser.newContext({
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    viewport: { width: 1780, height: 1100 },
  });
  page = await context.newPage();
  watchErrors(page);
  page.on('response', async (response) => {
    const path = new URL(response.url()).pathname;
    if (!path.startsWith('/api/')) return;
    const body = await response.json().catch(() => undefined);
    responses.push({
      source: 'browser',
      path,
      method: response.request().method(),
      status: response.status(),
      code: body?.code,
      trace_id: body?.trace_id,
      message: response.status() >= 400 ? body?.message : undefined,
    });
  });
  await login(page, 'admin', process.env.SF1_ADMIN_PASSWORD);
  await page.goto(origin + departmentMenu.path);
  await page.getByTestId('department-tree').waitFor();
  await detail().waitFor();
  assert.equal(await page.locator('[data-dept-id]').count(), 8);
  for (const department of flatten(baseline)) {
    assert.equal(
      await row(department.id)
        .locator('.ant-scroll-number')
        .getAttribute('title'),
      '成员数：' + department.member_count,
    );
    const expectedDepth = department.path.split('.').length - 1;
    assert.equal(
      await row(department.id)
        .locator('xpath=ancestor::*[contains(@class,"ant-tree-treenode")][1]')
        .locator('.ant-tree-indent-unit')
        .count(),
      expectedDepth,
    );
  }
  await shot('01-tree-eight-departments');
  checks.push({
    item: 1,
    result: 'passed',
    assertion: '8 个真实部门层级与直接成员数逐一对照 API',
    departments: baseline,
    screenshot: '01-tree-eight-departments.png',
  });

  const search = page.getByLabel('搜索部门', { exact: true });
  await search.fill('商品组');
  await page.waitForFunction(
    () => document.querySelectorAll('[data-dept-id]').length === 3,
  );
  await search.fill('SF1 没有匹配结果');
  await page.getByText('没有匹配的部门', { exact: true }).waitFor();
  await shot('search-no-results');
  await search.fill('');
  await row(8).waitFor();

  if (missingCodes.length) {
    assert.equal(
      await page
        .getByRole('button', { name: '新增根部门', exact: true })
        .count(),
      0,
    );
    assert.equal(
      await page.getByRole('button', { name: /^编\s*辑$/ }).count(),
      0,
    );
    assert.equal(
      await page.getByRole('button', { name: /^删\s*除$/ }).count(),
      0,
    );
    await shot('admin-missing-permissions');
    console.log(
      'Backend prerequisites missing; verifying read-only UI and permissions. Department writes are skipped.',
    );
  }

  if (mode !== 'ui') {
    const probe = await request('/admin/depts', 'POST', {});
    await writeFile(
      new URL('backend-prerequisites.json', output),
      JSON.stringify(
        {
          missingCodes,
          createProbe: {
            status: probe.response.status,
            code: probe.body?.code,
            message: probe.body?.message,
          },
          note: 'Empty request is a non-mutating route probe. No department write acceptance is claimed.',
        },
        null,
        2,
      ),
    );
    for (let item = 2; item <= 8; item++)
      checks.push({
        item,
        result: 'blocked',
        assertion:
          '后端写路由/权限尚未就绪；组件回归已覆盖，真实界面写操作未验收',
        probeStatus: probe.response.status,
        missingCodes,
      });
  } else {
    const root = await create('SF1 根部门 ' + suffix, 0);
    assert.equal(root.path, String(root.id));
    const parent = await create('SF1 一级 ' + suffix, baseline[0].id);
    const sibling = await create('SF1 目标 ' + suffix, baseline[0].id);
    const child = await create('SF1 二级 ' + suffix, parent.id);
    assert.equal(parent.path, baseline[0].path + '.' + parent.id);
    assert.equal(child.path, parent.path + '.' + child.id);
    await shot('02-created-levels');
    mutationCheck(2, '根、一级、二级部门真实创建并按父链核对 path', {
      departments: [root, parent, child],
      screenshot: '02-created-levels.png',
    });

    const renamed = await update(child, {
      name: 'SF1 已改名 ' + suffix,
      sort: -5,
      status: 'disabled',
    });
    assert.equal((await api('/admin/depts/' + child.id)).name, renamed.name);
    await detail().getByText(renamed.name, { exact: true }).waitFor();
    await row(child.id).getByText('停用', { exact: true }).waitFor();
    await shot('03-renamed-detail');
    mutationCheck(3, '改名、排序 -5、停用状态经详情 API 和树/详情 UI 回读', {
      department: renamed,
      screenshot: '03-renamed-detail.png',
    });

    const start = responses.length;
    const moved = await update(parent, { parent_id: sibling.id });
    const movedTree = await api('/admin/depts');
    const movedParent = flatten(movedTree).find(
      (node) => node.id === parent.id,
    );
    const movedChild = flatten(movedTree).find((node) => node.id === child.id);
    assert.equal(movedParent.path, sibling.path + '.' + parent.id);
    assert.equal(movedChild.path, movedParent.path + '.' + child.id);
    assert.equal(movedParent.children[0].id, child.id);
    const network = responses
      .slice(start)
      .filter((entry) => entry.source === 'browser');
    const writeIndex = network.findIndex((entry) => entry.method === 'PUT');
    if (mode === 'ui')
      assert.ok(
        network
          .slice(writeIndex + 1)
          .some(
            (entry) =>
              entry.method === 'GET' && entry.path === '/api/v1/admin/depts',
          ),
        'The UI requests the entire tree after the parent move',
      );
    assert.equal(
      await row(child.id)
        .locator('xpath=ancestor::*[contains(@class,"ant-tree-treenode")][1]')
        .locator('.ant-tree-indent-unit')
        .count(),
      3,
    );
    await shot('04-moved-subtree');
    mutationCheck(4, '移动带子部门的节点，整个子树 path 和 UI 缩进正确', {
      automaticTreeReload: mode === 'ui',
      network,
      subtree: movedParent,
      screenshot: '04-moved-subtree.png',
    });

    if (mode === 'ui') {
      await row(parent.id)
        .getByRole('button', { name: /^编\s*辑$/ })
        .click();
      await form().getByLabel('上级部门', { exact: true }).click();
      const dropdown = page.locator('.ant-select-dropdown:visible');
      for (const name of [parent.name, renamed.name]) {
        const option = dropdown
          .getByText(name, { exact: true })
          .last()
          .locator(
            'xpath=ancestor::*[contains(@class,"ant-select-tree-treenode")][1]',
          );
        assert.match(
          await option.getAttribute('class'),
          /ant-select-tree-treenode-disabled/,
        );
      }
      await shot('05-blocked-parent-options');
      await form().getByLabel('上级部门', { exact: true }).press('Escape');
      await form()
        .getByRole('button', { name: /^取\s*消$/ })
        .click();
      checks.push({
        item: 5,
        result: 'passed',
        assertion: '当前节点与后代在真实父级选择器中禁用',
        screenshot: '05-blocked-parent-options.png',
      });
    } else {
      checks.push({
        item: 5,
        result: 'component-verified-ui-blocked',
        assertion:
          '真实 Vue 组件/三代树单测覆盖；admin 缺写权限，无法进入真实编辑选择器',
        tests: ['department-tree.test.ts', 'department-page.test.ts'],
      });
    }

    let duplicate;
    if (mode === 'ui') {
      await row(parent.id)
        .getByRole('button', { name: '新增子部门', exact: true })
        .click();
      await form().getByLabel('部门名称', { exact: true }).fill(renamed.name);
      duplicate = await watchWrite(
        '/admin/depts',
        'POST',
        () =>
          form()
            .getByRole('button', { name: /^保\s*存$/ })
            .click(),
        400,
      );
      await form()
        .locator('.ant-alert-message')
        .getByText(duplicate.message, { exact: true })
        .waitFor();
      await shot('06-duplicate-400-verbatim');
      await form()
        .getByRole('button', { name: /^取\s*消$/ })
        .click();
    } else {
      const result = await request('/admin/depts', 'POST', editable(renamed));
      assert.equal(result.response.status, 400);
      duplicate = result.body;
    }
    mutationCheck(6, '同父重名真实返回 HTTP 400；文案按原文验证', {
      status: 400,
      message: duplicate.message,
      screenshot: mode === 'ui' ? '06-duplicate-400-verbatim.png' : undefined,
    });

    const protectedDelete = await remove(moved, 409);
    if (mode === 'ui') {
      await page
        .locator('.ant-alert-message')
        .getByText(protectedDelete.message, { exact: true })
        .waitFor();
      await shot('07-protected-delete-409-verbatim');
    }
    mutationCheck(7, '有子部门的节点真实删除返回 409；文案按原文验证', {
      status: 409,
      message: protectedDelete.message,
      screenshot:
        mode === 'ui' ? '07-protected-delete-409-verbatim.png' : undefined,
    });
    await remove(renamed, 204);
    createdIds.delete(child.id);
    await row(child.id).waitFor({ state: 'hidden' });
    await shot('08-deleted-empty-department');
    mutationCheck(8, '空部门删除返回 204，刷新后从树消失', {
      deletedId: child.id,
      screenshot: '08-deleted-empty-department.png',
    });
  }
  role = await api('/admin/roles', 'POST', {
    code: 'sf1_' + suffix,
    name: 'SF1 只读验收 ' + suffix,
    data_scope: 'all',
    remark: null,
    status: 'active',
  });
  const listPermission = dictionary.system.find(
    (permission) => permission.code === 'system:user:list',
  );
  await api('/admin/roles/' + role.id + '/permissions', 'PUT', {
    permission_ids: [listPermission.id],
  });
  await api('/admin/roles/' + role.id + '/menus', 'PUT', {
    menu_ids: [departmentMenu.parent_id, departmentMenu.id].filter(Boolean),
  });
  user = await api('/admin/users', 'POST', {
    username: 'sf1_' + suffix,
    nickname: 'SF1 只读验收',
    password,
    dept_id: baseline[0].id,
    status: 'active',
  });
  await api('/admin/users/' + user.id + '/roles', 'PUT', {
    role_ids: [role.id],
  });
  const reset = new URL(
    (await api('/admin/users/' + user.id + '/reset-link', 'POST')).link,
    backend,
  );
  const personalPassword = password + '2';
  await api(
    '/auth/password/reset',
    'POST',
    {
      tenant_id: Number(reset.searchParams.get('tenant_id')),
      token: new URLSearchParams(reset.hash.slice(1)).get('token'),
      newPassword: personalPassword,
    },
    null,
  );
  const limitedContext = await browser.newContext({
    locale: 'zh-CN',
    viewport: { width: 1600, height: 1000 },
  });
  const limitedPage = await limitedContext.newPage();
  watchErrors(limitedPage);
  const limitedLogin = await login(
    limitedPage,
    user.username,
    personalPassword,
  );
  await limitedPage.goto(origin + departmentMenu.path);
  await limitedPage.getByTestId('department-tree').waitFor();
  for (const name of ['新增根部门', '新增子部门', /^编\s*辑$/, /^删\s*除$/]) {
    assert.equal(
      await limitedPage.getByRole('button', { name, exact: true }).count(),
      0,
    );
  }
  const forbidden = [];
  for (const [path, method] of [
    ['/admin/depts', 'POST'],
    ['/admin/depts/' + baseline[0].id, 'PUT'],
    ['/admin/depts/' + baseline[0].id, 'DELETE'],
  ]) {
    const result = await request(
      path,
      method,
      method === 'DELETE' ? undefined : {},
      limitedLogin.access_token,
    );
    forbidden.push({
      path,
      method,
      status: result.response.status,
      code: result.body.code,
      message: result.body.message,
    });
  }
  await shot('09-readonly-hidden-buttons', limitedPage);
  checks.push({
    item: 9,
    result: forbidden.every((entry) => entry.status === 403)
      ? 'passed'
      : 'ui-hidden-backend-403-blocked',
    assertion: '真实只读账号看不到四类操作入口，直接请求状态按 forbidden 记录',
    forbidden,
    screenshot: '09-readonly-hidden-buttons.png',
  });
  await limitedContext.close();
  assert.deepEqual(errors, [], 'No browser runtime errors');
} catch (error) {
  failure = error;
  console.error(error);
  await page
    ?.screenshot({
      path: fileURLToPath(new URL('failure.png', output)),
      fullPage: true,
    })
    .catch(() => {});
} finally {
  const clean = async (label, action) => {
    try {
      await action();
    } catch (error) {
      cleanupErrors.push({ label, error: String(error) });
    }
  };
  if (user)
    await clean('temporary user', async () => {
      await api('/admin/users/' + user.id + '/roles', 'PUT', { role_ids: [] });
      await api('/admin/users/' + user.id, 'DELETE');
    });
  if (role)
    await clean('temporary role', async () => {
      for (const [relation, field] of [
        ['menus', 'menu_ids'],
        ['permissions', 'permission_ids'],
        ['depts', 'dept_ids'],
      ]) {
        await api('/admin/roles/' + role.id + '/' + relation, 'PUT', {
          [field]: [],
        });
      }
      await api('/admin/roles/' + role.id, 'DELETE');
    });
  if (baseline)
    await clean('temporary departments', async () => {
      const isTemporary = (node) =>
        createdIds.has(node.id) ||
        (node.name.startsWith('SF1 ') && node.name.endsWith(suffix));
      let nodes = flatten(await api('/admin/depts')).filter(isTemporary);
      for (const node of nodes.filter((item) => !item.parent_id)) {
        await api(
          '/admin/depts/' + node.id,
          'PUT',
          editable(node, { parent_id: baseline[0].id }),
        );
      }
      nodes = flatten(await api('/admin/depts')).filter(isTemporary);
      nodes.sort(
        (left, right) =>
          right.path.split('.').length - left.path.split('.').length,
      );
      for (const node of nodes) await api('/admin/depts/' + node.id, 'DELETE');
    });
  if (baseline)
    await clean('baseline restoration', async () => {
      const final = await api('/admin/depts');
      assert.deepEqual(
        final,
        baseline,
        'All original departments and member counts are unchanged',
      );
      await writeFile(
        new URL('final-data.json', output),
        JSON.stringify(
          {
            restored: true,
            departments: final,
            temporaryUsers: (await api('/admin/users?page_size=100')).list
              .filter((item) => item.username.startsWith('sf1_'))
              .map((item) => item.id),
            temporaryRoles: (await api('/admin/roles?page_size=100')).list
              .filter((item) => item.code.startsWith('sf1_'))
              .map((item) => item.id),
          },
          null,
          2,
        ),
      );
    });
  await browser?.close();
  const report = {
    passed:
      !failure &&
      cleanupErrors.length === 0 &&
      checks.every((check) => check.result === 'passed'),
    readUiPassed: !failure && cleanupErrors.length === 0,
    mode,
    missingCodes,
    navigation: {
      menuId: departmentMenu?.id,
      path: departmentMenu?.path,
    },
    checks,
    errors,
    cleanupErrors,
    responses,
    failure: failure ? String(failure) : undefined,
  };
  await writeFile(
    new URL('report.json', output),
    JSON.stringify(report, null, 2),
  );
  console.log(
    JSON.stringify(
      {
        passed: report.passed,
        readUiPassed: report.readUiPassed,
        mode,
        missingCodes,
        checks: checks.map(({ item, result }) => ({ item, result })),
        cleanupErrors,
      },
      null,
      2,
    ),
  );
  if (failure || cleanupErrors.length) process.exitCode = 1;
  else if (!report.passed) process.exitCode = 2;
}
