import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

// eslint-disable-next-line n/no-extraneous-import -- Shared test tooling is declared in the workspace root.
import { chromium } from 'playwright';

const origin = process.env.FE1_ORIGIN || 'http://127.0.0.1:5666';
const output = new URL('../docs/evidence/', import.meta.url);
const admin = process.env.FE1_ADMIN_USERNAME || 'admin';
const sales = process.env.FE1_SALES_USERNAME || 'sales01';
assert.ok(process.env.FE1_ADMIN_PASSWORD, 'Set FE1_ADMIN_PASSWORD');
assert.ok(process.env.FE1_SALES_PASSWORD, 'Set FE1_SALES_PASSWORD');
await mkdir(output, { recursive: true });

const checks = [];
const errors = [];
const requests = [];
const responses = [];
const menuResponses = [];
const userResponses = [];
const responseReads = new Set();
let failureInfo;
const browser = await chromium.launch({
  ...(process.env.FE1_CHROME_EXECUTABLE
    ? { executablePath: process.env.FE1_CHROME_EXECUTABLE }
    : process.platform === 'win32'
      ? { channel: 'chrome' }
      : {}),
  headless: true,
});
const context = await browser.newContext({
  locale: 'zh-CN',
  reducedMotion: 'reduce',
  timezoneId: 'Asia/Shanghai',
  viewport: { height: 960, width: 1440 },
});
const page = await context.newPage();
page.on('pageerror', (error) => errors.push(error.message));
page.on('request', (request) => {
  const url = new URL(request.url());
  if (!url.pathname.startsWith('/api/v1/')) return;
  requests.push({
    method: request.method(),
    path: url.pathname,
    query: Object.fromEntries(url.searchParams),
  });
});
page.on('response', (response) => {
  const path = new URL(response.url()).pathname;
  if (!path.startsWith('/api/v1/')) return;
  const read = (async () => {
    const body = response.status() === 204 ? undefined : await response.json();
    responses.push({ code: body?.code, path, status: response.status() });
    if (path === '/api/v1/auth/menus' && body?.code === 0) {
      menuResponses.push({
        username: body.data.user.username,
        roles: body.data.user.roles ?? [],
        permissionCount: body.data.permissions?.length ?? 0,
        menus: (body.data.menus ?? []).map(({ name, path }) => ({
          name,
          path,
        })),
      });
    }
    if (path === '/api/v1/admin/users' && body?.code === 0) {
      userResponses.push({
        page: body.data.page,
        page_size: body.data.page_size,
        total: body.data.total,
        usernames: body.data.list.map((user) => user.username).sort(),
      });
    }
  })().catch((error) => errors.push(`${path}: ${error.message}`));
  responseReads.add(read);
  void read.finally(() => responseReads.delete(read));
});

const refreshCount = () =>
  requests.filter((request) => request.path === '/api/v1/auth/refresh').length;
const userRequestCount = () =>
  requests.filter((request) => request.path === '/api/v1/admin/users').length;
const waitUserRows = async (usernames) => {
  await page.waitForFunction(
    (count) =>
      document.querySelectorAll('tbody tr.ant-table-row').length === count,
    usernames.length,
  );
  for (const username of usernames) {
    await page
      .getByRole('cell', { exact: true, name: username })
      .first()
      .waitFor();
  }
  assert.equal(
    await page.locator('tbody tr.ant-table-row').count(),
    usernames.length,
  );
  if (usernames.length === 0)
    await page.locator('.ant-table-placeholder').waitFor();
};
const waitUsers = () => waitUserRows(['admin', 'sales01', 'sales02']);
const capture = (name) =>
  page.screenshot({
    animations: 'disabled',
    fullPage: true,
    path: fileURLToPath(new URL(name, output)),
  });
const login = async (username, password, waitForHome) => {
  await page.getByPlaceholder('请输入用户名').fill(username);
  await page.getByPlaceholder('密码', { exact: true }).fill(password);
  const response = page.waitForResponse(
    (response) => new URL(response.url()).pathname === '/api/v1/auth/login',
  );
  await page.getByRole('button', { name: 'login', exact: true }).click();
  const result = await response;
  assert.equal(result.status(), 200);
  assert.equal((await result.json()).code, 0);
  await waitForHome();
  await Promise.all([...responseReads]);
};
const logout = () =>
  page.evaluate(async () => {
    const { useAuthStore } = await import('/src/store/auth.ts');
    await useAuthStore().logout(false);
  });
