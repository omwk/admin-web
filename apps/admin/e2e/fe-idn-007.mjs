import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import process from 'node:process';

import {
  verifyEmptyTemplates,
  verifyTemplateUsage,
  verifyUnsaved,
} from './fe-idn-007-secondary.mjs';
import {
  api,
  blank,
  button,
  context,
  login,
  modal,
  origin,
  persist,
  provision,
  record,
  redact,
  remember,
  report,
  response,
  row,
  save,
  secrets,
  select,
  setAdminToken,
  setup,
  shot,
} from './fe-idn-007-support.mjs';

const prefix = 'feidn007_' + Date.now();
const password = 'Fe007@' + randomBytes(14).toString('hex');
secrets.add(password);
const browser = await setup();
const adminContext = await context(browser);
const page = await adminContext.newPage();
let failure;
try {
  const auth = await login(
    page,
    'admin',
    process.env.FE_IDN_007_ADMIN_PASSWORD,
  );
  setAdminToken(auth.access_token);
  report.baseline = {
    tenants: (await api('/admin/tenants?page_size=100')).list.map(
      ({ id, code }) => ({ id, code }),
    ),
    templates: (await api('/admin/tenant-templates?page_size=100')).list.map(
      ({ id, code }) => ({ id, code }),
    ),
  };
  const groups = await api('/admin/permissions');
  const dictionary = Object.values(groups).flat();
  const read =
    dictionary.find((permission) => permission.code === 'product:spu:list') ||
    dictionary.find((permission) => permission.code.endsWith(':list'));
  assert.ok(read);
  const extra = dictionary.find(
    (permission) =>
      permission.module === read.module && permission.code !== read.code,
  );
  assert.ok(extra);

  const created = await blank(page, prefix, '只读版 ' + prefix);
  const original = created.data;
  assert.deepEqual(original.roles, []);
  assert.ok(
    original.menus.length > 0,
    'Blank template retains framework menus',
  );
  await shot('02-blank-editor-real', page);
  await record(
    2,
    '空白创建不提交 source_tenant_id，真实 201 返回 roles=[]，直接进入编辑路由',
    {
      templateId: original.id,
      request: created.body,
      roleCount: 0,
      screenshot: '02-blank-editor-real.png',
    },
  );

  await button('添加角色', page).click();
  await modal(page).getByLabel('新角色 Code', { exact: true }).fill('reader');
  await modal(page).getByLabel('新角色名', { exact: true }).fill('只读');
  await button('添加', modal(page)).click();
  await page.getByLabel('角色 Code', { exact: true }).waitFor();
  assert.equal(
    await page.getByLabel('角色 Code', { exact: true }).isDisabled(),
    true,
  );
  await page.getByLabel('搜索权限码', { exact: true }).fill(read.code);
  await page.getByRole('checkbox', { name: read.code, exact: true }).check();
  const granted = await save(page, original.id);
  assert.deepEqual(
    granted.data.roles.map(({ code, name, data_scope, permissions }) => ({
      code,
      name,
      data_scope,
      permissions,
    })),
    [
      {
        code: 'reader',
        name: '只读',
        data_scope: 'self',
        permissions: [read.code],
      },
    ],
  );
  assert.deepEqual(
    granted.data.roles[0].menus,
    original.menus.map((menu) => menu.key),
  );
  await shot('03-role-permission-saved-real', page);
  await record(
    3,
    '新增只读角色，勾选一个真实注册权限；PUT 同时提交 name 和完整 roles，返回 200',
    {
      templateId: original.id,
      status: granted.status,
      request: granted.body,
      traceId: granted.traceId,
      screenshot: '03-role-permission-saved-real.png',
    },
  );

  await page.getByLabel('搜索权限码', { exact: true }).fill('');
  assert.equal(
    await page
      .getByTestId('permission-groups')
      .locator('.ant-collapse-content-active')
      .count(),
    0,
  );
  await page.getByLabel('搜索权限码', { exact: true }).fill(read.code);
  const moduleCheck = page.getByRole('checkbox', {
    name: '全选模块 ' + read.module,
    exact: true,
  });
  await moduleCheck.check();
  const moduleCount = groups[read.module].length;
  await page
    .getByTestId('template-role-list')
    .getByText(moduleCount + ' 个权限', { exact: false })
    .waitFor();
  await shot('04-module-search-select-all-real', page);
  await moduleCheck.uncheck();
  await page.getByRole('checkbox', { name: read.code, exact: true }).check();
  await page.getByLabel('搜索权限码', { exact: true }).fill('');
  await record(
    4,
    '默认模块折叠；搜索自动展开；整组勾选包含被搜索隐藏的权限，取消后恢复只读单权限',
    {
      module: read.module,
      modulePermissionCount: moduleCount,
      readPermission: read.code,
      screenshot: '04-module-search-select-all-real.png',
    },
  );

  const scopes = [
    ['all', '全部'],
    ['dept', '本部门'],
    ['dept_and_child', '本部门及下级'],
    ['custom', '自定义'],
    ['self', '仅本人'],
  ];
  const savedScopes = [];
  for (const [value, label] of scopes) {
    await select(
      page,
      '数据范围',
      label,
      page.getByTestId('template-role-panel'),
    );
    const changed = await save(page, original.id);
    assert.equal(changed.data.roles[0].data_scope, value);
    savedScopes.push({
      value,
      label,
      status: changed.status,
      traceId: changed.traceId,
    });
  }
  await page.getByLabel('数据范围', { exact: true }).click();
  await shot('05-five-data-scopes-real', page);
  await page.keyboard.press('Escape');
  await record(
    5,
    '五种数据范围逐个切换、真实 PUT 保存并回读一致，最终恢复仅本人',
    { scopes: savedScopes, screenshot: '05-five-data-scopes-real.png' },
  );

  const savedOriginal = await api('/admin/tenant-templates/' + original.id);
  await page.reload();
  await page.getByTestId('template-role-panel').waitFor();
  assert.equal(
    await page.getByLabel('角色名', { exact: true }).inputValue(),
    '只读',
  );
  await page.getByLabel('搜索权限码', { exact: true }).fill(read.code);
  assert.equal(
    await page
      .getByRole('checkbox', { name: read.code, exact: true })
      .isChecked(),
    true,
  );
  assert.equal(await button('保存模板', page).isDisabled(), true);
  assert.deepEqual(savedOriginal.menus, original.menus);
  await shot('06-reloaded-real', page);
  await record(
    6,
    '刷新后角色名、不可改 code、仅本人范围和已勾权限回填，模板菜单图保持一致且只读',
    {
      roles: savedOriginal.roles,
      menusUnchanged: true,
      screenshot: '06-reloaded-real.png',
    },
  );

  await button('返回模板列表', page).click();
  await page.getByTestId('tenant-template-table').waitFor();
  await button('复制模板', row(page, original.id)).click();
  await modal(page)
    .getByLabel('模板 Code', { exact: true })
    .fill(prefix + '_copy');
  await modal(page)
    .getByLabel('模板名称', { exact: true })
    .fill('只读副本 ' + prefix);
  const cloned = await response(
    page,
    '/admin/tenant-templates/' + original.id + '/clone',
    'POST',
    () => button('确认复制', modal(page)).click(),
  );
  assert.equal(cloned.status, 201);
  await remember('templates', cloned.data);
  assert.deepEqual(cloned.data.roles, savedOriginal.roles);
  await page.waitForURL(origin + '/system/tenants/templates/' + cloned.data.id);
  await page.getByLabel('角色名', { exact: true }).fill('副本角色');
  await page.getByLabel('搜索权限码', { exact: true }).fill(extra.code);
  await page.getByRole('checkbox', { name: extra.code, exact: true }).check();
  await save(page, cloned.data.id);
  assert.deepEqual(
    (await api('/admin/tenant-templates/' + original.id)).roles,
    savedOriginal.roles,
  );
  await shot('07-independent-clone-real', page);
  await record(
    7,
    '专用 clone 接口真实 201；副本改名并增授权限后，原模板角色及权限原样保留',
    {
      originalId: original.id,
      cloneId: cloned.data.id,
      sourceRoles: savedOriginal.roles,
      cloneRoles: (await api('/admin/tenant-templates/' + cloned.data.id))
        .roles,
      screenshot: '07-independent-clone-real.png',
    },
  );

  const tenant = await provision(page, savedOriginal, prefix + '_tenant');
  const tenantContext = await context(browser);
  const tenantPage = await tenantContext.newPage();
  await tenantPage.goto(tenant.invitation);
  await tenantPage
    .getByLabel('用户名', { exact: true })
    .fill(prefix + '_tenant_admin');
  await tenantPage.getByLabel('新密码', { exact: true }).fill(password);
  await tenantPage.getByLabel('确认密码', { exact: true }).fill(password);
  const accepted = await response(
    tenantPage,
    '/auth/invite/accept',
    'POST',
    () => button('创建账号', tenantPage).click(),
  );
  assert.ok([200, 201].includes(accepted.status));
  const tenantAuth = await login(
    tenantPage,
    prefix + '_tenant_admin',
    password,
    prefix + '_tenant',
  );
  const me = await api('/auth/me', 'GET', undefined, tenantAuth.access_token);
  assert.equal(me.user.tenant_id, tenant.id);
  const roles = await api(
    '/admin/roles?page_size=100',
    'GET',
    undefined,
    tenantAuth.access_token,
  );
  assert.equal(roles.total, savedOriginal.roles.length);
  const reader = roles.list.find((role) => role.code === 'reader');
  assert.ok(reader);
  assert.equal(reader.name, '只读');
  assert.equal(reader.data_scope, 'self');
  const permissionIds = await api(
    '/admin/roles/' + reader.id + '/permissions',
    'GET',
    undefined,
    tenantAuth.access_token,
  );
  const tenantGroups = await api(
    '/admin/permissions',
    'GET',
    undefined,
    tenantAuth.access_token,
  );
  const permissionCodes = Object.values(tenantGroups)
    .flat()
    .filter((permission) => permissionIds.includes(permission.id))
    .map((permission) => permission.code);
  assert.deepEqual(permissionCodes, [read.code]);
  await tenantPage.goto(origin + '/system/roles');
  await tenantPage.getByText('只读', { exact: true }).first().waitFor();
  await shot('08-tenant-roles-real', tenantPage);
  await record(
    8,
    '真实向导开通只读版租户、接受邀请并登录新租户；在该租户下 GET 角色和授权，只有只读角色与单个权限',
    {
      tenantId: tenant.id,
      tenantCode: prefix + '_tenant',
      provisionStatus: tenant.status,
      provisionTraceId: tenant.traceId,
      loginTenantId: me.user.tenant_id,
      roles: roles.list,
      rolePermissionIds: permissionIds,
      rolePermissionCodes: permissionCodes,
      screenshots: ['08-provisioned-real.png', '08-tenant-roles-real.png'],
    },
  );
  await tenantContext.close();

  await verifyTemplateUsage(page, original.id);

  const zero = await blank(page, prefix + '_zero', '零角色 ' + prefix);
  const zeroTenant = await provision(
    page,
    zero.data,
    prefix + '_zero_tenant',
    true,
  );
  await record(
    10,
    '选择零角色模板显示完整警告，确认开通仍可用，真实 POST 返回 201',
    {
      templateId: zero.data.id,
      roleCount: 0,
      tenantId: zeroTenant.id,
      status: zeroTenant.status,
      screenshots: [
        '10-zero-role-warning-real.png',
        '10-zero-role-provisioned-real.png',
      ],
    },
  );

  await verifyUnsaved(page, cloned.data);
  await verifyEmptyTemplates(page, prefix);
  assert.deepEqual(report.browserErrors, []);
} catch (error) {
  failure = error;
  report.failure = redact(error.stack || error.message);
  await shot('failure-masked', page).catch(() => undefined);
} finally {
  report.finishedAt = new Date().toISOString();
  await persist();
  await browser.close();
}
if (failure) throw new Error(redact(failure.stack || failure.message));
