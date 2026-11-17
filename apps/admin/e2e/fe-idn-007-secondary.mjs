import assert from 'node:assert/strict';

import {
  api,
  button,
  modal,
  origin,
  record,
  request,
  row,
  shot,
  templates,
} from './fe-idn-007-support.mjs';

export async function verifyUnsaved(page, template) {
  await page.goto(origin + '/system/tenants/templates/' + template.id);
  await page.getByLabel('模板名称', { exact: true }).fill('不会保存的修改');
  await button('返回模板列表', page).click();
  await modal(page).getByText('模板有未保存的修改', { exact: true }).waitFor();
  await shot('11-unsaved-route-confirm-real', page);
  await button('取消', modal(page)).click();
  assert.equal(
    await page.getByLabel('模板名称', { exact: true }).inputValue(),
    '不会保存的修改',
  );
  const pendingDialog = page.waitForEvent('dialog');
  const reloading = page.reload().catch(() => undefined);
  const dialog = await pendingDialog;
  assert.equal(dialog.type(), 'beforeunload');
  await dialog.dismiss();
  await reloading;
  assert.equal(
    await page.getByLabel('模板名称', { exact: true }).inputValue(),
    '不会保存的修改',
  );
  await button('返回模板列表', page).click();
  await button('放弃修改并离开', modal(page)).click();
  await page.waitForURL(origin + '/system/tenants/templates');
  assert.equal(
    (await api('/admin/tenant-templates/' + template.id)).name,
    template.name,
  );
  await record(
    11,
    '修改后站内离开显示确认；取消保留草稿；浏览器刷新触发真实 beforeunload，取消刷新仍保留，放弃后未写入服务端',
    {
      routeConfirmation: true,
      refreshDialogType: 'beforeunload',
      cancelledDraftRetained: true,
      screenshot: '11-unsaved-route-confirm-real.png',
    },
  );
}

export async function verifyEmptyTemplates(page, prefix) {
  await page.route('**/api/v1/admin/tenant-templates?**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 0,
        message: 'ok',
        data: { list: [], total: 0, page: 1, page_size: 100 },
      }),
    }),
  );
  await page.goto(origin + '/system/tenants');
  await button('开通租户', page).click();
  await modal(page)
    .getByLabel('租户 Code', { exact: true })
    .fill(prefix + '_empty');
  await modal(page).getByLabel('租户名称', { exact: true }).fill('空态验证');
  await button('下一步', modal(page)).click();
  await modal(page)
    .getByText('还没有可用的租户模板', { exact: true })
    .waitFor();
  assert.equal(
    await modal(page).getByLabel('租户模板', { exact: true }).count(),
    0,
  );
  assert.equal(await button('确认开通', modal(page)).isDisabled(), true);
  await shot('09-empty-templates-ui-fixture', page);
  await button('去创建模板', modal(page)).click();
  await page.waitForURL(origin + '/system/tenants/templates');
  await button('新建空白模板', page).waitFor();
  await page.unroute('**/api/v1/admin/tenant-templates?**');
  await record(
    9,
    '仅列表响应使用空集合夹具：向导显示空态与跳转，隐藏下拉、禁用开通，按钮跳到模板页',
    {
      emptySelectorCount: 0,
      submitDisabled: true,
      destination: '/system/tenants/templates',
      screenshot: '09-empty-templates-ui-fixture.png',
    },
    'browser-response-fixture',
  );
}

export async function verifyTemplateUsage(page, templateId) {
  await templates(page);
  await row(page, templateId).waitFor();
  const cells = await row(page, templateId).locator('td').allTextContents();
  assert.equal(cells[2].trim(), '1 个');
  assert.equal(cells[3].trim(), '1 个');
  assert.equal(cells[4].trim(), '1 个租户');
  assert.equal(
    await button('删除模板', row(page, templateId)).isDisabled(),
    true,
  );
  const protectedDelete = await request(
    '/admin/tenant-templates/' + templateId,
    'DELETE',
  );
  assert.equal(protectedDelete.status, 409);
  await shot('01-template-counts-protection-real', page);
  await record(
    1,
    '列表显示角色数、角色权限去重数和使用中租户数量；真实引用后删除禁用，直接删除接口 409',
    {
      templateId,
      roles: 1,
      permissions: 1,
      usage: 1,
      deleteProtection: {
        status: protectedDelete.status,
        code: protectedDelete.code,
        message: protectedDelete.message,
      },
      screenshot: '01-template-counts-protection-real.png',
    },
  );
}
