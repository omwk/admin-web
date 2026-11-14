import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import process from 'node:process';
import { setTimeout } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

// eslint-disable-next-line n/no-extraneous-import -- Workspace browser test tooling.
import { chromium } from 'playwright';

const origin = process.env.FE_IDN_003_ORIGIN || 'http://127.0.0.1:5670';
const backend = process.env.FE_IDN_003_BACKEND || 'http://127.0.0.1:18080';
const output = new URL('../../../docs/evidence/fe-idn-003/', import.meta.url);
const secrets = new Set();
const report = {
  source: 'real-backend-and-msedge',
  origin,
  backend,
  timezone: 'Asia/Shanghai',
  checks: [],
  requests: [],
  browserErrors: [],
  cleanup: [],
};
let browser;
let page;
let admin;
let user;
let failure;
const redact = (value) => {
  let text = String(value);
  for (const secret of secrets)
    if (secret) text = text.replaceAll(secret, '[REDACTED]');
  return text;
};
const summary = ({ status, body }) => ({
  status,
  code: body.code,
  traceId: body.trace_id,
});
async function request(path, method = 'GET', input, token) {
  const result = await fetch(backend + '/api/v1' + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    ...(input === undefined ? {} : { body: JSON.stringify(input) }),
  });
  const body = result.status === 204 ? {} : await result.json();
  for (const key of ['access_token', 'refresh_token'])
    if (body.data?.[key]) secrets.add(body.data[key]);
  return { status: result.status, body, data: body.data };
}
async function api(path, method = 'GET', input, token) {
  let result = await request(path, method, input, token);
  for (let attempt = 0; result.status === 429 && attempt < 3; attempt++) {
    await setTimeout(60_000);
    result = await request(path, method, input, token);
  }
  assert.ok(
    result.status >= 200 && result.status < 300,
    method +
      ' ' +
      path.replace(/\/sessions\/.+/, '/sessions/[sid]') +
      ': ' +
      JSON.stringify(summary(result)),
  );
  return result.data;
}
const login = (account, password) =>
  api('/auth/login', 'POST', { tenant: 'default', account, password });
const button = (name, root = page) =>
  root.getByRole('button', {
    name: new RegExp('^' + [...name].join('\\s*') + '$'),
  });
const rows = () =>
  page.getByTestId('my-sessions').locator('tbody tr[data-row-key]');
async function expectRows(count) {
  await page.waitForFunction(
    (expected) =>
      document.querySelectorAll(
        '[data-testid="my-sessions"] tbody tr[data-row-key]',
      ).length === expected,
    count,
  );
  assert.equal(await rows().count(), count);
}
async function shot(name) {
  await page.screenshot({
    path: fileURLToPath(new URL(name + '.png', output)),
    fullPage: true,
    animations: 'disabled',
    mask: [page.locator('input[type="password"]')],
  });
}
async function response(path, method, action) {
  const pending = page.waitForResponse(
    (value) =>
      new URL(value.url()).pathname === '/api/v1' + path &&
      value.request().method() === method,
  );
  await action();
  const result = await pending;
  const body = result.status() === 204 ? {} : await result.json();
  return { status: result.status(), body, data: body.data };
}
const writeRequests = () =>
  report.requests.filter(({ method }) => ['DELETE', 'POST'].includes(method));
const check = (item, assertion, evidence) =>
  report.checks.push({ item, status: 'pass', assertion, ...evidence });

