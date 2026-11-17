import assert from 'node:assert/strict';

import {
  api,
  archivedFilter,
  button,
  idle,
  openTenants,
  publicResult,
  record,
  request,
  response,
  row,
  shot,
} from './fe-idn-008-support.mjs';

async function platformRow(page) {
  if (!(await row(page, 1).count())) {
    const directory = await api('/admin/tenants?page_size=100');
    await page
      .locator(
        `.ant-pagination-item[title="${Math.ceil(directory.total / 20)}"]`,
      )
      .click();
  }
  await row(page, 1).waitFor();
}
export async function verifyPlatform(page) {
  await platformRow(page);
  assert.equal(await button('归档', row(page, 1)).isDisabled(), true);
  await button('归档', row(page, 1)).hover({ force: true });
  await page
    .getByRole('tooltip')
    .getByText('平台租户不可归档/删除', { exact: true })
    .waitFor();
  await shot('06-platform-archive-real', page);
  const archive = await request('/admin/tenants/1/archive', 'POST');
  const purge = await request('/admin/tenants/1?confirm=default', 'DELETE');
  assert.equal(archive.status, 409);
  assert.equal(purge.status, 409);
  const pattern = '**/api/v1/admin/tenants?**';
  const fixture = async (route) => {
    const result = await route.fetch();
    const body = await result.json();
    body.data.list = body.data.list.map((tenant) =>
      tenant.id === 1
        ? { ...tenant, status: 'suspended', deleted_at: '2026-11-09T00:00:00Z' }
        : tenant,
    );
    await route.fulfill({ response: result, json: body });
  };
  await page.route(pattern, fixture);
  await openTenants(page);
  await platformRow(page);
  assert.equal(await button('彻底删除', row(page, 1)).isDisabled(), true);
  await button('彻底删除', row(page, 1)).hover({ force: true });
  await page
    .getByRole('tooltip')
    .getByText('平台租户不可归档/删除', { exact: true })
    .waitFor();
  await shot('06-platform-delete-ui-fixture', page);
  await page.unroute(pattern, fixture);
  await openTenants(page);
  await archivedFilter(page, true);
  await record(
    6,
    '平台归档禁用并提示；直调归档/删除均 409；平台已归档响应夹具验证删除禁用与同一提示',
    {
      archive: publicResult(archive),
      purge: publicResult(purge),
      archivedPlatformSource:
        'UI response fixture; real backend never permits platform archival',
      screenshots: [
        '06-platform-archive-real.png',
        '06-platform-delete-ui-fixture.png',
      ],
    },
    'real-platform-protection-plus-explicit-archived-platform-UI-fixture',
  );
}
export async function verifyPermissions(page, tenantId) {
  const pattern = '**/api/v1/auth/menus';
  const fixture = async (route) => {
    const result = await route.fetch();
    const body = await result.json();
    body.data.permissions = body.data.permissions.filter(
      (code) => code !== 'system:tenant:manage',
    );
    await route.fulfill({ response: result, json: body });
  };
  await page.route(pattern, fixture);
  await response(page, '/admin/tenants', 'GET', () => page.reload());
  await idle(page);
  await archivedFilter(page, true);
  await row(page, tenantId).getByText('已归档', { exact: true }).waitFor();
  for (const label of [
    '开通租户',
    '编辑名称',
    '停用',
    '启用',
    '归档',
    '恢复',
    '彻底删除',
    '重发管理员邀请',
    '重置管理员',
  ]) {
    assert.equal(
      await button(label, page).count(),
      0,
      label + ' hidden without manage',
    );
  }
  assert.ok((await button('查看成员', page).count()) > 0);
  assert.equal(await button('查看成员', row(page, tenantId)).count(), 0);
  await shot('11-no-manage-ui-fixture', page);
  await record(
    11,
    '移除 manage 后开通/编辑/停启/邀请/归档/恢复/删除全部隐藏；归档行无查看成员',
    {
      reason:
        '平台超管实际始终拥有 manage；只对菜单权限响应删除该权限以验证前端分支。租户列表仍来自真实后端。',
      screenshot: '11-no-manage-ui-fixture.png',
    },
    'real-super-session-with-manage-removed-from-menu-response',
  );
  await page.unroute(pattern, fixture);
  await response(page, '/admin/tenants', 'GET', () => page.reload());
  await idle(page);
  await archivedFilter(page, true);
}

export async function verifyTemplateReference(page, templateId, tenant) {
  const directory = await response(page, '/admin/tenants', 'GET', () =>
    page.getByRole('tab', { name: '租户模板', exact: true }).click(),
  );
  assert.equal(directory.url.searchParams.get('include_archived'), 'true');
  const templateRow = page
    .getByTestId('tenant-template-table')
    .locator(`[data-row-key="${templateId}"]`);
  await templateRow.getByText('1 个租户', { exact: true }).waitFor();
  assert.equal(await button('删除模板', templateRow).isDisabled(), true);
  await button('从租户创建', page).click();
  await page
    .getByRole('dialog')
    .getByLabel('来源租户', { exact: true })
    .click();
  await page
    .locator('.ant-select-dropdown')
    .filter({ visible: true })
    .waitFor();
  assert.equal(
    await page
      .locator('.ant-select-item-option-content')
      .filter({ hasText: tenant.code })
      .count(),
    0,
  );
  await shot('supplement-archived-template-reference-real', page);
  await button('取消', page.getByRole('dialog')).click();
  await response(page, '/admin/tenants', 'GET', () =>
    page.getByRole('tab', { name: '租户列表', exact: true }).click(),
  );
  await idle(page);
  await archivedFilter(page, true);
}
