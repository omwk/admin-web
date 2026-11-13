import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import process from 'node:process';

import {
  api,
  browserErrors,
  button,
  check,
  checks,
  clean,
  cleanup,
  context,
  httpErrors,
  login,
  menuPaths,
  modal,
  openTenants,
  origin,
  output,
  redact,
  request,
  response,
  row,
  secrets,
  select,
  setup,
  shot,
  summary,
  templatesTab,
} from './sf5-support.mjs';

const prefix = 'sf5_' + Date.now();
const password =
  process.env.SF5_TENANT_PASSWORD || 'Sf5@' + randomBytes(14).toString('hex');
secrets.add(password);
const adminName = prefix + '_admin';
const browser = await setup();
const adminContext = await context(browser);
const page = await adminContext.newPage();
let tenantId;
let snapshot;
let disposable;
let role;
let limitedUser;
let failure;
try {
  await login(page, 'admin', process.env.SF5_ADMIN_PASSWORD);
  await openTenants(page);
  const platform = (await api('/admin/tenants?page_size=100')).list.find(
    (tenant) => tenant.code === 'default',
  );
  assert.equal(platform.id, 1);
  assert.equal(platform.status, 'active');
  assert.equal(platform.provisioned_from, null);
  await row(page, 1).getByText('平台', { exact: true }).waitFor();
  assert.ok((await row(page, 1).innerText()).includes('启用'));
  assert.ok((await row(page, 1).innerText()).includes('无'));
  await shot('01-default-real', page);
  check(1, 'default(1) 显示平台标记、启用状态与无来源模板', {
    tenant: platform,
    screenshot: '01-default-real.png',
  });

  await templatesTab(page);
  await button('生成模板', page).click();
  await select(page, '来源租户', 'default');
  await modal(page).getByLabel('模板 Code').fill(prefix);
  await modal(page)
    .getByLabel('模板名称')
    .fill('SF5 标准模板 ' + prefix);
  await modal(page).getByLabel('模板描述').fill('SF5 真实界面验收快照');
  const createdTemplate = await response(
    page,
    '/admin/tenant-templates',
    'POST',
    () => button('生成快照', modal(page)).click(),
  );
  assert.equal(createdTemplate.status, 201);
  snapshot = createdTemplate.data;
  await modal(page).waitFor({ state: 'hidden' });
  const detail = await api('/admin/tenant-templates/' + snapshot.id);
  assert.deepEqual(detail.roles, snapshot.roles);
  assert.deepEqual(detail.menus, snapshot.menus);
  const sourceRoles = await api('/admin/roles?page_size=100');
  const sourceMenus = await api('/admin/menus');
  function countMenus(menus) {
    return menus.reduce(
      (count, menu) => count + 1 + countMenus(menu.children || []),
      0,
    );
  }
  assert.equal(snapshot.roles.length, sourceRoles.total);
  assert.equal(
    snapshot.menus.length,
    countMenus(Array.isArray(sourceMenus) ? sourceMenus : sourceMenus.list),
  );
  const templateRow = row(page, snapshot.id, 'tenant-template-table');
  await templateRow.waitFor();
  const cells = await templateRow.locator('td').allTextContents();
  assert.equal(cells[2], String(snapshot.roles.length));
  assert.equal(cells[3], String(snapshot.menus.length));
  await shot('02-snapshot-real', page);
  await button('查看快照', templateRow).click();
  await modal(page)
    .getByRole('tab', {
      name: '角色（' + snapshot.roles.length + '）',
      exact: true,
    })
    .waitFor();
  await shot('02-snapshot-detail-real', page);
  await modal(page).locator('.ant-modal-close').click();
  check(2, 'default 快照角色/菜单数与来源和模板详情完全一致', {
    templateId: snapshot.id,
    roleCount: snapshot.roles.length,
    menuCount: snapshot.menus.length,
    permissionCount: snapshot.permissions.length,
    screenshots: ['02-snapshot-real.png', '02-snapshot-detail-real.png'],
  });

  await page.getByRole('tab', { name: '租户列表', exact: true }).click();
  await button('开通租户', page).click();
  await modal(page).getByLabel('租户 Code').fill(prefix);
  await modal(page).getByLabel('租户名称').fill('SF5 验收租户');
  await button('下一步', modal(page)).click();
  await select(page, '租户模板', snapshot.name);
  await modal(page).getByLabel('管理员用户名').fill(adminName);
  await modal(page).getByLabel('管理员邮箱').fill('sf5@example.test');
  await shot('03-wizard-real', page);
  const provisioned = await response(page, '/admin/tenants', 'POST', () =>
    button('确认开通', modal(page)).click(),
  );
  assert.equal(provisioned.status, 201);
  tenantId = provisioned.data.tenant_id;
  const invitation = await modal(page).getByLabel('账号链接').inputValue();
  secrets.add(invitation);
  secrets.add(new URL(invitation).hash.slice(7));
  assert.equal(
    new URL(invitation).searchParams.get('tenant_id'),
    String(tenantId),
  );
  assert.equal(new URL(invitation).origin, origin);
  assert.equal(
    await page.evaluate(
      (link) =>
        JSON.stringify({ ...localStorage, ...sessionStorage }).includes(link),
      invitation,
    ),
    false,
  );
  await button('复制链接', modal(page)).click();
  await page.getByText('链接已复制', { exact: true }).waitFor();
  assert.equal(
    await page.evaluate(() => navigator.clipboard.readText()),
    invitation,
  );
  await shot('03-invitation-masked-real', page);
  await modal(page).locator('.ant-modal-close').click();
  await modal(page).waitFor({ state: 'hidden' });
  await button('开通租户', page).click();
  assert.equal(await page.getByLabel('账号链接').count(), 0);
  await button('取消', modal(page)).click();
  await openTenants(page);
  assert.equal(await page.getByLabel('账号链接').count(), 0);
  check(
    3,
    '两步开通真实201；复制内容一致；存储无邀请；关闭、重开、刷新均无链接',
    {
      tenantId,
      status: provisioned.status,
      clipboardMatched: true,
      storageContainsInvitation: false,
      recoveredAfterClose: false,
      screenshots: ['03-wizard-real.png', '03-invitation-masked-real.png'],
    },
  );

  const tenantContext = await context(browser);
  const tenantPage = await tenantContext.newPage();
  await tenantPage.goto(invitation);
  await tenantPage.getByLabel('用户名', { exact: true }).fill(adminName);
  await tenantPage.getByLabel('新密码', { exact: true }).fill(password);
  await tenantPage.getByLabel('确认密码', { exact: true }).fill(password);
  const accepted = await response(
    tenantPage,
    '/auth/invite/accept',
    'POST',
    () => button('创建账号', tenantPage).click(),
  );
  assert.ok([200, 201].includes(accepted.status), 'Invite accepted');
  await tenantPage.getByText('账号已创建', { exact: true }).waitFor();
  assert.equal(new URL(tenantPage.url()).hash, '');
  await shot('04-invite-accepted-real', tenantPage);
  const destination = await tenantPage
    .getByRole('link', { name: '前往登录' })
    .getAttribute('href');
  assert.ok(destination.includes('tenant_id=' + tenantId));
  await tenantPage.getByRole('link', { name: '前往登录' }).click();
  assert.equal(
    await tenantPage.getByPlaceholder('请输入租户 ID').inputValue(),
    String(tenantId),
  );
  const tenantAuth = await login(tenantPage, adminName, password, tenantId);
  const me = await api('/auth/me', 'GET', undefined, tenantAuth.access_token);
  assert.equal(me.user.tenant_id, tenantId);
  assert.equal(me.user.is_super, true);
  const reused = await request(
    '/auth/invite/accept',
    'POST',
    {
      tenant_id: tenantId,
      token: new URL(invitation).hash.slice(7),
      username: adminName,
      password,
    },
    null,
  );
  assert.equal(reused.status, 400);
  check(
    4,
    '邀请设密码后由真实登录页传租户ID登录，重复接受400，成功页不再保留token',
    {
      acceptedStatus: accepted.status,
      loginTenantId: me.user.tenant_id,
      isSuper: me.user.is_super,
      reused: summary(reused),
      screenshot: '04-invite-accepted-real.png',
    },
  );

  const [defaultUsers, newUsers, defaultProducts, newProducts] =
    await Promise.all([
      api('/admin/users?page_size=100'),
      api(
        '/admin/users?page_size=100',
        'GET',
        undefined,
        tenantAuth.access_token,
      ),
      api('/admin/products?page_size=100'),
      api(
        '/admin/products?page_size=100',
        'GET',
        undefined,
        tenantAuth.access_token,
      ),
    ]);
  assert.ok(defaultProducts.total > 0, 'Default has real business data');
  assert.equal(newProducts.total, 0);
  assert.ok(newUsers.list.every((user) => user.tenant_id === tenantId));
  assert.ok(
    newUsers.list.every(
      (user) => !defaultUsers.list.some((original) => original.id === user.id),
    ),
  );
  const foreign = await request(
    '/admin/tenants/1',
    'GET',
    undefined,
    tenantAuth.access_token,
  );
  assert.equal(foreign.status, 404);
  await tenantPage.goto(origin + '/catalog/products');
  await tenantPage.getByRole('table').waitFor();
  await tenantPage
    .getByRole('table')
    .getByText('暂无商品', { exact: true })
    .waitFor();
  assert.equal(await tenantPage.locator('tbody tr[data-row-key]').count(), 0);
  await shot('05-isolation-real', tenantPage);
  check(5, '新租户仅有自身用户、商品0条；default有商品且跨租户详情404', {
    defaultUsers: defaultUsers.total,
    newUsers: newUsers.total,
    defaultProducts: defaultProducts.total,
    newProducts: newProducts.total,
    foreignTenant: summary(foreign),
    screenshot: '05-isolation-real.png',
  });
  const defaultMenus = await api('/auth/menus');
  const tenantMenus = await api(
    '/auth/menus',
    'GET',
    undefined,
    tenantAuth.access_token,
  );
  assert.deepEqual(menuPaths(tenantMenus.menus), menuPaths(defaultMenus.menus));
  assert.equal(
    await tenantPage
      .getByRole('menuitem')
      .filter({ hasText: '租户管理' })
      .count(),
    0,
  );
  await shot('06-menus-real', tenantPage);
  await tenantPage.goto(origin + '/system/tenants');
  await tenantPage.locator('p.text-2xl').waitFor();
  assert.equal(await tenantPage.getByTestId('tenant-table').count(), 0);
  await shot('06-platform-entry-hidden-real', tenantPage);
  check(
    6,
    '新租户菜单与模板来源一致；按平台入口规则排除租户管理，直连页面403',
    {
      matchedMenuCount: menuPaths(tenantMenus.menus).length,
      excludedPlatformOnlyEntry: '/system/tenants',
      screenshots: ['06-menus-real.png', '06-platform-entry-hidden-real.png'],
    },
  );

  await button('开通租户', page).click();
  await modal(page).getByLabel('租户 Code').fill(prefix);
  await modal(page).getByLabel('租户名称').fill('重复 Code');
  await button('下一步', modal(page)).click();
  await select(page, '租户模板', snapshot.name);
  await modal(page)
    .getByLabel('管理员用户名')
    .fill(prefix + '_other');
  const duplicate = await response(page, '/admin/tenants', 'POST', () =>
    button('确认开通', modal(page)).click(),
  );
  assert.equal(duplicate.status, 409);
  await modal(page)
    .getByRole('alert')
    .filter({ hasText: duplicate.envelope.message })
    .waitFor();
  await shot('07-code-conflict-real', page);
  await button('取消', modal(page)).click();
  check(7, '重复租户code真实409，向导原样显示message并保留输入', {
    ...summary(duplicate),
    screenshot: '07-code-conflict-real.png',
  });

  await button('编辑名称', row(page, tenantId)).click();
  await modal(page).getByLabel('租户名称').fill('SF5 验收租户已改名');
  const renamed = await response(
    page,
    '/admin/tenants/' + tenantId,
    'PUT',
    () => button('保存名称', modal(page)).click(),
  );
  assert.deepEqual(renamed.body, { name: 'SF5 验收租户已改名' });
  await modal(page).waitFor({ state: 'hidden' });
  await row(page, tenantId)
    .getByText('SF5 验收租户已改名', { exact: true })
    .waitFor();
  await button('停用', row(page, tenantId)).click();
  for (const line of [
    '该租户所有用户无法登录',
    '已登录会话的刷新令牌将被拒绝',
    '数据保留，可随时重新启用',
  ])
    await modal(page).getByText(line, { exact: true }).waitFor();
  await shot('08-disable-confirmation-real', page);
  await button('取消', modal(page)).click();
  assert.equal((await api('/admin/tenants/' + tenantId)).status, 'active');
  await button('停用', row(page, tenantId)).click();
  const disabled = await response(
    page,
    '/admin/tenants/' + tenantId + '/disable',
    'POST',
    () => button('确认停用', modal(page)).click(),
  );
  assert.equal(disabled.data.status, 'suspended');
  await modal(page).waitFor({ state: 'hidden' });
  await button('启用', row(page, tenantId)).waitFor();
  const deniedLogin = await request(
    '/auth/login',
    'POST',
    { tenant_id: tenantId, username: adminName, password },
    null,
  );
  const deniedRefresh = await request(
    '/auth/refresh',
    'POST',
    { refresh_token: tenantAuth.refresh_token },
    null,
  );
  assert.equal(deniedLogin.status, 403);
  assert.equal(deniedRefresh.status, 403);
  assert.equal(deniedLogin.envelope.code, 20_111);
  assert.equal(deniedRefresh.envelope.code, 20_111);
  await shot('08-suspended-real', page);
  check(
    8,
    '改名只发name；取消停用无变化；三条后果确认后suspended，登录/刷新403',
    {
      rename: { status: renamed.status, fields: Object.keys(renamed.body) },
      status: disabled.data.status,
      deniedLogin: summary(deniedLogin),
      deniedRefresh: summary(deniedRefresh),
      screenshots: [
        '08-disable-confirmation-real.png',
        '08-suspended-real.png',
      ],
    },
  );
  const enabled = await response(
    page,
    '/admin/tenants/' + tenantId + '/enable',
    'POST',
    () => button('启用', row(page, tenantId)).click(),
  );
  assert.equal(enabled.data.status, 'active');
  const enabledAuth = await login(tenantPage, adminName, password, tenantId);
  assert.equal(
    (await api('/auth/me', 'GET', undefined, enabledAuth.access_token)).user
      .tenant_id,
    tenantId,
  );
  await row(page, tenantId).getByText('启用', { exact: true }).waitFor();
  await shot('09-enabled-real', page);
  check(9, '界面启用后active，真实登录页可再次登录新租户', {
    status: enabled.data.status,
    tenantId,
    screenshot: '09-enabled-real.png',
  });

  assert.equal(await button('停用', row(page, 1)).isDisabled(), true);
  const protectedPlatform = await request('/admin/tenants/1/disable', 'POST');
  assert.equal(protectedPlatform.status, 409);
  assert.equal(protectedPlatform.envelope.message, '平台租户不可停用');
  assert.equal((await api('/admin/tenants/1')).status, 'active');
  await button('停用', row(page, 1)).hover({ force: true });
  await page
    .getByRole('tooltip')
    .getByText('平台租户不可停用', { exact: true })
    .waitFor();
  await shot('10-platform-protection-real', page);
  check(10, '平台停用按钮禁用并提示，强行请求409原文，平台状态不变', {
    ...summary(protectedPlatform),
    screenshot: '10-platform-protection-real.png',
  });

  await templatesTab(page);
  const usedRow = row(page, snapshot.id, 'tenant-template-table');
  assert.equal(await button('删除模板', usedRow).isDisabled(), true);
  await button('删除模板', usedRow).hover({ force: true });
  await page
    .getByRole('tooltip')
    .getByText('模板已被租户使用，不可删除', { exact: true })
    .waitFor();
  const protectedTemplate = await request(
    '/admin/tenant-templates/' + snapshot.id,
    'DELETE',
  );
  assert.equal(protectedTemplate.status, 409);
  await shot('11-template-protection-real', page);
  await button('生成模板', page).click();
  await select(page, '来源租户', 'default');
  await modal(page)
    .getByLabel('模板 Code')
    .fill(prefix + '_unused');
  await modal(page).getByLabel('模板名称').fill('SF5 待删除模板');
  const unused = await response(page, '/admin/tenant-templates', 'POST', () =>
    button('生成快照', modal(page)).click(),
  );
  disposable = unused.data;
  await modal(page).waitFor({ state: 'hidden' });
  const unusedRow = row(page, disposable.id, 'tenant-template-table');
  await button('编辑模板', unusedRow).click();
  await modal(page).getByLabel('模板名称').fill('SF5 未使用模板已编辑');
  await response(page, '/admin/tenant-templates/' + disposable.id, 'PUT', () =>
    button('保存模板', modal(page)).click(),
  );
  await modal(page).waitFor({ state: 'hidden' });
  await button('删除模板', unusedRow).click();
  const removed = await response(
    page,
    '/admin/tenant-templates/' + disposable.id,
    'DELETE',
    () => button('确认删除', modal(page)).click(),
  );
  assert.equal(removed.status, 204);
  disposable = undefined;
  await modal(page).waitFor({ state: 'hidden' });
  check(11, '使用中模板禁用删除并显示原因，强删409；未使用模板可改名/删除204', {
    protected: summary(protectedTemplate),
    unusedDeleteStatus: removed.status,
    screenshot: '11-template-protection-real.png',
  });

  // Super administrators receive every permission from backend; remove manage
  // only from /auth/menus to exercise the defensive readonly rendering branch.
  await page.route('**/api/v1/auth/menus', async (route) => {
    const result = await route.fetch();
    const body = await result.json();
    body.data.permissions = body.data.permissions.filter(
      (code) => code !== 'system:tenant:manage',
    );
    await route.fulfill({ response: result, json: body });
  });
  await openTenants(page);
  for (const label of [
    '开通租户',
    '编辑名称',
    '停用',
    '启用',
    '生成模板',
    '删除模板',
  ])
    assert.equal(await button(label, page).count(), 0);
  assert.equal(
    await page.getByRole('tab', { name: '租户模板', exact: true }).count(),
    0,
  );
  await shot('12-no-manage-ui-fixture', page);
  await page.unroute('**/api/v1/auth/menus');
  const permissions = Object.values(await api('/admin/permissions')).flat();
  role = await api('/admin/roles', 'POST', {
    code: prefix,
    name: 'SF5 只读',
    data_scope: 'all',
    remark: null,
    status: 'active',
  });
  await api('/admin/roles/' + role.id + '/permissions', 'PUT', {
    permission_ids: permissions
      .filter((permission) => permission.code === 'system:tenant:list')
      .map((permission) => permission.id),
  });
  const initialPassword = password + '0';
  secrets.add(initialPassword);
  limitedUser = await api('/admin/users', 'POST', {
    username: prefix + '_limited',
    nickname: 'SF5 只读',
    password: initialPassword,
    dept_id: 1,
    status: 'active',
  });
  await api('/admin/users/' + limitedUser.id + '/roles', 'PUT', {
    role_ids: [role.id],
  });
  const initial = await api(
    '/auth/login',
    'POST',
    { username: limitedUser.username, password: initialPassword },
    null,
  );
  await api(
    '/auth/password',
    'PUT',
    { oldPassword: initialPassword, newPassword: password },
    initial.access_token,
  );
  const limitedContext = await context(browser);
  const limitedPage = await limitedContext.newPage();
  const limitedAuth = await login(limitedPage, limitedUser.username, password);
  const deniedWrites = [];
  for (const [path, method, input] of [
    [
      '/admin/tenants',
      'POST',
      {
        code: prefix,
        name: 'blocked',
        template_id: snapshot.id,
        admin_username: 'blocked',
      },
    ],
    ['/admin/tenants/' + tenantId, 'PUT', { name: 'blocked' }],
    ['/admin/tenants/' + tenantId + '/disable', 'POST'],
    ['/admin/tenant-templates/' + snapshot.id, 'DELETE'],
  ]) {
    const denied = await request(path, method, input, limitedAuth.access_token);
    assert.equal(denied.status, 403);
    deniedWrites.push({ path, method, ...summary(denied) });
  }
  await limitedPage.goto(origin + '/system/tenants');
  await limitedPage.locator('p.text-2xl').waitFor();
  assert.equal(
    await limitedPage
      .getByRole('menuitem')
      .filter({ hasText: '租户管理' })
      .count(),
    0,
  );
  await shot('12-platform-nonsuper-hidden-real', limitedPage);
  check(
    12,
    '无manage隐藏写入口；真实只读账号直接写403，非超管即使有list也隐藏入口',
    {
      uiSource:
        'real-platform-super-session-with-manage-removed-from-menu-response',
      reason:
        '后端超管始终获得全量权限；只读分支使用响应夹具，403使用真实角色账号',
      deniedWrites,
      screenshots: [
        '12-no-manage-ui-fixture.png',
        '12-platform-nonsuper-hidden-real.png',
      ],
    },
  );
  assert.deepEqual(browserErrors, []);
} catch (error) {
  failure = { message: redact(error.message), stack: redact(error.stack) };
  await shot('failure', page).catch(() => {});
} finally {
  await browser.close();
  if (snapshot && !tenantId)
    await clean('unreferenced snapshot ' + snapshot.id, () =>
      api('/admin/tenant-templates/' + snapshot.id, 'DELETE'),
    );
  if (tenantId)
    await clean('retained acceptance tenant ' + tenantId + ' disabled', () =>
      api('/admin/tenants/' + tenantId + '/disable', 'POST'),
    );
  if (disposable)
    await clean('unused template ' + disposable.id, () =>
      api('/admin/tenant-templates/' + disposable.id, 'DELETE'),
    );
  if (limitedUser)
    await clean('temporary readonly user', async () => {
      await api('/admin/users/' + limitedUser.id + '/roles', 'PUT', {
        role_ids: [],
      });
      await api('/admin/users/' + limitedUser.id, 'DELETE');
    });
  if (role)
    await clean('temporary readonly role', async () => {
      await api('/admin/roles/' + role.id + '/permissions', 'PUT', {
        permission_ids: [],
      });
      await api('/admin/roles/' + role.id, 'DELETE');
    });
  const report = {
    source: 'real-18080-and-msedge',
    date: new Date().toISOString(),
    fixtureCode: prefix,
    retainedTenantId: tenantId,
    retainedTemplateId: snapshot?.id,
    retainedReason: '没有租户删除API；验收租户停用保留，关联模板受删除保护。',
    checks: checks.sort((a, b) => a.item - b.item),
    browserErrors,
    httpErrors,
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
  cleanup.every((entry) => entry.result === 'restored-or-removed'),
  'Cleanup succeeded',
);
assert.deepEqual(
  checks.map((entry) => entry.item),
  Array.from({ length: 12 }, (_, index) => index + 1),
);
process.stdout.write(
  JSON.stringify({
    passed: checks.length,
    browserErrors: browserErrors.length,
    retainedTenantId: tenantId,
    retainedTemplateId: snapshot?.id,
  }) + '\n',
);