await mkdir(output, { recursive: true });
try {
  const adminPassword = process.env.FE_IDN_003_ADMIN_PASSWORD;
  assert.ok(adminPassword, 'Set FE_IDN_003_ADMIN_PASSWORD');
  secrets.add(adminPassword);
  admin = await login('admin', adminPassword);
  const prefix = 'ses_' + randomUUID().slice(0, 8);
  const initialPassword = 'Init123_' + randomUUID();
  const password = 'Pass123_' + randomUUID();
  secrets.add(initialPassword);
  secrets.add(password);
  user = await api(
    '/admin/users',
    'POST',
    {
      username: prefix,
      nickname: '会话模式验收',
      dept_id: 1,
      status: 'active',
      password: initialPassword,
    },
    admin.access_token,
  );
  report.testUser = { id: user.id, username: user.username };
  const initial = await login(user.username, initialPassword);
  await api(
    '/auth/password',
    'PUT',
    {
      oldPassword: initialPassword,
      newPassword: password,
    },
    initial.access_token,
  );
  await api('/auth/logout', 'POST', undefined, initial.access_token);
  const current = await login(user.username, password);
  const firstOther = await login(user.username, password);
  const secondOther = await login(user.username, password);
  const before = await api(
    '/auth/sessions',
    'GET',
    undefined,
    current.access_token,
  );
  assert.equal(before.total, 3);
  assert.equal(before.list.filter(({ current }) => current).length, 1);
  assert.ok(before.list.every(({ current }) => typeof current === 'boolean'));
  const firstOtherSid = (
    await api('/auth/sessions', 'GET', undefined, firstOther.access_token)
  ).list.find(({ current }) => current).sid;

  browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
  });
  page = await context.newPage();
  page.on('pageerror', (error) =>
    report.browserErrors.push(redact(error.message)),
  );
  page.on('response', (value) => {
    const path = new URL(value.url()).pathname;
    if (path.startsWith('/api/v1/auth/'))
      report.requests.push({
        method: value.request().method(),
        path: path.replace(/\/sessions\/.+/, '/sessions/[sid]'),
        status: value.status(),
      });
  });
  await page.goto(origin + '/auth/login');
  await page.getByLabel('企业代码', { exact: true }).waitFor();
  await page.evaluate(
    (refresh) => sessionStorage.setItem('vben-web-antd:refresh_token', refresh),
    current.refresh_token,
  );
  await page.goto(origin + '/profile/sessions');
  await expectRows(3);
  assert.equal(await button('下线其他设备').isDisabled(), false);
  await shot('01-multiple-sessions-real');
  check(1, '顶部下线其他设备按钮在三条本人会话时可用', {
    serverTotal: before.total,
    visibleRows: 3,
    buttonEnabled: true,
    screenshot: '01-multiple-sessions-real.png',
  });
  const currentRow = rows().filter({
    has: page.getByText('当前设备', { exact: true }),
  });
  assert.equal(await currentRow.count(), 1);
  assert.equal(await button('下线', currentRow).count(), 0);
  assert.equal(await button('下线').count(), 2);
  check(2, 'current=true 行显示当前设备且无下线按钮，其他两行可下线', {
    currentRows: 1,
    currentRowLogoutButtons: 0,
    otherRowLogoutButtons: 2,
    serverCurrentFlagsPresent: true,
    screenshot: '01-multiple-sessions-real.png',
  });

  const targetRow = page.locator('tr[data-row-key="' + firstOtherSid + '"]');
  await button('下线', targetRow).click();
  let dialog = page.getByRole('dialog');
  await dialog
    .getByText('将下线该会话，当前设备将保持登录，确定？', { exact: true })
    .waitFor();
  const writesBeforeCancel = writeRequests().length;
  await button('取消', dialog).click();
  assert.equal(writeRequests().length, writesBeforeCancel);
  await button('下线', targetRow).click();
  dialog = page.getByRole('dialog');
  await shot('03-single-confirm-real');
  const single = await response(
    '/auth/sessions/' + firstOtherSid,
    'DELETE',
    () => button('确认下线会话', dialog).click(),
  );
  assert.equal(single.status, 204);
  await expectRows(2);
  assert.equal(await targetRow.count(), 0);
  const currentAfterSingle = await request(
    '/auth/me',
    'GET',
    undefined,
    current.access_token,
  );
  const revokedSingle = await request(
    '/auth/me',
    'GET',
    undefined,
    firstOther.access_token,
  );
  assert.equal(currentAfterSingle.status, 200);
  assert.equal(revokedSingle.status, 401);
  assert.equal(
    (await request('/auth/me', 'GET', undefined, secondOther.access_token))
      .status,
    200,
  );
  await shot('03-single-complete-real');
  check(3, '单条撤销后目标行消失、目标令牌失效，当前及另一个会话仍可用', {
    cancelSentNoWrite: true,
    delete: summary(single),
    remainingRows: 2,
    currentMe: summary(currentAfterSingle),
    revokedMe: summary(revokedSingle),
    screenshot: '03-single-complete-real.png',
  });

  const thirdOther = await login(user.username, password);
  await button('刷新').click();
  await expectRows(3);
  await button('下线其他设备').click();
  dialog = page.getByRole('dialog');
  await dialog
    .getByText('将下线除当前设备外的 2 个会话，确定？', { exact: true })
    .waitFor();
  const beforeOthersCancel = writeRequests().length;
  await button('取消', dialog).click();
  assert.equal(writeRequests().length, beforeOthersCancel);
  assert.equal(
    (await request('/auth/me', 'GET', undefined, secondOther.access_token))
      .status,
    200,
  );
  await button('下线其他设备').click();
  dialog = page.getByRole('dialog');
  await shot('04-others-confirm-real');
  const others = await response('/auth/logout-others', 'POST', () =>
    button('确认下线其他设备', dialog).click(),
  );
  assert.equal(others.status, 200);
  assert.equal(others.data.revoked, 2);
  await expectRows(1);
  await page.getByText('已下线 2 个会话', { exact: true }).waitFor();
  const currentAfterOthers = await request(
    '/auth/me',
    'GET',
    undefined,
    current.access_token,
  );
  assert.equal(currentAfterOthers.status, 200);
  const revokedOthers = await Promise.all(
    [secondOther, thirdOther].map((pair) =>
      request('/auth/me', 'GET', undefined, pair.access_token),
    ),
  );
  assert.ok(revokedOthers.every(({ status }) => status === 401));
  await shot('04-others-complete-real');
  await page.reload();
  await expectRows(1);
  assert.equal(await currentRow.count(), 1);
  check(4, '确认下线其他后仅剩当前一条，实际撤销2条，当前访问及刷新仍有效', {
    cancelSentNoWrite: true,
    confirmationCount: 2,
    logoutOthers: summary(others),
    revoked: others.data.revoked,
    toast: '已下线 2 个会话',
    remainingRows: 1,
    currentMe: summary(currentAfterOthers),
    otherMe: revokedOthers.map(summary),
    reloadWithRefreshTokenSucceeded: true,
    screenshots: ['04-others-confirm-real.png', '04-others-complete-real.png'],
  });

  assert.equal(await button('下线其他设备').isDisabled(), true);
  const beforeDisabledClick = writeRequests().length;
  await button('下线其他设备').evaluate((element) => element.click());
  assert.equal(writeRequests().length, beforeDisabledClick);
  const repeated = await request(
    '/auth/logout-others',
    'POST',
    undefined,
    current.access_token,
  );
  assert.equal(repeated.status, 200);
  assert.equal(repeated.data.revoked, 0);
  await shot('05-single-disabled-real');
  check(5, '仅剩当前会话时按钮禁用且不发请求，重复API调用返回revoked=0', {
    buttonDisabled: true,
    disabledClickSentNoWrite: true,
    repeated: summary(repeated),
    revoked: repeated.data.revoked,
    screenshot: '05-single-disabled-real.png',
  });

  await button('全部下线').click();
  dialog = page.getByRole('dialog');
  await dialog.getByText(/当前设备也将退出登录/).waitFor();
  await button('取消', dialog).click();
  assert.equal(
    (await request('/auth/me', 'GET', undefined, current.access_token)).status,
    200,
  );
  await button('全部下线').click();
  dialog = page.getByRole('dialog');
  await shot('06-all-confirm-real');
  const all = await response('/auth/logout-all', 'POST', () =>
    button('确认全部下线', dialog).click(),
  );
  assert.equal(all.status, 204);
  await page.waitForURL((url) => url.pathname === '/auth/login');
  await page.getByLabel('企业代码', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => sessionStorage.length), 0);
  const currentAfterAll = await request(
    '/auth/me',
    'GET',
    undefined,
    current.access_token,
  );
  assert.equal(currentAfterAll.status, 401);
  await shot('06-all-login-real');
  check(6, '全部下线保留原确认与重定向语义，清空本地会话并返回登录页', {
    cancelRetainsCurrentSession: true,
    logoutAll: summary(all),
    destination: '/auth/login',
    sessionStorageEntries: 0,
    currentMe: summary(currentAfterAll),
    screenshot: '06-all-login-real.png',
  });
  assert.deepEqual(report.browserErrors, []);
} catch (error) {
  failure = error;
  report.failure = redact(error.message);
  if (page)
    await shot('failure-real').catch((screenshotError) => {
      report.screenshotFailure = redact(screenshotError.message);
    });
} finally {
  if (browser) await browser.close();
  if (user && admin) {
    try {
      const deleted = await request(
        '/admin/users/' + user.id,
        'DELETE',
        undefined,
        admin.access_token,
      );
      assert.equal(deleted.status, 204);
      const absent = await request(
        '/admin/users/' + user.id,
        'GET',
        undefined,
        admin.access_token,
      );
      assert.equal(absent.status, 404);
      report.cleanup.push({
        action: 'delete-temporary-user',
        ...summary(deleted),
        subsequentGet: summary(absent),
      });
    } catch (error) {
      report.cleanup.push({
        action: 'delete-temporary-user',
        failure: redact(error.message),
      });
      failure ||= error;
    }
  }
  if (admin) {
    try {
      const loggedOut = await request(
        '/auth/logout',
        'POST',
        undefined,
        admin.access_token,
      );
      assert.equal(loggedOut.status, 204);
      report.cleanup.push({
        action: 'logout-test-admin-session',
        ...summary(loggedOut),
      });
    } catch (error) {
      report.cleanup.push({
        action: 'logout-test-admin-session',
        failure: redact(error.message),
      });
      failure ||= error;
    }
  }
  await writeFile(
    new URL('acceptance.json', output),
    JSON.stringify(report, null, 2) + '\n',
  );
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
}
if (failure) process.exitCode = 1;
