import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import process from 'node:process';

import {
  api,
  button,
  cleanup,
  login,
  newPage,
  output,
  request,
  response,
  setup,
  shot,
  summary,
} from './fe-ui-001-support.mjs';

const phase =
  process.argv.find((arg) => arg.startsWith('--phase='))?.slice(8) || 'b';
const state = await setup();
const report = {
  phase,
  source: 'real-18080-and-msedge',
  checks: [],
  limitations: [],
  cleanup: false,
};
try {
  const pair = await login(state.user.username, state.password);
  const other = await login(state.user.username, state.password);
  const { page, errors } = await newPage(state.browser, pair);
  await page.getByLabel('昵称', { exact: true }).waitFor();
  assert.equal(
    await page.getByLabel('用户名', { exact: true }).inputValue(),
    state.user.username,
  );
  assert.equal(
    await page.getByLabel('用户名', { exact: true }).isDisabled(),
    true,
  );
  const me = await api('/auth/me', 'GET', undefined, other.access_token);
  for (const field of ['email', 'phone', 'dept_name', 'tenant_code']) {
    if (!(field in me.user) && !(field in me))
      report.limitations.push('/auth/me omits ' + field);
  }
  assert.equal(
    await page.getByLabel('手机', { exact: true }).isDisabled(),
    true,
  );
  report.checks.push({
    item: 5,
    status: report.limitations.length ? 'partial' : 'pass',
    returnedFields: Object.keys(me.user).sort(),
    missingFields: report.limitations,
    displayedTenant: await page
      .getByLabel('租户', { exact: true })
      .inputValue(),
    displayedDepartment: await page
      .getByLabel('部门', { exact: true })
      .inputValue(),
    phoneReadOnlyBecauseApiDoesNotAcceptPhone: true,
  });
  await shot('05-profile-real', page);
  const nickname = '已保存_' + state.prefix;
  await page.getByLabel('昵称', { exact: true }).fill(nickname);
  const saved = await response(page, '/auth/profile', 'PUT', () =>
    button('保存基本信息', page).click(),
  );
  assert.equal(saved.status, 200);
  await page.reload();
  await page.getByLabel('昵称', { exact: true }).waitFor();
  assert.equal(
    await page.getByLabel('昵称', { exact: true }).inputValue(),
    nickname,
  );
  await shot('06-profile-persisted-real', page);
  report.checks.push({
    item: 6,
    status: 'pass',
    nicknamePersisted: true,
    screenshot: '06-profile-persisted-real.png',
  });
  let passwordRequests = 0;
  page.on('request', (value) => {
    if (value.url().endsWith('/auth/password')) passwordRequests++;
  });
  const fill = async (oldPassword, next, confirmation = next) => {
    await page.getByLabel('旧密码', { exact: true }).fill(oldPassword);
    await page.getByLabel('新密码', { exact: true }).fill(next);
    await page.getByLabel('确认新密码', { exact: true }).fill(confirmation);
  };
  for (const weak of ['Abc1234', 'abcdefgh']) {
    await fill(state.password, weak);
    await button('修改密码', page).click();
    await page
      .getByRole('alert')
      .filter({ hasText: '密码至少 8 个字符' })
      .waitFor();
    assert.equal(passwordRequests, 0);
  }
  await shot('08-password-rule-real', page);
  report.checks.push({
    item: 8,
    status: 'pass',
    passwords: ['7 characters', 'letters only'],
    networkRequests: passwordRequests,
  });
  const nextPassword = 'Next123_' + randomUUID();
  await fill('Wrong12345', nextPassword);
  const rejected = await response(page, '/auth/password', 'PUT', () =>
    button('修改密码', page).click(),
  );
  assert.equal(rejected.status, 401);
  await page
    .getByRole('alert')
    .filter({ hasText: rejected.body.message })
    .waitFor();
  assert.equal(new URL(page.url()).pathname, '/profile');
  await shot('07-wrong-old-password-real', page);
  await fill(state.password, nextPassword);
  const changed = await response(page, '/auth/password', 'PUT', () =>
    button('修改密码', page).click(),
  );
  assert.equal(changed.status, 204);
  await page
    .getByText('密码修改成功，其他设备的登录已失效', { exact: true })
    .waitFor();
  await shot('07-password-success-real', page);
  const revoked = await request(
    '/auth/me',
    'GET',
    undefined,
    other.access_token,
  );
  assert.equal(revoked.status, 401);
  await page.reload();
  await page.getByLabel('昵称', { exact: true }).waitFor();
  assert.equal(new URL(page.url()).pathname, '/profile');
  report.checks.push({
    item: 7,
    status: 'pass',
    wrongOld: summary(rejected),
    changed: changed.status,
    otherSession: summary(revoked),
    currentSessionSurvivesReload: true,
  });
  assert.deepEqual(errors, []);
  report.browserErrors = errors;
  assert.equal(phase, 'b');
} catch (error) {
  report.failure = error.message;
  throw error;
} finally {
  await cleanup(state);
  report.cleanup = true;
  await writeFile(
    new URL('phase-' + phase + '.json', output),
    JSON.stringify(report, null, 2),
  );
  process.stdout.write(JSON.stringify(report) + '\n');
}
