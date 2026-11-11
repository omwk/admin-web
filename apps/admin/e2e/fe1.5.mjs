import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

// eslint-disable-next-line n/no-extraneous-import -- Workspace browser test tooling.
import { chromium } from 'playwright';

const origin = process.env.FE15_ORIGIN || 'http://127.0.0.1:5666';
const backend = process.env.FE15_BACKEND || 'http://127.0.0.1:18080';
const phase =
  process.argv.find((value) => value.startsWith('--phase='))?.split('=')[1] ||
  'users';
assert.ok(process.env.FE15_ADMIN_PASSWORD, 'Set FE15_ADMIN_PASSWORD');
assert.ok(process.env.FE15_TEST_PASSWORD, 'Set FE15_TEST_PASSWORD');
const output = new URL('../../../docs/evidence/fe-1.5/', import.meta.url);
await mkdir(output, { recursive: true });
const checks = [];
const responses = [];
const errors = [];
const cleanup = [];
let token;
let failure;
async function api(path, method = 'GET', data, authenticated = true) {
  const response = await fetch(`${backend}/api/v1${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(authenticated ? { Authorization: `Bearer ${token}` } : {}),
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
  });
  assert.ok(
    response.ok,
    `${method} ${path}: ${response.status} code ${body?.code}`,
  );
  return body?.data;
}
token = (
  await api(
    '/auth/login',
    'POST',
    { username: 'admin', password: process.env.FE15_ADMIN_PASSWORD },
    false,
  )
).access_token;
const browser = await chromium.launch({
  channel: process.platform === 'win32' ? 'chrome' : undefined,
  headless: true,
});
const context = await browser.newContext({
  locale: 'zh-CN',
  timezoneId: 'Asia/Shanghai',
  viewport: { width: 1780, height: 1100 },
  permissions: ['clipboard-read', 'clipboard-write'],
});
const page = await context.newPage();
let diagnosticPage = page;
page.on('pageerror', (error) => errors.push(error.message));
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
  });
});
const shot = (name) =>
  page.screenshot({
    path: fileURLToPath(new URL(`${name}.png`, output)),
    fullPage: true,
    animations: 'disabled',
    mask: [page.getByLabel('账号链接')],
  });
const dialog = () => page.getByRole('dialog').last();
const ok = () => dialog().getByRole('button', { name: /确\s*定/ });
const row = (username) =>
  page
    .locator('[data-testid="user-table"] tbody tr')
    .filter({ has: page.getByRole('cell', { name: username, exact: true }) });
async function login(target, username, password) {
  await target.goto(`${origin}/auth/login`);
  await target.getByPlaceholder('请输入用户名').fill(username);
  await target.getByPlaceholder('密码', { exact: true }).fill(password);
  await target.getByRole('button', { name: 'login', exact: true }).click();
  await target.waitForURL((url) => !url.pathname.startsWith('/auth/'));
}
async function pick(label, value) {
  await dialog().getByLabel(label, { exact: true }).click();
  await page
    .locator('.ant-select-dropdown:visible')
    .getByText(value, { exact: true })
    .last()
    .click();
}
async function waitWrite(path, action, method = 'PUT') {
  const response = page.waitForResponse(
    (value) =>
      new URL(value.url()).pathname === `/api/v1${path}` &&
      value.request().method() === method,
  );
  await action();
  const result = await response;
  assert.ok(result.ok(), `${method} ${path}: ${result.status()}`);
  return result.status() === 204 ? undefined : (await result.json()).data;
}

try {
  await login(page, 'admin', process.env.FE15_ADMIN_PASSWORD);
  await page.goto(`${origin}/system/users`);
  await page.getByRole('button', { name: '新增用户', exact: true }).waitFor();
  const username = `fe15_${Date.now()}`;
  await page.getByRole('button', { name: '新增用户', exact: true }).click();
  await dialog().getByRole('button', { name: '直接建号', exact: true }).click();
  await dialog().getByLabel('用户名', { exact: true }).fill(username);
  await dialog().getByLabel('初始密码').fill(process.env.FE15_TEST_PASSWORD);
  await pick('部门', '根部门');
  const user = await waitWrite('/admin/users', () => ok().click(), 'POST');
  cleanup.push(() => api(`/admin/users/${user.id}`, 'DELETE'));
  await dialog().waitFor({ state: 'hidden' });
  await row(username).waitFor();
  await row(username)
    .getByRole('button', { name: /编\s*辑/ })
    .click();
  await dialog().getByLabel('昵称', { exact: true }).fill('FE1.5 用户编辑验收');
  await waitWrite(`/admin/users/${user.id}`, () => ok().click());
  await row(username)
    .getByText('FE1.5 用户编辑验收', { exact: true })
    .waitFor();
  await shot('03-user-edit');
  checks.push({
    item: 3,
    assertion: '昵称、部门写入后列表即时刷新',
    user_id: user.id,
    nickname: 'FE1.5 用户编辑验收',
    dept_id: user.dept_id,
    screenshot: '03-user-edit.png',
  });

  await row(username)
    .getByRole('button', { name: /禁\s*用/ })
    .click();
  await waitWrite(`/admin/users/${user.id}`, () => ok().click());
  await row(username)
    .getByRole('button', { name: /启\s*用/ })
    .waitFor();
  assert.equal((await api(`/admin/users/${user.id}`)).status, 'disabled');
  await row(username)
    .getByRole('button', { name: /启\s*用/ })
    .click();
  await waitWrite(`/admin/users/${user.id}`, () => ok().click());
  await row(username)
    .getByRole('button', { name: /禁\s*用/ })
    .waitFor();
  checks.push({
    item: 'step1-disable',
    assertion: '禁用、启用均写后刷新',
    passed: true,
  });

  await row(username)
    .getByRole('button', { name: '分配角色', exact: true })
    .click();
  await dialog().getByLabel('运营 (operator)').check();
  await dialog().getByLabel('销售 (sales)').check();
  await waitWrite(`/admin/users/${user.id}/roles`, () => ok().click());
  await dialog().waitFor({ state: 'hidden' });
  await row(username)
    .getByRole('button', { name: '分配角色', exact: true })
    .click();
  await page.waitForFunction(
    () =>
      document.querySelectorAll('.ant-modal-body input[type=checkbox]:checked')
        .length === 2,
  );
  assert.equal(await dialog().getByLabel('运营 (operator)').isChecked(), true);
  assert.equal(await dialog().getByLabel('销售 (sales)').isChecked(), true);
  await shot('04-user-two-roles');
  checks.push({
    item: 4,
    assertion: '两个角色保存后重新打开回显',
    ids: await api(`/admin/users/${user.id}/roles`),
    screenshot: '04-user-two-roles.png',
  });
  await dialog()
    .getByRole('button', { name: /取\s*消/ })
    .click();

  await row(username)
    .getByRole('button', { name: '生成重置链接', exact: true })
    .click();
  await dialog().getByLabel('账号链接').waitFor();
  const resetLink = await dialog().getByLabel('账号链接').inputValue();
  assert.equal(new URL(resetLink).pathname, '/auth/password/reset');
  await dialog().getByRole('button', { name: '复制链接', exact: true }).click();
  assert.equal(
    await page.evaluate(() => navigator.clipboard.readText()),
    resetLink,
  );
  await shot('05-reset-link-copy');
  checks.push({
    item: 'step1-reset-link',
    assertion: '重置链接生成且剪贴板内容一致',
    screenshot: '05-reset-link-copy.png',
  });
  await dialog().getByRole('button', { name: 'Close', exact: true }).click();
  if (phase === 'invites' || phase === 'full') {
    const guestContext = await browser.newContext({
      locale: 'zh-CN',
      timezoneId: 'Asia/Shanghai',
      viewport: { width: 1600, height: 1100 },
    });
    const guest = await guestContext.newPage();
    diagnosticPage = guest;
    guest.on('pageerror', (error) => errors.push(error.message));
    guest.on('response', async (response) => {
      const path = new URL(response.url()).pathname;
      if (!path.startsWith('/api/')) return;
      const body = await response.json().catch(() => undefined);
      responses.push({
        source: 'guest-browser',
        path,
        method: response.request().method(),
        status: response.status(),
        code: body?.code,
        trace_id: body?.trace_id,
      });
    });
    async function publicSubmit(url, button, newPassword, name) {
      await guest.goto(url);
      // A URL differing only in its fragment can retain the previous form during
      // the layout's exit transition. Reload as a recipient opening a new link.
      await guest.reload();
      if (name) await guest.getByLabel('用户名', { exact: true }).fill(name);
      await guest.getByLabel('新密码', { exact: true }).fill(newPassword);
      await guest.getByLabel('确认密码', { exact: true }).fill(newPassword);
      for (let attempt = 0; attempt < 4; attempt++) {
        const result = guest.waitForResponse(
          (response) =>
            new URL(response.url()).pathname ===
            (button === '创建账号'
              ? '/api/v1/auth/invite/accept'
              : '/api/v1/auth/password/reset'),
        );
        await guest.getByRole('button', { name: button, exact: true }).click();
        const response = await result;
        if (response.status() !== 429) return response;
        assert.ok(attempt < 3, 'Public account rate limit did not refill');
        console.log(
          'Public account limit: waiting 121 seconds for the documented refill.',
        );
        await new Promise((resolve) => setTimeout(resolve, 121_000));
      }
    }
    await publicSubmit(
      resetLink,
      '更新密码',
      `${process.env.FE15_TEST_PASSWORD}2`,
    );
    await guest.getByText('密码已更新', { exact: true }).waitFor();
    await guest.waitForURL((url) => url.pathname === '/auth/account-complete');
    assert.ok(
      new URL(guest.url()).hash === '',
      'Credential removed from success URL',
    );
    await api(
      '/auth/login',
      'POST',
      { username, password: `${process.env.FE15_TEST_PASSWORD}2` },
      false,
    );
    await waitWrite(
      `/admin/users/${user.id}/reset-link`,
      () =>
        row(username)
          .getByRole('button', { name: '生成重置链接', exact: true })
          .click(),
      'POST',
    );
    await page.waitForFunction((previous) => {
      const input = document.querySelector('textarea[aria-label="账号链接"]');
      return input && input.value && input.value !== previous;
    }, resetLink);
    const nextLink = await dialog().getByLabel('账号链接').inputValue();
    assert.equal(new URL(nextLink).pathname, '/auth/password/reset');
    assert.notEqual(nextLink, resetLink);
    await dialog().getByRole('button', { name: 'Close', exact: true }).click();
    const oldResponse = await publicSubmit(
      resetLink,
      '更新密码',
      `${process.env.FE15_TEST_PASSWORD}3`,
    );
    assert.equal(oldResponse.status(), 400);
    await guest.getByText(/链接无效、已使用或已过期/).waitFor();
    await guest.screenshot({
      path: fileURLToPath(new URL('05-reset-old-invalid.png', output)),
      fullPage: true,
      animations: 'disabled',
    });
    await publicSubmit(
      nextLink,
      '更新密码',
      `${process.env.FE15_TEST_PASSWORD}3`,
    );
    await guest.getByText('密码已更新', { exact: true }).waitFor();
    checks.push({
      item: 5,
      assertion:
        '复制一致；链接使用成功，生成新链接后旧链接返回 400，新链接可用',
      screenshot: '05-reset-old-invalid.png',
    });

    async function newInvite() {
      await page.getByRole('button', { name: '新建邀请', exact: true }).click();
      await pick('预置部门', '根部门');
      await dialog().getByLabel('预置角色', { exact: true }).click();
      await page
        .locator('.ant-select-dropdown:visible')
        .getByText('运营', { exact: true })
        .click();
      await page
        .locator('.ant-select-dropdown:visible')
        .getByText('销售', { exact: true })
        .click();
      await dialog().getByText('新建邀请', { exact: true }).click();
      const invite = await waitWrite(
        '/admin/invites',
        () => ok().click(),
        'POST',
      );
      cleanup.push(() => api(`/admin/invites/${invite.id}`, 'DELETE'));
      const url = await dialog().getByLabel('账号链接').inputValue();
      await dialog()
        .getByRole('button', { name: '复制链接', exact: true })
        .click();
      assert.equal(
        await page.evaluate(() => navigator.clipboard.readText()),
        url,
      );
      await shot('01-invite-created');
      await dialog()
        .getByRole('button', { name: 'Close', exact: true })
        .click();
      return { invite, url };
    }
    const first = await newInvite();
    const invitedName = `${username}_invited`;
    const acceptedResponse = await publicSubmit(
      first.url,
      '创建账号',
      process.env.FE15_TEST_PASSWORD,
      invitedName,
    );
    assert.equal(acceptedResponse.status(), 201);
    const invitedUser = (await acceptedResponse.json()).data;
    cleanup.push(() => api(`/admin/users/${invitedUser.id}`, 'DELETE'));
    await guest.getByText('账号已创建', { exact: true }).waitFor();
    await guest.waitForURL((url) => url.pathname === '/auth/account-complete');
    assert.ok(
      new URL(guest.url()).hash === '',
      'Credential removed from success URL',
    );
    await guest.screenshot({
      path: fileURLToPath(new URL('01-invite-accepted.png', output)),
      fullPage: true,
      animations: 'disabled',
    });
    await login(guest, invitedName, process.env.FE15_TEST_PASSWORD);
    const logged = await api(
      '/auth/login',
      'POST',
      { username: invitedName, password: process.env.FE15_TEST_PASSWORD },
      false,
    );
    const me = await fetch(`${backend}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${logged.access_token}` },
    });
    const overview = (await me.json()).data;
    assert.equal(overview.user.dept_id, first.invite.dept_id);
    assert.deepEqual(
      overview.user.roles.map((role) => role.id).sort(),
      first.invite.role_ids.sort(),
    );
    checks.push({
      item: 1,
      assertion: '界面邀请、复制、打开链接自行设密、登录成功并继承部门和角色',
      user_id: invitedUser.id,
      dept_id: overview.user.dept_id,
      roles: overview.user.roles,
      screenshots: ['01-invite-created.png', '01-invite-accepted.png'],
    });
    await page.reload();
    const usedRow = page.locator(
      `[data-testid="invite-table"] tr[data-row-key="${first.invite.id}"]`,
    );
    await usedRow.getByText('已用完', { exact: true }).waitFor();
    const second = await newInvite();
    const inviteRow = page.locator(
      `[data-testid="invite-table"] tr[data-row-key="${second.invite.id}"]`,
    );
    await inviteRow.getByRole('button', { name: /撤\s*销/ }).click();
    await waitWrite(
      `/admin/invites/${second.invite.id}`,
      () => ok().click(),
      'DELETE',
    );
    await inviteRow.getByText('已撤销', { exact: true }).waitFor();
    await shot('02-invite-revoked');
    const revokedResponse = await publicSubmit(
      second.url,
      '创建账号',
      process.env.FE15_TEST_PASSWORD,
      `${invitedName}_revoked`,
    );
    assert.equal(revokedResponse.status(), 400);
    checks.push({
      item: 2,
      assertion: '列表显示已用完/已撤销，撤销后接收返回 400',
      invite_ids: [first.invite.id, second.invite.id],
      screenshot: '02-invite-revoked.png',
    });
    await guestContext.close();
  }
  if (phase === 'roles' || phase === 'full') {
    await page.goto(`${origin}/system/roles`);
    await page.getByRole('button', { name: '新建角色', exact: true }).click();
    const code = `fe15_role_${Date.now()}`;
    await dialog().getByLabel('角色编码').fill(code);
    await dialog().getByLabel('角色名称').fill('FE1.5 临时验收角色');
    const role = await waitWrite('/admin/roles', () => ok().click(), 'POST');
    cleanup.push(async () => {
      await api(`/admin/users/${user.id}/roles`, 'PUT', { role_ids: [] });
      for (const [relation, field] of [
        ['menus', 'menu_ids'],
        ['permissions', 'permission_ids'],
        ['depts', 'dept_ids'],
      ])
        await api(`/admin/roles/${role.id}/${relation}`, 'PUT', {
          [field]: [],
        });
      await api(`/admin/roles/${role.id}`, 'DELETE');
    });
    const roleRow = () =>
      page.locator(`[data-testid="role-table"] tr[data-row-key="${role.id}"]`);
    await roleRow()
      .getByRole('button', { name: /编\s*辑/ })
      .click();
    await dialog().getByLabel('角色名称').fill('FE1.5 角色编辑验收');
    await waitWrite(`/admin/roles/${role.id}`, () => ok().click());
    await roleRow().getByText('FE1.5 角色编辑验收', { exact: true }).waitFor();
    await roleRow()
      .getByRole('button', { name: /授\s*权/ })
      .click();
    const drawer = () => page.locator('.ant-drawer-content:visible');
    await drawer()
      .getByText(/菜单与接口权限独立/)
      .waitFor();
    const userNode = () =>
      drawer()
        .locator('[data-testid="role-menu-tree"] .ant-tree-treenode')
        .filter({
          has: page
            .locator('.ant-tree-title')
            .getByText('用户', { exact: true }),
        });
    await userNode().locator('.ant-tree-checkbox').click();
    await waitWrite(`/admin/roles/${role.id}/menus`, () =>
      drawer()
        .getByRole('button', { name: '保存菜单授权', exact: true })
        .click(),
    );
    const assignedMenus = await api(`/admin/roles/${role.id}/menus`);
    assert.deepEqual(assignedMenus, [1, 2]);
    await drawer().getByRole('tab', { name: '权限', exact: true }).click();
    await drawer()
      .getByText(/共 103 个权限码/)
      .waitFor();
    assert.equal(
      await drawer().locator('.ant-collapse-item-active').count(),
      0,
    );
    await drawer().getByLabel('搜索权限码').fill('system:user:create');
    await drawer().getByText('创建用户', { exact: true }).waitFor();
    await drawer().getByLabel('全选模块 system', { exact: true }).check();
    await waitWrite(`/admin/roles/${role.id}/permissions`, () =>
      drawer()
        .getByRole('button', { name: '保存接口权限', exact: true })
        .click(),
    );
    const groups = await api('/admin/permissions');
    const assignedPermissions = await api(
      `/admin/roles/${role.id}/permissions`,
    );
    assert.deepEqual(
      assignedPermissions,
      groups.system.map((permission) => permission.id).sort((a, b) => a - b),
    );
    await shot('07-permissions-module-search');
    checks.push({
      item: 7,
      assertion:
        '103 权限按 module 默认折叠，搜索命中 1 项后全选模块仍授权整个 system 模块',
      count: Object.values(groups).flat().length,
      modules: Object.fromEntries(
        Object.entries(groups).map(([module, entries]) => [
          module,
          entries.length,
        ]),
      ),
      selected: assignedPermissions.length,
      screenshot: '07-permissions-module-search.png',
    });
    await page.locator('.ant-drawer-close:visible').click();
    await roleRow()
      .getByRole('button', { name: /授\s*权/ })
      .click();
    await userNode().locator('.ant-tree-checkbox-checked').waitFor();
    assert.equal(
      await drawer()
        .locator('[data-testid="role-menu-tree"] .ant-tree-checkbox-checked')
        .count(),
      1,
    );
    await drawer().getByRole('tab', { name: '权限', exact: true }).click();
    await drawer().getByLabel('全选模块 system', { exact: true }).waitFor();
    assert.equal(
      await drawer().getByLabel('全选模块 system', { exact: true }).isChecked(),
      true,
    );
    checks.push({
      item: 6,
      assertion:
        '菜单/权限独立保存、重新打开一致；半选父节点不会扩展到兄弟菜单',
      menu_ids: assignedMenus,
      permission_ids: assignedPermissions,
    });
    await drawer().getByRole('tab', { name: '数据范围', exact: true }).click();
    const scopes = [
      ['all', '全部'],
      ['dept', '本部门'],
      ['dept_and_child', '本部门及下级'],
      ['self', '仅本人'],
      ['custom', '自定义'],
    ];
    for (const [scope, label] of scopes) {
      await drawer().getByLabel('范围类型', { exact: true }).press('ArrowDown');
      await page
        .locator('.ant-select-dropdown:visible')
        .getByText(label, { exact: true })
        .click();
      if (scope === 'custom')
        await drawer()
          .locator('[data-testid="role-dept-tree"] .ant-tree-checkbox')
          .first()
          .click();
      const scopeUpdated = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname ===
            `/api/v1/admin/roles/${role.id}` &&
          response.request().method() === 'PUT',
      );
      await waitWrite(`/admin/roles/${role.id}/depts`, () =>
        drawer()
          .getByRole('button', { name: '保存数据范围', exact: true })
          .click(),
      );
      assert.equal((await scopeUpdated).status(), 200);
      assert.equal((await api(`/admin/roles/${role.id}`)).data_scope, scope);
    }
    assert.deepEqual(await api(`/admin/roles/${role.id}/depts`), [1]);
    await shot('08-custom-data-scope');
    checks.push({
      item: 8,
      assertion: '五种范围逐一保存并 API 回读，自定义部门保存并回读',
      scopes: scopes.map(([scope]) => scope),
      dept_ids: [1],
      screenshot: '08-custom-data-scope.png',
    });
    await page.locator('.ant-drawer-close:visible').click();
    await api(`/admin/users/${user.id}/roles`, 'PUT', { role_ids: [role.id] });
    await roleRow()
      .getByRole('button', { name: /删\s*除/ })
      .click();
    const conflict = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === `/api/v1/admin/roles/${role.id}` &&
        response.request().method() === 'DELETE',
    );
    await ok().click();
    const rejected = await conflict;
    assert.equal(rejected.status(), 409);
    await page.getByText(/角色仍被引用或受保护，请先解除用户关联/).waitFor();
    await shot('10-role-delete-409');
    checks.push({
      item: 10,
      assertion: '被用户引用的角色删除返回 409，页面提示先解除用户关联',
      status: rejected.status(),
      code: (await rejected.json()).code,
      screenshot: '10-role-delete-409.png',
    });
    const listPermission = groups.system.find(
      (permission) => permission.code === 'system:user:list',
    );
    await api(`/admin/roles/${role.id}/permissions`, 'PUT', {
      permission_ids: [listPermission.id],
    });
    // Directly-created accounts must set a personal password before normal login.
    const personalLink = new URL(
      (await api(`/admin/users/${user.id}/reset-link`, 'POST')).link,
      backend,
    );
    const personalPassword = `${process.env.FE15_TEST_PASSWORD}4`;
    await api(
      '/auth/password/reset',
      'POST',
      {
        tenant_id: Number(personalLink.searchParams.get('tenant_id')),
        token: new URLSearchParams(personalLink.hash.slice(1)).get('token'),
        newPassword: personalPassword,
      },
      false,
    );
    const limitedContext = await browser.newContext({
      locale: 'zh-CN',
      viewport: { width: 1600, height: 1100 },
    });
    const limitedPage = await limitedContext.newPage();
    diagnosticPage = limitedPage;
    await login(limitedPage, username, personalPassword);
    await limitedPage.goto(`${origin}/system/users`);
    await limitedPage.locator('[data-testid="user-table"]').waitFor();
    assert.equal(
      await limitedPage
        .getByRole('button', { name: '新增用户', exact: true })
        .count(),
      0,
    );
    assert.equal(
      await limitedPage
        .getByRole('button', { name: '新建邀请', exact: true })
        .count(),
      0,
    );
    const limitedLogin = await api(
      '/auth/login',
      'POST',
      { username, password: personalPassword },
      false,
    );
    for (const path of ['/admin/users', '/admin/invites']) {
      const forbidden = await fetch(`${backend}/api/v1${path}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${limitedLogin.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      const body = await forbidden.json();
      assert.equal(forbidden.status, 403);
      responses.push({
        source: 'limited-api',
        method: 'POST',
        path,
        status: forbidden.status,
        code: body.code,
        trace_id: body.trace_id,
      });
    }
    await limitedPage.screenshot({
      path: fileURLToPath(new URL('11-user-create-hidden.png', output)),
      fullPage: true,
      animations: 'disabled',
    });
    checks.push({
      item: 11,
      assertion:
        '无 system:user:create 时新增用户/邀请均隐藏，直接 POST 两个接口均 403',
      screenshot: '11-user-create-hidden.png',
    });
    await limitedContext.close();
    await api(`/admin/users/${user.id}/roles`, 'PUT', { role_ids: [] });
    for (const [relation, field] of [
      ['menus', 'menu_ids'],
      ['permissions', 'permission_ids'],
      ['depts', 'dept_ids'],
    ])
      await api(`/admin/roles/${role.id}/${relation}`, 'PUT', { [field]: [] });
    await roleRow()
      .getByRole('button', { name: /删\s*除/ })
      .click();
    await waitWrite(`/admin/roles/${role.id}`, () => ok().click(), 'DELETE');
    cleanup.pop();
    await roleRow().waitFor({ state: 'hidden' });
    checks.push({
      item: 'role-crud',
      assertion: '角色新建、编辑、解除引用后删除均成功，写后列表刷新',
    });
  }
  if (phase === 'menus' || phase === 'full') {
    await page.goto(`${origin}/system/menus`);
    const menuRow = (id) =>
      page.locator(`[data-testid="menu-table"] tr[data-row-key="${id}"]`);
    await menuRow(1)
      .getByRole('button', { name: '新增子项', exact: true })
      .click();
    const fixturePath = `/system/fe15_${Date.now()}`;
    await dialog().getByLabel('菜单名称').fill('FE1.5 临时目录');
    await pick('菜单类型', '目录');
    await dialog().getByLabel('菜单路径').fill(fixturePath);
    const parent = await waitWrite('/admin/menus', () => ok().click(), 'POST');
    cleanup.push(() => api(`/admin/menus/${parent.id}`, 'DELETE'));
    assert.equal(parent.parent_id, 1);
    await menuRow(parent.id)
      .getByRole('button', { name: '新增子项', exact: true })
      .click();
    await dialog().getByLabel('菜单名称').fill('FE1.5 子菜单');
    await dialog().getByLabel('菜单路径').fill(`${fixturePath}/child`);
    await dialog().getByLabel('菜单组件').fill('/pending/index.vue');
    await dialog().getByLabel('菜单图标').fill('lucide:file');
    await dialog().getByLabel('菜单排序').fill('9');
    await dialog().getByLabel('菜单权限码').fill('system:user:list');
    await dialog().getByLabel('缓存页面', { exact: true }).click();
    const child = await waitWrite('/admin/menus', () => ok().click(), 'POST');
    cleanup.push(() => api(`/admin/menus/${child.id}`, 'DELETE'));
    assert.equal(child.parent_id, parent.id);
    await menuRow(child.id)
      .getByRole('button', { name: /编\s*辑/ })
      .click();
    await dialog().getByLabel('菜单名称').fill('FE1.5 子菜单已编辑');
    await dialog().getByLabel('菜单排序').fill('10');
    await dialog().getByLabel('菜单可见').click();
    await waitWrite(`/admin/menus/${child.id}`, () => ok().click());
    await menuRow(child.id).getByText('隐藏', { exact: true }).waitFor();
    const edited = await api(`/admin/menus/${child.id}`);
    assert.equal(edited.sort, 10);
    assert.equal(edited.keep_alive, true);
    assert.equal(edited.component, '/pending/index.vue');
    assert.equal(edited.permission_code, 'system:user:list');
    assert.equal(edited.visible, false);
    await menuRow(child.id)
      .getByRole('button', { name: /编\s*辑/ })
      .click();
    await dialog().getByLabel('菜单可见').click();
    await waitWrite(`/admin/menus/${child.id}`, () => ok().click());
    await menuRow(child.id).getByText('显示', { exact: true }).waitFor();
    await shot('09-menu-tree-crud');
    await menuRow(parent.id)
      .getByRole('button', { name: /删\s*除/ })
      .click();
    const parentDeletion = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname ===
          `/api/v1/admin/menus/${parent.id}` &&
        response.request().method() === 'DELETE',
    );
    await ok().click();
    assert.equal((await parentDeletion).status(), 409);
    await page.getByText(/菜单仍被引用，请先删除子节点/).waitFor();
    await shot('09-menu-delete-409');
    const freshContext = await browser.newContext({
      locale: 'zh-CN',
      viewport: { width: 1780, height: 1100 },
    });
    const fresh = await freshContext.newPage();
    diagnosticPage = fresh;
    fresh.on('pageerror', (error) => errors.push(error.message));
    await login(fresh, 'admin', process.env.FE15_ADMIN_PASSWORD);
    await fresh.goto(`${origin}${child.path}`);
    await fresh
      .getByRole('menuitem', { name: 'FE1.5 子菜单已编辑', exact: true })
      .waitFor();
    await fresh.screenshot({
      path: fileURLToPath(new URL('09-menu-sidebar-after-login.png', output)),
      fullPage: true,
      animations: 'disabled',
    });
    await freshContext.close();
    diagnosticPage = page;
    for (const menu of [child, parent]) {
      await menuRow(menu.id)
        .getByRole('button', { name: /删\s*除/ })
        .click();
      await waitWrite(`/admin/menus/${menu.id}`, () => ok().click(), 'DELETE');
      cleanup.pop();
      await menuRow(menu.id).waitFor({ state: 'hidden' });
    }
    checks.push({
      item: 9,
      assertion:
        '界面新增目录/子菜单、编辑隐藏再显示、删除后列表刷新；新会话登录后侧栏出现子菜单；父节点删除 409',
      menu_ids: [parent.id, child.id],
      screenshots: [
        '09-menu-tree-crud.png',
        '09-menu-sidebar-after-login.png',
        '09-menu-delete-409.png',
      ],
    });
  }
  assert.deepEqual(errors, []);
} catch (error) {
  failure = error;
  await diagnosticPage
    .screenshot({
      path: fileURLToPath(new URL(`failure-public-${phase}.png`, output)),
      fullPage: true,
    })
    .catch(() => {});
  await shot(`failure-${phase}`).catch(() => {});
} finally {
  for (const action of cleanup.reverse()) {
    try {
      await action();
    } catch (error) {
      failure ||= error;
    }
  }
  await writeFile(
    new URL(`report-${phase}.json`, output),
    JSON.stringify(
      {
        phase,
        passed: !failure,
        checks,
        errors,
        responses,
        failure: failure ? String(failure) : undefined,
      },
      null,
      2,
    ),
  );
  await browser.close();
}
if (failure) throw failure;
console.log(JSON.stringify({ phase, passed: true, checks }, null, 2));
