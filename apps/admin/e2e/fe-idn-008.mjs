import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import process from 'node:process';

import {
  addBusiness,
  backdate,
  baseline,
  cleanup,
  database,
  removeBusiness,
} from './fe-idn-008-fixtures.mjs';
import {
  verifyPermissions,
  verifyPlatform,
  verifyTemplateReference,
} from './fe-idn-008-secondary.mjs';
import {
  api,
  archivedFilter,
  button,
  idle,
  login,
  modal,
  openTenants,
  output,
  persist,
  publicResult,
  record,
  redact,
  report,
  request,
  response,
  row,
  secrets,
  setup,
  shot,
  userAgents,
} from './fe-idn-008-support.mjs';

const prefix = 'feidn008_' + Date.now();
const password = 'Lifecycle@' + randomBytes(14).toString('hex');
secrets.add(password);
report.fixtureSQL = [];
const browser = await setup();
const db = database();
const before = await baseline(db);
const context = await browser.newContext({
  userAgent: userAgents[1],
  viewport: { width: 2200, height: 1100 },
  locale: 'zh-CN',
  timezoneId: 'Asia/Shanghai',
});
const page = await context.newPage();
page.on('pageerror', (error) =>
  report.browserErrors.push(redact(error.message)),
);
let failure;
async function archive(tenant) {
  await button('归档', row(page, tenant.id)).click();
  await modal(page)
    .getByText('该租户用户立即无法登录', { exact: true })
    .waitFor();
  await shot('04-archive-confirm-real', page);
  const result = await response(
    page,
    '/admin/tenants/' + tenant.id + '/archive',
    'POST',
    () => button('确认归档', modal(page)).click(),
  );
  assert.equal(result.status, 200);
  assert.equal(result.data.status, 'suspended');
  assert.ok(result.data.deleted_at);
  await modal(page).waitFor({ state: 'hidden' });
  await idle(page);
  return result;
}
try {
  await login(page);
  const template = await api('/admin/tenant-templates', 'POST', {
    code: prefix + '_template',
    name: 'FE-IDN-008 生命周期验收',
    description: '',
  });
  report.resources.templates.push({ id: template.id, code: template.code });
  await persist();
  const code = prefix + '_tenant';
  const username = prefix + '_admin';
  const provisioned = await api('/admin/tenants', 'POST', {
    code,
    name: 'FE-IDN-008 生命周期验收',
    template_id: template.id,
    admin_username: username,
  });
  const tenant = { id: provisioned.tenant_id, code };
  report.resources.tenants.push(tenant);
  await persist();
  assert.equal(
    (await db`SELECT code FROM tenant WHERE id=${tenant.id}`)[0]?.code,
    code,
    'Fixture connection must point to the running development backend database',
  );
  const invitation = new URL(provisioned.invite_url, originForInvite());
  const inviteToken =
    invitation.hash.slice(7) || invitation.searchParams.get('token');
  secrets.add(inviteToken);
  const accepted = await request(
    '/auth/invite/accept',
    'POST',
    { tenant_id: tenant.id, token: inviteToken, username, password },
    null,
  );
  assert.ok([200, 201].includes(accepted.status));
  const tenantLogin = () =>
    request(
      '/auth/login',
      'POST',
      { tenant: code, account: username, password },
      null,
    );
  const initialLogin = await tenantLogin();
  assert.equal(initialLogin.status, 200);
  const initial = await openTenants(page);
  assert.equal(initial.url.searchParams.has('include_archived'), false);
  await row(page, tenant.id)
    .locator('.ant-tag-green')
    .getByText('正常', { exact: true })
    .waitFor();
  await shot('01-active-real', page);
  const suspended = await response(
    page,
    '/admin/tenants/' + tenant.id + '/disable',
    'POST',
    async () => {
      await button('停用', row(page, tenant.id)).click();
      await button('确认停用', modal(page)).click();
    },
  );
  assert.equal(suspended.data.status, 'suspended');
  await modal(page).waitFor({ state: 'hidden' });
  await row(page, tenant.id)
    .locator('.ant-tag-default')
    .getByText('已停用', { exact: true })
    .waitFor();
  await shot('01-suspended-real', page);
  const archived = await archive(tenant);
  await row(page, tenant.id).waitFor({ state: 'hidden' });
  const defaultList = await api('/admin/tenants?page_size=100');
  assert.equal(
    defaultList.list.some((item) => item.id === tenant.id),
    false,
  );
  await shot('02-default-hides-archived-real', page);
  await record(
    2,
    '默认请求未带 include_archived；真实归档后默认列表与界面均无该租户',
    {
      tenantId: tenant.id,
      query: initial.url.search,
      screenshot: '02-default-hides-archived-real.png',
    },
  );
  const denied = await tenantLogin();
  assert.equal(denied.status, 403);
  assert.equal(denied.code, 20111);
  await record(
    4,
    '真实确认归档后 status=suspended 且 deleted_at 非空；原租户管理员登录被拒绝 403/20111',
    {
      archive: publicResult(archived),
      deletedAt: archived.data.deleted_at,
      login: publicResult(denied),
      screenshots: [
        '04-archive-confirm-real.png',
        '02-default-hides-archived-real.png',
      ],
    },
  );
  const included = await archivedFilter(page, true);
  await row(page, tenant.id)
    .locator('.ant-tag-red')
    .getByText('已归档', { exact: true })
    .waitFor();
  const localTime = new Date(archived.data.deleted_at).toLocaleString('sv-SE', {
    timeZone: 'Asia/Shanghai',
  });
  await row(page, tenant.id)
    .getByText('归档时间：' + localTime, { exact: true })
    .waitFor();
  await shot('03-includes-archived-time-real', page);
  await record(1, '正常绿色、已停用灰色、已归档红色；归档优先于 suspended', {
    states: ['active', 'suspended', 'archived'],
    screenshots: [
      '01-active-real.png',
      '01-suspended-real.png',
      '03-includes-archived-time-real.png',
    ],
  });
  await record(
    3,
    '开关开启带 include_archived=true，显示真实归档时间；关闭恢复默认无此参数',
    {
      query: included.url.search,
      utcTime: archived.data.deleted_at,
      displayedTime: localTime,
      screenshot: '03-includes-archived-time-real.png',
    },
  );
  await archivedFilter(page, false);
  await row(page, tenant.id).waitFor({ state: 'hidden' });
  await archivedFilter(page, true);
  const restored = await response(
    page,
    '/admin/tenants/' + tenant.id + '/restore',
    'POST',
    () => button('恢复', row(page, tenant.id)).click(),
  );
  assert.equal(restored.status, 200);
  assert.equal(restored.data.status, 'active');
  assert.equal(restored.data.deleted_at, null);
  await row(page, tenant.id).getByText('正常', { exact: true }).waitFor();
  const reopened = await tenantLogin();
  assert.equal(reopened.status, 200);
  await shot('05-restored-login-real', page);
  await record(5, '恢复后 active、deleted_at=null，原账号密码再次登录 200', {
    restore: publicResult(restored),
    login: publicResult(reopened),
    screenshot: '05-restored-login-real.png',
  });
  await verifyPlatform(page);
  await archive(tenant);
  await row(page, tenant.id).getByText('已归档', { exact: true }).waitFor();
  await verifyTemplateReference(page, template.id, tenant);
  report.templateReference = {
    source: 'real-backend-and-browser',
    archivedReferenceIncluded: true,
    deleteDisabled: true,
    archivedSourceExcluded: true,
    screenshot: 'supplement-archived-template-reference-real.png',
  };
  await verifyPermissions(page, tenant.id);
  await button('彻底删除', row(page, tenant.id)).click();
  const input = modal(page).getByLabel('租户代码确认', { exact: true });
  assert.equal(await button('删除', modal(page)).isDisabled(), true);
  const mismatches = [code.toUpperCase(), code + ' ', ' ' + code, 'wrong'];
  for (const incorrect of mismatches) {
    await input.fill(incorrect);
    assert.equal(await button('删除', modal(page)).isDisabled(), true);
  }
  await shot('07-wrong-code-disabled-real', page);
  await input.fill(code);
  assert.equal(await button('删除', modal(page)).isEnabled(), true);
  assert.equal(
    /\d+ 条业务数据|\d+ 个用户/.test(await modal(page).innerText()),
    false,
  );
  await shot('07-exact-code-enabled-real', page);
  await record(
    7,
    '空值、错误 code、大小写差异、首尾空格均禁用；完全一致才可提交，无虚构统计数字',
    {
      mismatches,
      screenshots: [
        '07-wrong-code-disabled-real.png',
        '07-exact-code-enabled-real.png',
      ],
    },
  );
  const purgePath = '/admin/tenants/' + tenant.id;
  const purge = () =>
    response(page, purgePath, 'DELETE', () =>
      button('删除', modal(page)).click(),
    );
  const grace = await purge();
  assert.equal(grace.status, 409);
  assert.equal(grace.message, '归档未满 7 天');
  await modal(page).getByText(grace.message, { exact: true }).waitFor();
  await shot('08-grace-409-real', page);
  await record(8, '真实删除请求在宽限期内返回 409，弹窗逐字显示后端原文', {
    ...publicResult(grace),
    screenshot: '08-grace-409-real.png',
  });
  await backdate(db, tenant);
  const businessId = await addBusiness(db, tenant);
  const blocked = await purge();
  assert.equal(blocked.status, 409);
  assert.equal(blocked.message, '租户仍有业务数据，暂不支持彻底删除');
  await modal(page).getByText(blocked.message, { exact: true }).waitFor();
  assert.equal(
    (
      await db`SELECT count(*)::int AS count FROM category WHERE id=${businessId} AND tenant_id=${tenant.id}`
    )[0].count,
    1,
  );
  assert.equal(
    (
      await db`SELECT count(*)::int AS count FROM sys_user WHERE tenant_id=${tenant.id}`
    )[0].count,
    1,
  );
  await shot('09-business-data-409-real', page);
  await record(
    9,
    '只对本卡租户回拨归档时间并加入一条类目，真实删除返回业务数据 409；用户及类目仍在',
    {
      ...publicResult(blocked),
      businessFixture: { table: 'category', id: businessId, count: 1 },
      screenshot: '09-business-data-409-real.png',
    },
  );
  assert.equal(await removeBusiness(db, tenant), 1);
  const wrongQuery = async (route) => {
    const url = new URL(route.request().url());
    url.searchParams.set('confirm', 'wrong');
    await route.continue({ url: url.toString() });
  };
  await page.route('**/api/v1/admin/tenants/' + tenant.id + '?**', wrongQuery);
  const mismatch = await purge();
  await page.unroute(
    '**/api/v1/admin/tenants/' + tenant.id + '?**',
    wrongQuery,
  );
  assert.equal(mismatch.status, 400);
  assert.equal(mismatch.message, '确认码不匹配');
  await modal(page).getByText(mismatch.message, { exact: true }).waitFor();
  await shot('supplement-confirmation-400-real-backend', page);
  report.confirmation400 = {
    source:
      'UI request query overridden to wrong code; response is from the real backend',
    ...publicResult(mismatch),
    screenshot: 'supplement-confirmation-400-real-backend.png',
  };
  const deleted = await purge();
  assert.equal(deleted.status, 204);
  assert.equal(deleted.url.searchParams.get('confirm'), code);
  await row(page, tenant.id).waitFor({ state: 'hidden' });
  await page.getByText('租户已删除', { exact: true }).waitFor();
  await shot('10-deleted-row-gone-real', page);
  assert.equal(
    (
      await db`SELECT count(*)::int AS count FROM tenant WHERE id=${tenant.id}`
    )[0].count,
    0,
  );
  assert.equal(
    (
      await db`SELECT count(*)::int AS count FROM sys_user WHERE tenant_id=${tenant.id}`
    )[0].count,
    0,
  );
  await record(
    10,
    '真实 DELETE 带完全一致 confirm 返回 204；刷新后行消失并提示租户已删除，数据库租户及用户均为零',
    {
      ...publicResult(deleted),
      tenantId: tenant.id,
      screenshot: '10-deleted-row-gone-real.png',
    },
  );
  assert.deepEqual(report.browserErrors, []);
} catch (error) {
  failure = error;
  report.failure = redact(error.stack || error.message);
  await shot('failure-masked', page).catch(() => undefined);
} finally {
  await browser.close();
  try {
    report.cleanup = await cleanup(db, before);
    await writeFile(
      new URL('cleanup.json', output),
      JSON.stringify(report.cleanup, null, 2) + '\n',
    );
  } catch (error) {
    report.cleanupFailure = redact(error.stack || error.message);
    failure ||= error;
  }
  report.finishedAt = new Date().toISOString();
  await persist();
}
if (failure) throw new Error(redact(failure.stack || failure.message));
assert.deepEqual(
  report.checks.map(({ item }) => item).toSorted((a, b) => a - b),
  Array.from({ length: 11 }, (_, index) => index + 1),
);
process.stdout.write(
  'FE-IDN-008: 11 acceptance checks passed; task fixtures cleaned\n',
);

function originForInvite() {
  return process.env.FE_IDN_008_ORIGIN || 'http://127.0.0.1:5666';
}