const searchUsers = async (expectedUsernames, filters = {}) => {
  const response = page.waitForResponse(
    (response) => new URL(response.url()).pathname === '/api/v1/admin/users',
  );
  await page.getByRole('button', { name: /查\s*询/ }).click();
  const result = await response;
  assert.equal(result.status(), 200);
  const query = Object.fromEntries(new URL(result.url()).searchParams);
  assert.deepEqual(query, { page: '1', page_size: '20', ...filters });
  const body = await result.json();
  assert.equal(body.code, 0);
  assert.equal(body.data.total, expectedUsernames.length);
  assert.deepEqual(
    body.data.list.map(({ username }) => username).sort(),
    [...expectedUsernames].sort(),
  );
  if (filters.status)
    assert.ok(body.data.list.every(({ status }) => status === filters.status));
  await waitUserRows(expectedUsernames);
  return {
    query,
    total: body.data.total,
    users: body.data.list.map(({ username, status }) => ({ username, status })),
  };
};

try {
  await page.goto(`${origin}/auth/login`);
  await page.getByRole('button', { name: 'login', exact: true }).waitFor();
  await capture('login.png');
  await login(admin, process.env.FE1_ADMIN_PASSWORD, waitUsers);
  assert.equal(new URL(page.url()).pathname, '/system/users');
  const menus = menuResponses.at(-1);
  assert.equal(menus.username, admin);
  assert.equal(menus.permissionCount, 103);
  assert.deepEqual(menus.menus, [
    { name: '系统', path: '/system' },
    { name: '交易', path: '/trade' },
    { name: '客户', path: '/crm' },
  ]);
  for (const { name } of menus.menus) {
    await page.getByText(name, { exact: true }).first().waitFor();
  }
  assert.deepEqual(userResponses.at(-1), {
    page: 1,
    page_size: 20,
    total: 3,
    usernames: ['admin', 'sales01', 'sales02'],
  });
  const storage = await page.evaluate(async () => {
    const { getAccessToken, getRefreshToken } =
      await import('/src/auth/token.ts');
    const access = getAccessToken();
    const refresh = getRefreshToken();
    return {
      accessInMemory: Boolean(access),
      accessPersisted: Boolean(
        access &&
        JSON.stringify({ ...localStorage, ...sessionStorage }).includes(access),
      ),
      refreshInLocal: Boolean(
        refresh && JSON.stringify({ ...localStorage }).includes(refresh),
      ),
      refreshInSession: Boolean(
        refresh && Object.values(sessionStorage).includes(refresh),
      ),
    };
  });
  assert.deepEqual(storage, {
    accessInMemory: true,
    accessPersisted: false,
    refreshInLocal: false,
    refreshInSession: true,
  });
  checks.push({
    name: 'admin-login-menus-users',
    menus: menus.menus,
    permissionCount: menus.permissionCount,
    users: userResponses.at(-1),
    storage,
  });
  await capture('users.png');

  await page.getByLabel('关键词', { exact: true }).fill('sales');
  checks.push({
    name: 'keyword-sales',
    ...(await searchUsers(['sales01', 'sales02'], { keyword: 'sales' })),
  });
  await capture('search-sales.png');
  await page.getByLabel('关键词', { exact: true }).fill('sales01');
  checks.push({
    name: 'keyword-sales01',
    ...(await searchUsers(['sales01'], { keyword: 'sales01' })),
  });
  await capture('search-sales01.png');
  await page.getByLabel('关键词', { exact: true }).fill('');
  await page.getByLabel('状态', { exact: true }).press('ArrowDown');
  await page
    .locator('.ant-select-dropdown')
    .getByText('停用', { exact: true })
    .click();
  checks.push({
    name: 'status-disabled',
    ...(await searchUsers([], { status: 'disabled' })),
  });
  await capture('status-disabled.png');
  await page.getByLabel('关键词', { exact: true }).fill('sales');
  await page.getByLabel('状态', { exact: true }).press('ArrowDown');
  await page
    .locator('.ant-select-dropdown')
    .getByText('启用', { exact: true })
    .click();
  checks.push({
    name: 'keyword-and-status',
    ...(await searchUsers(['sales01', 'sales02'], {
      keyword: 'sales',
      status: 'active',
    })),
  });
  const resetResponse = page.waitForResponse(
    (response) => new URL(response.url()).pathname === '/api/v1/admin/users',
  );
  await page.getByRole('button', { name: /重\s*置/ }).click();
  const resetResult = await resetResponse;
  assert.equal(resetResult.status(), 200);
  assert.deepEqual(
    Object.fromEntries(new URL(resetResult.url()).searchParams),
    { page: '1', page_size: '20' },
  );
  await waitUsers();
  checks.push({ name: 'reset-filters', visibleUsers: 3 });

  const beforeReload = refreshCount();
  await page.reload();
  await waitUsers();
  assert.equal(refreshCount() - beforeReload, 1);
  checks.push({ name: 'reload-restores-admin', refreshRequests: 1 });

  const beforeRestore = refreshCount();
  const restored = await page.evaluate(async () => {
    const token = await import('/src/auth/token.ts');
    const { useAuthStore } = await import('/src/store/auth.ts');
    const { requestClient } = await import('/src/api/request.ts');
    const refresh = token.getRefreshToken();
    if (!refresh) throw new Error('Missing live refresh credential');
    // Reproduce loss of memory credentials while retaining the real refresh credential.
    token.clearTokens();
    sessionStorage.setItem(token.REFRESH_TOKEN_KEY, refresh);
    const sessions = await Promise.all(
      Array.from({ length: 5 }, () => useAuthStore().restoreSession()),
    );
    const users = await Promise.all(
      Array.from(
        { length: 5 },
        async () => (await requestClient.get('/auth/me')).user.username,
      ),
    );
    return { sessions, users };
  });
  assert.deepEqual(restored, {
    sessions: Array(5).fill(true),
    users: Array(5).fill(admin),
  });
  assert.equal(refreshCount() - beforeRestore, 1);
  checks.push({
    name: 'five-concurrent-session-restorations',
    refreshRequests: 1,
    successfulReads: 5,
  });

  const beforeConcurrent = refreshCount();
  const concurrent = await page.evaluate(async () => {
    const { refreshAccessToken } = await import('/src/auth/refresh.ts');
    const { requestClient } = await import('/src/api/request.ts');
    const operations = Array.from({ length: 5 }, () => refreshAccessToken());
    const sharedPromise = operations.every(
      (operation) => operation === operations[0],
    );
    await Promise.all(operations);
    const users = await Promise.all(
      Array.from(
        { length: 5 },
        async () => (await requestClient.get('/auth/me')).user.username,
      ),
    );
    return { sharedPromise, users };
  });
  assert.deepEqual(concurrent, {
    sharedPromise: true,
    users: Array(5).fill(admin),
  });
  assert.equal(refreshCount() - beforeConcurrent, 1);
  checks.push({
    name: 'five-concurrent-refreshes',
    refreshRequests: 1,
    sharedPromise: true,
    successfulReads: 5,
  });

  await logout();
  await page.getByRole('button', { name: 'login', exact: true }).waitFor();
  const beforeSales = userRequestCount();
  const waitSales = () =>
    page.getByText('暂无可用菜单', { exact: true }).waitFor();
  await login(sales, process.env.FE1_SALES_PASSWORD, waitSales);
  assert.equal(new URL(page.url()).pathname, '/home');
  assert.deepEqual(menuResponses.at(-1), {
    username: sales,
    roles: [],
    permissionCount: 0,
    menus: [],
  });
  for (const label of ['系统', '交易', '客户']) {
    assert.equal(await page.getByText(label, { exact: true }).count(), 0);
  }
  assert.equal(userRequestCount(), beforeSales);
  const beforeSalesReload = refreshCount();
  await page.reload();
  await waitSales();
  assert.equal(refreshCount() - beforeSalesReload, 1);
  assert.equal(userRequestCount(), beforeSales);
  assert.equal(await page.locator('.ant-message-error').count(), 0);
  await capture('sales01.png');
  checks.push({
    name: 'sales01-empty-menus-and-reload',
    userRequests: 0,
    refreshRequests: 1,
  });
  await Promise.all([...responseReads]);
  assert.deepEqual(errors, []);
  assert.ok(responses.every((response) => response.status < 400));
  console.log(
    JSON.stringify({ checks, errors, apiRequests: requests.length }, null, 2),
  );
} catch (failure) {
  failureInfo = { message: failure.message, url: page.url() };
  throw failure;
} finally {
  await capture('final-state.png').catch(() => {});
  await logout().catch(() => {});
  await Promise.all([...responseReads]);
  await writeFile(
    new URL('browser-results.json', output),
    JSON.stringify(
      {
        source: 'live backend through the development /api proxy',
        origin,
        checks,
        errors,
        failure: failureInfo,
        requests,
        responses,
        menuResponses,
        userResponses,
      },
      null,
      2,
    ),
  );
  await browser.close();
}
