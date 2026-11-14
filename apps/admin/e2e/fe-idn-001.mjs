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
  closeLink,
  invitation,
  login,
  modal,
  openTenants,
  origin,
  output,
  redact,
  request,
  response,
  row,
  secrets,
  setup,
  shot,
} from './fe-idn-001-support.mjs';

const prefix = 'idn_' + Date.now();
const password = 'Idn@' + randomBytes(14).toString('hex');
secrets.add(password);
const browser = await setup();
const context = await browser.newContext({
  viewport: { width: 1800, height: 1100 },
  locale: 'zh-CN',
  timezoneId: 'Asia/Shanghai',
  permissions: ['clipboard-read', 'clipboard-write'],
});
const page = await context.newPage();
page.on('pageerror', (error) => browserErrors.push(redact(error.message)));
let tenantId;
let templateId;
let createdTemplate = false;
let failure;
let cleanup;
let inviteRequests = 0;
page.on('request', (item) => {
  if (
    item.method() === 'POST' &&
    new URL(item.url()).pathname.endsWith('/admin-invite')
  )
    inviteRequests++;
});
async function accept(link) {
  const url = new URL(link);
  return request(
    '/auth/invite/accept',
    'POST',
    {
      tenant_id: tenantId,
      token: url.hash.slice(7),
      username: prefix + '_admin',
      password,
    },
    null,
  );
}
async function forceInvite() {
  await button('重置管理员', row(page, tenantId)).click();
  await modal(page)
    .getByText('该租户已有 1 个管理员，重发会作废未使用的旧邀请。继续？', {
      exact: true,
    })
    .waitFor();
  return response(
    page,
    '/admin/tenants/' + tenantId + '/admin-invite',
    'POST',
    () => button('确认重发', modal(page)).click(),
  );
}
try {
  await login(page);
  const templates = await api('/admin/tenant-templates?page_size=100');
  if (templates.list.length) templateId = templates.list[0].id;
  else {
    const snapshot = await api('/admin/tenant-templates', 'POST', {
      source_tenant_id: 1,
      code: prefix,
      name: 'FE-IDN 验收模板',
      description: 'FE-IDN-001 acceptance',
    });
    templateId = snapshot.id;
    createdTemplate = true;
  }
  const provisioned = await api('/admin/tenants', 'POST', {
    code: prefix,
    name: 'FE-IDN 验收租户',
    template_id: templateId,
    admin_username: prefix + '_admin',
  });
  tenantId = provisioned.tenant_id;
  secrets.add(provisioned.invite_url);
  secrets.add(new URL(provisioned.invite_url, origin).hash.slice(7));
  await openTenants(page);
  const target = row(page, tenantId);
  assert.equal(
    await target.locator('td').first().innerText(),
    String(tenantId),
  );
  assert.ok(
    (
      await target.locator('td').first().locator('span').getAttribute('class')
    ).includes('font-mono'),
  );
  const inactive = target.getByText('未激活', { exact: true });
  assert.ok((await inactive.getAttribute('class')).includes('ant-tag-red'));
  await shot('01-id-and-inactive-real', page);
  check(1, '数字 ID 与接口 tenant_id 一致，使用等宽字体', {
    tenantId,
    screenshot: '01-id-and-inactive-real.png',
  });

  const members = await response(
    page,
    '/admin/tenants/' + tenantId + '/members',
    'GET',
    () => button('查看成员', target).click(),
  );
  assert.equal(members.status, 200);
  assert.equal(members.url.searchParams.get('page'), '1');
  assert.equal(members.url.searchParams.get('page_size'), '20');
  const drawer = page.locator('.ant-drawer-content').filter({ visible: true });
  await drawer
    .getByTestId('tenant-member-table')
    .locator('tbody tr[data-row-key]')
    .first()
    .waitFor();
  const dictionary = await api('/meta/dicts/user_status');
  for (const member of members.data.list) {
    assert.deepEqual(Object.keys(member).sort(), [
      'account',
      'created_at',
      'id',
      'is_super',
      'nickname',
      'status',
    ]);
    const cells = drawer.locator('[data-row-key="' + member.id + '"] td');
    assert.equal(await cells.nth(0).innerText(), member.account);
    assert.equal(
      await cells.nth(1).innerText(),
      dictionary.find((item) => item.value === member.status)?.label ||
        member.status,
    );
    assert.equal(await cells.nth(2).innerText(), member.is_super ? '是' : '否');
    const expected = new Date(member.created_at).toLocaleString('sv-SE', {
      timeZone: 'Asia/Shanghai',
    });
    assert.equal(await cells.nth(3).innerText(), expected);
  }
  assert.equal(await drawer.locator('input,select,textarea').count(), 0);
  for (const label of ['编辑', '禁用成员', '重置密码', '删除'])
    assert.equal(await button(label, drawer).count(), 0);
  await shot('03-members-readonly-real', page);
  await drawer.locator('.ant-drawer-close').click();
  await drawer.waitFor({ state: 'hidden' });
  check(
    3,
    '成员来自目标租户真实 GET，分页、安全字段、字典状态、超管及时间一致，抽屉无写按钮',
    {
      tenantId,
      status: members.status,
      total: members.data.total,
      safeFields: Object.keys(members.data.list[0]).sort(),
      screenshot: '03-members-readonly-real.png',
    },
  );

  const issued = await response(
    page,
    '/admin/tenants/' + tenantId + '/admin-invite',
    'POST',
    () => button('重发管理员邀请', target).click(),
  );
  assert.equal(issued.status, 201);
  assert.equal(issued.url.searchParams.has('force'), false);
  const first = await invitation(page);
  assert.equal(new URL(first).origin, origin);
  const previous = await accept(new URL(provisioned.invite_url, origin).href);
  assert.equal(previous.status, 400);
  await shot('04-direct-invite-masked-real', page);
  check(
    4,
    '无管理员直接签发 201，不带 force，弹窗显示链接且此前开通邀请已失效',
    {
      status: issued.status,
      forcePresent: false,
      revokedInitialStatus: previous.status,
      screenshot: '04-direct-invite-masked-real.png',
    },
  );
  await button('复制链接', modal(page)).click();
  await page.getByText('链接已复制', { exact: true }).waitFor();
  assert.equal(
    await page.evaluate(() => navigator.clipboard.readText()),
    first,
  );
  assert.equal(
    await page.evaluate(
      (value) =>
        JSON.stringify({ ...localStorage, ...sessionStorage }).includes(value),
      first,
    ),
    false,
  );
  await closeLink(page);
  assert.equal(await page.getByLabel('账号链接').count(), 0);
  await openTenants(page);
  assert.equal(await page.getByLabel('账号链接').count(), 0);
  assert.equal(
    await page.evaluate(
      (value) =>
        JSON.stringify({ ...localStorage, ...sessionStorage }).includes(value),
      first,
    ),
    false,
  );
  await shot('06-link-discarded-real', page);
  check(
    6,
    '复制内容一致，关闭与刷新后均无链接，localStorage/sessionStorage 不含邀请',
    {
      clipboardMatched: true,
      storageContainsLink: false,
      recoveredAfterClose: false,
      recoveredAfterReload: false,
      screenshot: '06-link-discarded-real.png',
    },
  );

  const activated = await accept(first);
  assert.ok([200, 201].includes(activated.status));
  await openTenants(page);
  const directoryAfterActivation = await api('/admin/tenants?page_size=100');
  const active = directoryAfterActivation.list.find(
    (tenant) => tenant.id === tenantId,
  );
  assert.ok(active, 'Activated tenant appears in the directory');
  assert.equal(active.admin_active_count, 1);
  assert.equal(
    await row(page, tenantId).getByText('1 人', { exact: true }).count(),
    1,
  );
  await shot('02-admin-count-real', page);
  check(
    2,
    'admin_active_count=0 显示红色未激活；接受邀请后接口计数 1，界面显示 1 人',
    {
      before: 0,
      after: active.admin_active_count,
      screenshots: ['01-id-and-inactive-real.png', '02-admin-count-real.png'],
    },
  );
  const beforeCancel = inviteRequests;
  await button('重置管理员', row(page, tenantId)).click();
  await modal(page)
    .getByText('该租户已有 1 个管理员，重发会作废未使用的旧邀请。继续？', {
      exact: true,
    })
    .waitFor();
  await shot('05-confirm-force-real', page);
  await button('取消', modal(page)).click();
  await modal(page).waitFor({ state: 'hidden' });
  assert.equal(inviteRequests, beforeCancel);
  const forced = await forceInvite();
  assert.equal(forced.status, 201);
  assert.equal(forced.url.searchParams.get('force'), 'true');
  const pending = await invitation(page);
  await closeLink(page);
  const forcedAgain = await forceInvite();
  assert.equal(forcedAgain.status, 201);
  assert.equal(forcedAgain.url.searchParams.get('force'), 'true');
  const newest = await invitation(page);
  assert.notEqual(newest, pending);
  const revoked = await accept(pending);
  assert.equal(revoked.status, 400);
  const accepted = await accept(newest);
  assert.ok([200, 201].includes(accepted.status));
  await shot('05-forced-link-masked-real', page);
  await closeLink(page);
  check(
    5,
    '已有管理员先确认，取消零请求；确认带 force=true 返回 201，再签发后未使用旧邀请接受 400，新邀请可接受',
    {
      cancelledRequestCount: inviteRequests - beforeCancel - 2,
      force: true,
      status: forced.status,
      revokedPendingStatus: revoked.status,
      newestAcceptStatus: accepted.status,
      screenshots: [
        '05-confirm-force-real.png',
        '05-forced-link-masked-real.png',
      ],
    },
  );

  await button('停用', row(page, tenantId)).click();
  const suspended = await response(
    page,
    '/admin/tenants/' + tenantId + '/disable',
    'POST',
    () => button('确认停用', modal(page)).click(),
  );
  assert.equal(suspended.data.status, 'suspended');
  await modal(page).waitFor({ state: 'hidden' });
  const disabledInvite = button('重置管理员', row(page, tenantId));
  await button('启用', row(page, tenantId)).waitFor();
  assert.equal(await disabledInvite.isDisabled(), true);
  await disabledInvite.hover({ force: true });
  await page
    .getByRole('tooltip')
    .getByText('租户已停用', { exact: true })
    .waitFor();
  await shot('07-suspended-tooltip-real', page);
  check(7, '真实停用后重发按钮 disabled，悬浮提示租户已停用', {
    status: suspended.data.status,
    resendDisabled: true,
    screenshot: '07-suspended-tooltip-real.png',
  });

  await openTenants(page);
  if (!(await row(page, 1).count())) {
    const directory = await api('/admin/tenants?page_size=100');
    await page
      .locator(
        '.ant-pagination-item[title="' + Math.ceil(directory.total / 20) + '"]',
      )
      .click();
  }
  await row(page, 1).getByText('平台', { exact: true }).waitFor();
  assert.equal(await button('停用', row(page, 1)).isDisabled(), true);
  await button('停用', row(page, 1)).hover({ force: true });
  await page
    .getByRole('tooltip')
    .getByText('平台租户不可停用', { exact: true })
    .waitFor();
  await shot('08-platform-protection-real', page);
  check(8, '平台行显示平台标记，停用按钮禁用且提示平台租户不可停用', {
    platformTenantId: 1,
    screenshot: '08-platform-protection-real.png',
  });

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
    '重发管理员邀请',
    '重置管理员',
    '开通租户',
    '停用',
    '启用',
    '编辑名称',
  ])
    assert.equal(await button(label, page).count(), 0);
  assert.ok((await button('查看成员', page).count()) > 0);
  const readonlyMembers = await response(
    page,
    '/admin/tenants/' + tenantId + '/members',
    'GET',
    () => button('查看成员', row(page, tenantId)).click(),
  );
  assert.equal(readonlyMembers.status, 200);
  await shot('09-no-manage-members-ui-fixture', page);
  check(9, '移除菜单响应 manage 后重发及其他写入口隐藏，查看成员仍可用', {
    source: 'real-super-session-with-manage-removed-from-menu-response',
    fixture: true,
    reason:
      '后端平台超管始终返回全量权限；仅该 UI 权限分支使用响应夹具，其余验收为真实后端。',
    membersStatus: readonlyMembers.status,
    screenshot: '09-no-manage-members-ui-fixture.png',
  });
  assert.deepEqual(browserErrors, []);
} catch (error) {
  failure = { message: redact(error.message), stack: redact(error.stack) };
  await shot('failure', page).catch(() => {});
} finally {
  await browser.close();
  try {
    if (tenantId) {
      const current = await api('/admin/tenants/' + tenantId);
      if (current.status !== 'suspended')
        await api('/admin/tenants/' + tenantId + '/disable', 'POST');
      cleanup = {
        retainedTenantId: tenantId,
        status: 'suspended',
        reason: '无租户删除 API；仅保留停用的独立验收租户。',
      };
    } else if (createdTemplate)
      await api('/admin/tenant-templates/' + templateId, 'DELETE');
  } catch (error) {
    cleanup = { error: redact(error.message) };
  }
  await writeFile(
    new URL('acceptance.json', output),
    JSON.stringify(
      {
        task: 'FE-IDN-001',
        date: new Date().toISOString(),
        checks: checks.sort((a, b) => a.item - b.item),
        browserErrors,
        cleanup,
        ...(failure ? { failure } : {}),
      },
      null,
      2,
    ),
  );
}
assert.ok(!failure, failure?.message);
assert.ok(!cleanup?.error, cleanup?.error);
assert.deepEqual(
  checks.map((item) => item.item),
  Array.from({ length: 9 }, (_, index) => index + 1),
);
process.stdout.write(
  JSON.stringify({
    passed: checks.length,
    browserErrors: browserErrors.length,
    cleanup,
  }) + '\n',
);
