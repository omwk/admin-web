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
  fillRegistration,
  login,
  network,
  newPage,
  openEmptyTenantRegistration,
  origin,
  output,
  redact,
  register,
  response,
  secrets,
  session,
  settings,
  setup,
  shot,
  summary,
  verify,
} from './fe-idn-002-support.mjs';

const acceptedText = '如果信息有效，我们已向你的邮箱发送验证邮件，请查收。';
const prefix = 'reg_' + Date.now();
const password = 'Reg@' + randomBytes(16).toString('hex');
secrets.add(password);
const { browser, auth } = await setup();
const admin = await newPage(browser);
const page = await newPage(browser);
const cleanup = [];
let original;
let role;
let userId;
let tenantId;
let templateId;
let failure;
const user = {
  tenant: 'default',
  account: prefix,
  email: prefix + '@example.test',
};
const field = (group, key) => group.locator('[data-setting-key="' + key + '"]');
const values = (group) =>
  Object.fromEntries(
    group.items.map(({ schema, value }) => [schema.key, value]),
  );
try {
  original = values(await api('/admin/settings/tenant'));
  await session(admin, auth);
  let group = await settings(admin);
  const source = await api('/admin/settings/tenant');
  assert.equal(await group.locator('[data-setting-key]').count(), 3);
  for (const { schema, value } of source.items) {
    const row = field(group, schema.key);
    assert.ok((await row.innerText()).includes(JSON.stringify(schema.default)));
    assert.equal(schema.hot_reload, true);
    if (schema.type === 'boolean')
      assert.equal(
        await row.getByRole('switch').getAttribute('aria-checked'),
        String(value),
      );
    if (schema.type === 'number')
      assert.equal(await row.locator('input').inputValue(), String(value));
    if (schema.type === 'string')
      assert.ok(
        (await row.innerText()).includes(value || '无角色（最小权限）'),
      );
  }
  await shot('01-settings-values-real', admin);
  check(1, '三项表单值、默认值和热生效说明与真实租户设置一致', {
    values: values(source),
    defaults: Object.fromEntries(
      source.items.map(({ schema }) => [schema.key, schema.default]),
    ),
    screenshot: '01-settings-values-real.png',
  });

  await api('/admin/settings/tenant', 'PUT', {
    allow_self_registration: false,
  });
  group = await settings(admin);
  assert.equal(
    await field(group, 'default_role_code').getByRole('combobox').isDisabled(),
    true,
  );
  assert.equal(
    await field(group, 'registration_hourly_limit')
      .locator('input')
      .isDisabled(),
    true,
  );
  await shot('02-settings-closed-real', admin);
  check(2, '注册开关关闭时角色与上限均禁用', {
    roleDisabled: true,
    limitDisabled: true,
    screenshot: '02-settings-closed-real.png',
  });

  role = await api('/admin/roles', 'POST', {
    code: prefix,
    name: '注册验收最小权限',
    data_scope: 'self',
    remark: null,
    status: 'active',
  });
  await admin.reload();
  group = await settings(admin);
  await field(group, 'allow_self_registration').getByRole('switch').click();
  await field(group, 'default_role_code')
    .locator('.ant-select-selector')
    .click();
  await admin
    .locator('.ant-select-item-option')
    .filter({ hasText: '注册验收最小权限（' + prefix + '）' })
    .click();
  await field(group, 'registration_hourly_limit')
    .locator('input')
    .fill('10000');
  await field(group, 'registration_hourly_limit').locator('input').blur();
  const saved = await response(admin, '/admin/settings/tenant', 'PUT', () =>
    button('保存配置', group).click(),
  );
  assert.equal(saved.status, 200);
  await admin.getByText('已生效', { exact: true }).waitFor();
  await admin.reload();
  group = await settings(admin);
  assert.equal(
    await field(group, 'allow_self_registration')
      .getByRole('switch')
      .getAttribute('aria-checked'),
    'true',
  );
  assert.equal(
    await field(group, 'registration_hourly_limit')
      .locator('input')
      .inputValue(),
    '10000',
  );
  const persisted = values(await api('/admin/settings/tenant'));
  assert.deepEqual(persisted, {
    allow_self_registration: true,
    default_role_code: prefix,
    registration_hourly_limit: 10000,
  });
  await shot('03-settings-persisted-real', admin);
  check(3, '真实 PUT 保存、已生效提示、刷新和 GET 均确认三项持久化', {
    status: saved.status,
    input: saved.input,
    persisted,
    screenshot: '03-settings-persisted-real.png',
  });
  const risks = [
    '开启后，任何知道本企业代码的人都可以注册账号。',
    '新用户需要完成邮箱验证才能登录。',
    '非首位用户将获得「默认角色」的权限——请确认它不是高权限角色。',
  ];
  for (const text of risks)
    await group.getByText(text, { exact: true }).waitFor();
  check(4, '开关下方显示完整三条风险提示', {
    risks,
    screenshot: '03-settings-persisted-real.png',
  });

  await page.goto(origin + '/auth/login?tenant=default');
  const beforeEntry = network.publicRequests.length;
  await page.getByLabel('企业代码', { exact: true }).fill('manual_code');
  await page.getByRole('link', { name: '在此注册', exact: true }).click();
  await page.waitForURL('**/auth/register?tenant=manual_code');
  await page.getByRole('heading', { name: '注册账号', exact: true }).waitFor();
  assert.equal(
    await page.getByLabel('企业代码', { exact: true }).inputValue(),
    'manual_code',
  );
  assert.equal(
    await page.getByLabel('企业代码', { exact: true }).getAttribute('readonly'),
    '',
  );
  assert.equal(network.publicRequests.length, beforeEntry);
  await shot('login-registration-entry-real', page);

  let posts = network.publicRequests.filter((item) =>
    item.path.endsWith('/register'),
  ).length;
  for (const weak of ['Abc1234', 'abcdefgh']) {
    await fillRegistration(page, user, weak);
    await button('注册', page).click();
    await page
      .getByText('密码至少 8 个字符，包含字母和数字，且不超过 72 字节', {
        exact: true,
      })
      .waitFor();
    assert.equal(
      network.publicRequests.filter((item) => item.path.endsWith('/register'))
        .length,
      posts,
    );
  }
  await shot('11-password-validation-real', page);
  check(11, '少于八位及纯字母密码均由前端拦截，没有注册请求', {
    invalid: ['7 characters', 'letters only'],
    requests: 0,
    screenshot: '11-password-validation-real.png',
  });

  const first = await register(page, user, password);
  assert.equal(first.status, 201);
  assert.equal(first.data.accepted, true);
  await page.getByText(acceptedText, { exact: true }).waitFor();
  const firstText = await page.locator('.ant-result').innerText();
  assert.ok(!firstText.includes('已存在'));
  await shot('05-register-first-real', page);
  check(5, '首次真实 201 仅显示统一邮件提示', {
    ...summary(first),
    displayed: acceptedText,
    screenshot: '05-register-first-real.png',
  });
  userId = (
    await api('/admin/users?page_size=100&keyword=' + user.account)
  ).list.find((item) => item.username === user.account)?.id;
  assert.ok(userId, 'Find the temporary registered account for cleanup');
  const duplicate = await register(page, user, password);
  assert.equal(duplicate.status, 202);
  await page.getByText(acceptedText, { exact: true }).waitFor();
  assert.equal(await page.locator('.ant-result').innerText(), firstText);
  await shot('06-register-duplicate-real', page);
  check(6, '同账号再次提交返回 202，结果区与首次逐字一致', {
    ...summary(duplicate),
    identicalResult: true,
    screenshot: '06-register-duplicate-real.png',
  });

  const pending = await login(page, user, password);
  assert.equal(pending.status, 403);
  assert.equal(pending.code, 20_111);
  await page.getByText('请先完成邮箱验证', { exact: true }).waitFor();
  await shot('09-pending-login-real', page);

  await api('/admin/settings/tenant', 'PUT', {
    allow_self_registration: false,
  });
  const closed = await register(page, user, password);
  assert.equal(closed.status, 403);
  assert.equal(closed.code, 20_111);
  await page
    .getByRole('alert')
    .filter({ hasText: '该企业未开放自助注册' })
    .waitFor();
  await shot('07-registration-closed-real', page);
  check(7, '关闭后注册显示该企业未开放自助注册', {
    ...summary(closed),
    screenshot: '07-registration-closed-real.png',
  });
  await api('/admin/settings/tenant', 'PUT', {
    allow_self_registration: true,
    registration_hourly_limit: 1,
  });
  const limited = await register(page, user, password);
  assert.equal(limited.status, 429);
  assert.equal(limited.code, 10_005);
  await page
    .getByRole('alert')
    .filter({ hasText: '注册过于频繁，请稍后再试' })
    .waitFor();
  await shot('registration-limit-real', page);
  await api('/admin/settings/tenant', 'PUT', {
    registration_hourly_limit: 10000,
  });
  const unknown = await register(
    page,
    { ...user, tenant: prefix + '_unknown' },
    password,
  );
  assert.equal(unknown.status, 401);
  await page
    .getByRole('alert')
    .filter({ hasText: '企业代码、账号或密码错误' })
    .waitFor();
  await shot('registration-unknown-real', page);

  const stale = await verify(page, first.data.dev_verify_url);
  assert.equal(stale.status, 400);
  await page.getByText('链接无效或已过期', { exact: true }).waitFor();
  const activated = await verify(page, duplicate.data.dev_verify_url);
  assert.equal(activated.status, 204);
  await page.getByText('邮箱已验证，现在可以登录了', { exact: true }).waitFor();
  await page.getByRole('link', { name: '登录', exact: true }).waitFor();
  await shot('08-verify-success-real', page);
  const used = await verify(page, duplicate.data.dev_verify_url);
  assert.equal(used.status, 400);
  await page.getByText('链接无效或已过期', { exact: true }).waitFor();
  await page.getByRole('link', { name: '重新注册', exact: true }).waitFor();
  await shot('08-verify-invalid-real', page);
  check(8, '有效 token 返回 204；重发撤销及已用 token 均为统一失败页', {
    valid: summary(activated),
    revoked: summary(stale),
    reused: summary(used),
    queryTokenSupported: true,
    screenshots: ['08-verify-success-real.png', '08-verify-invalid-real.png'],
  });
  const active = await login(page, user, password);
  assert.equal(active.status, 200);
  await page.waitForURL('**/home');
  const me = await api('/auth/me', 'GET', undefined, active.data.access_token);
  assert.equal(me.user.is_super, false);
  assert.ok(me.user.roles.some((item) => item.code === prefix));
  await shot('09-verified-login-real', page);
  check(9, '未验证登录被拒并提示，验证后登录进入首页并获得配置的最小权限角色', {
    pending: summary(pending),
    verifiedStatus: active.status,
    isSuper: me.user.is_super,
    roles: me.user.roles.map((item) => item.code),
    screenshots: ['09-pending-login-real.png', '09-verified-login-real.png'],
  });

  let tenantCode = prefix;
  if (process.env.FE_IDN_002_REUSE_TENANT_ID) {
    tenantId = Number(process.env.FE_IDN_002_REUSE_TENANT_ID);
    const reused = await api('/admin/tenants/' + tenantId);
    assert.ok(reused.code.startsWith('reg_'));
    tenantCode = reused.code;
    templateId = reused.provisioned_from;
    await api('/admin/tenants/' + tenantId + '/enable', 'POST');
  } else {
    const template = await api('/admin/tenant-templates', 'POST', {
      source_tenant_id: 1,
      code: prefix,
      name: '注册首用户验收模板',
      description: 'FE-IDN-002 isolated acceptance',
    });
    templateId = template.id;
    const provisioned = await api('/admin/tenants', 'POST', {
      code: prefix,
      name: '注册首用户验收租户',
      template_id: templateId,
      admin_username: prefix + '_reserved',
    });
    tenantId = provisioned.tenant_id;
  }
  const empty = await api(
    '/admin/tenants/' + tenantId + '/members?page_size=100',
  );
  assert.equal(empty.list.filter((item) => item.status === 'active').length, 0);
  openEmptyTenantRegistration(tenantId, tenantCode);
  const firstUser = {
    tenant: tenantCode,
    account: prefix + '_first',
    email: prefix + '_first@example.test',
  };
  const firstPage = await newPage(browser);
  const electedRegistration = await register(firstPage, firstUser, password);
  assert.equal(electedRegistration.status, 201);
  const beforeVerify = (
    await api('/admin/tenants/' + tenantId + '/members?page_size=100')
  ).list.find((item) => item.account === firstUser.account);
  assert.equal(beforeVerify.is_super, false);
  assert.equal(beforeVerify.status, 'disabled');
  const electedVerification = await verify(
    firstPage,
    electedRegistration.data.dev_verify_url,
    true,
  );
  assert.equal(electedVerification.status, 204);
  await firstPage
    .getByText('邮箱已验证，现在可以登录了', { exact: true })
    .waitFor();
  const electedLogin = await login(firstPage, firstUser, password);
  assert.equal(electedLogin.status, 200);
  await firstPage.waitForURL('**/home');
  const elected = await api(
    '/auth/me',
    'GET',
    undefined,
    electedLogin.data.access_token,
  );
  assert.equal(elected.user.is_super, true);
  await shot('10-first-user-super-real', firstPage);
  check(
    10,
    '无活跃用户的新租户，首个注册者验证前无超管权限，验证后登录为超管',
    {
      tenantId,
      activeUsersBefore: 0,
      reservedInactiveAdmin: empty.list.length,
      beforeVerify: {
        status: beforeVerify.status,
        isSuper: beforeVerify.is_super,
      },
      verifyStatus: electedVerification.status,
      afterVerify: {
        isSuper: elected.user.is_super,
        tenantCode: elected.tenant_code,
      },
      backendFragmentSupported: true,
      screenshot: '10-first-user-super-real.png',
    },
  );
  checks.push({
    item: 'extra',
    result: 'pass',
    unknown: summary(unknown),
    limited: summary(limited),
    entryCarriesCurrentTenant: true,
    discoveryRequests: network.discoveryRequests,
  });
  assert.deepEqual(browserErrors, []);
  assert.deepEqual(network.discoveryRequests, []);
} catch (error) {
  failure = { message: redact(error.message), stack: redact(error.stack) };
  await shot('failure', page).catch(() => {});
} finally {
  await browser.close();
  async function clean(name, action) {
    try {
      await action();
      cleanup.push({ name, result: 'pass' });
    } catch (error) {
      cleanup.push({ name, result: 'failed', message: redact(error.message) });
    }
  }
  if (original)
    await clean('restore original tenant settings', () =>
      api('/admin/settings/tenant', 'PUT', original),
    );
  if (userId)
    await clean('remove temporary registered user', async () => {
      await api('/admin/users/' + userId + '/roles', 'PUT', { role_ids: [] });
      await api('/admin/users/' + userId, 'DELETE');
    });
  if (role)
    await clean('remove temporary default role', () =>
      api('/admin/roles/' + role.id, 'DELETE'),
    );
  if (tenantId)
    await clean('suspend isolated first-user tenant', () =>
      api('/admin/tenants/' + tenantId + '/disable', 'POST'),
    );
  else if (templateId)
    await clean('remove unused template', () =>
      api('/admin/tenant-templates/' + templateId, 'DELETE'),
    );
  await writeFile(
    new URL('acceptance.json', output),
    JSON.stringify(
      {
        task: 'FE-IDN-002',
        source: 'real-18080-and-msedge',
        date: new Date().toISOString(),
        checks: checks.toSorted((a, b) => Number(a.item) - Number(b.item)),
        browserErrors,
        network,
        cleanup,
        retained: tenantId
          ? {
              tenantId,
              templateId,
              status: 'suspended',
              reason:
                'Backend has no tenant deletion API; referenced template retained.',
            }
          : null,
        ...(failure ? { failure } : {}),
      },
      null,
      2,
    ),
  );
}
assert.ok(!failure, failure?.message);
assert.ok(
  cleanup.every((item) => item.result === 'pass'),
  'All cleanup operations passed',
);
assert.equal(checks.filter((item) => typeof item.item === 'number').length, 11);
process.stdout.write(
  JSON.stringify({ passed: 11, browserErrors: browserErrors.length, cleanup }) +
    '\n',
);
