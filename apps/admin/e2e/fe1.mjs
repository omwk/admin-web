import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import process from 'node:process';

// eslint-disable-next-line n/no-extraneous-import -- Shared test tooling is declared in the workspace root.
import { chromium } from 'playwright';

// Contract fixtures exercise the running application. They are not a backend
// implementation and must never be reported as real-account integration proof.
const origin = process.env.FE1_ORIGIN || 'http://127.0.0.1:5173';
const output = new URL('../docs/evidence/', import.meta.url);
await mkdir(output, { recursive: true });
const checks = [];
const errors = [];
const requests = [];
let version = 1;
let expired = false;
let revoked = false;
let busyRefresh = 0;
let refreshCalls = 0;
let includeRoles = true;
let createPermission = false;
let nextError;
const tokens = () => ({
  access_token: `fixture-access-${version}`,
  expires_in: 900,
  refresh_token: `fixture-refresh-${version}`,
  token_type: 'Bearer',
});
const overview = () => ({
  permissions: [
    'system:user:list',
    ...(createPermission ? ['system:user:create'] : []),
  ],
  user: {
    avatar: '',
    dept_id: 1,
    id: 1,
    is_super: false,
    nickname: '契约测试用户',
    roles: [{ code: 'fixture', id: 1, name: '测试角色' }],
    tenant_id: 1,
    username: 'fixture-user',
  },
});
const menu = (id, name, path, component, type = 'menu', children = []) => ({
  children,
  component,
  id,
  is_external: false,
  keep_alive: false,
  meta: {},
  name,
  parent_id: id === 1 ? 0 : 1,
  path,
  sort: id,
  type,
});
const menus = () => [
  menu(1, '系统', '/system', '', 'dir', [
    menu(2, '用户', '/system/users', 'system/user/index'),
    ...(includeRoles
      ? [menu(3, '角色', '/system/roles', 'system/role/index')]
      : []),
    menu(4, '未知组件测试', '/system/unknown', 'unregistered/index'),
  ]),
];
const users = Array.from({ length: 45 }, (_, i) => ({
  avatar: null,
  created_at: '2026-11-10T08:00:00Z',
  dept_id: 1,
  email: `user${i + 1}@example.test`,
  id: i + 1,
  is_super: false,
  nickname: `测试用户 ${i + 1}`,
  status: ['active', 'disabled', 'locked'][i % 3],
  tenant_id: 1,
  updated_at: '2026-11-10T08:00:00Z',
  username: `user${String(i + 1).padStart(2, '0')}`,
}));
const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
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

await page.route('**/api/v1/**', async (route) => {
  const request = route.request();
  const url = new URL(request.url());
  const path = url.pathname.replace('/api/v1', '');
  requests.push({
    method: request.method(),
    path,
    query: Object.fromEntries(url.searchParams),
  });
  const answer = (data, status = 200, code = 0) =>
    route.fulfill({
      contentType: 'application/json',
      json: undefined,
      body: JSON.stringify({
        code,
        data,
        message: 'BACKEND_PRIVATE_MESSAGE_MUST_NOT_RENDER',
        trace_id: 'fixture-trace',
      }),
      status,
    });
  if (path === '/auth/login')
    return answer({ ...tokens(), user: overview().user });
  if (path === '/auth/logout') return route.fulfill({ body: '', status: 204 });
  if (path === '/auth/refresh') {
    refreshCalls++;
    await new Promise((resolve) => setTimeout(resolve, 100));
    if (busyRefresh-- > 0) return answer(null, 409, 20109);
    assert.equal(request.postDataJSON().refresh_token, tokens().refresh_token);
    version++;
    expired = false;
    return answer(tokens());
  }
  if (revoked) return answer(null, 401, 20103);
  if (
    expired ||
    request.headers().authorization !== `Bearer ${tokens().access_token}`
  )
    return answer(null, 401, 20102);
  if (nextError) {
    const failure = nextError;
    nextError = undefined;
    return answer(null, failure.status, failure.code);
  }
  if (path === '/auth/me') return answer(overview());
  if (path === '/auth/menus') return answer({ ...overview(), menus: menus() });
  if (path === '/admin/users') {
    const keyword = url.searchParams.get('keyword') || '';
    const status = url.searchParams.get('status') || '';
    const list = users.filter(
      (user) =>
        (!keyword || user.username.includes(keyword)) &&
        (!status || user.status === status),
    );
    const size = Math.min(100, Number(url.searchParams.get('page_size')) || 20);
    const number = Number(url.searchParams.get('page')) || 1;
    return answer({
      list: list.slice((number - 1) * size, number * size),
      page: number,
      page_size: size,
      total: list.length,
    });
  }
  throw new Error(`Unexpected endpoint ${request.method()} ${path}`);
});

const waitUsers = () =>
  page.getByRole('cell', { exact: true, name: 'user01' }).waitFor();
const login = async () => {
  await page.getByPlaceholder('请输入用户名').fill('fixture-user');
  await page.getByPlaceholder('密码', { exact: true }).fill('fixture-password');
  await page.getByRole('button', { name: 'login', exact: true }).click();
  await waitUsers();
};
const callMe = (count = 1) =>
  page.evaluate(async (count) => {
    const { requestClient } = await import('/src/api/request.ts');
    return Promise.all(
      Array.from({ length: count }, () =>
        requestClient
          .get('/auth/me')
          .then(() => true)
          .catch(() => false),
      ),
    );
  }, count);

const capture = async (name) => {
  await page.evaluate(async () => {
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await Promise.all(
      document
        .getAnimations()
        .filter((animation) =>
          Number.isFinite(animation.effect?.getComputedTiming().endTime),
        )
        .map((animation) => animation.finished.catch(() => {})),
    );
  });
  await page.screenshot({
    animations: 'disabled',
    path: new URL(name, output).pathname.replace(/^\/(\w:)/, '$1'),
    fullPage: true,
  });
};

try {
  await page.goto(`${origin}/auth/login`);
  await page.getByRole('button', { name: 'login', exact: true }).waitFor();
  await capture('login.png');
  await login();
  assert.equal(new URL(page.url()).pathname, '/system/users');
  const storage = await page.evaluate(() => ({
    local: { ...localStorage },
    session: { ...sessionStorage },
  }));
  assert.ok(Object.values(storage.session).includes(tokens().refresh_token));
  assert.ok(!JSON.stringify(storage).includes(tokens().access_token));
  assert.ok(!JSON.stringify(storage.local).includes(tokens().refresh_token));
  checks.push({
    assertion: 1,
    evidence:
      'Fixture credentials → POST /auth/login → GET /auth/me → /auth/menus → /system/users; access absent from both storage objects, refresh present only in sessionStorage.',
  });
  assert.equal(
    await page.getByRole('button', { exact: true, name: '新增用户' }).count(),
    0,
  );
  await capture('users.png');

  const beforeReload = refreshCalls;
  await page.reload();
  await waitUsers();
  assert.equal(refreshCalls - beforeReload, 1);
  await page.getByText('角色', { exact: true }).first().waitFor();
  checks.push({
    assertion: 2,
    evidence:
      'Reload restores session with one refresh and refetches the backend-provided system/user/role menu tree.',
  });

  await page.getByText('角色', { exact: true }).first().click();
  await page.getByText('功能尚未接入', { exact: true }).waitFor();
  await capture('placeholder.png');
  checks.push({
    assertion: 10,
    evidence:
      'Known unfinished system/role/index renders its placeholder and triggers no invented API requests.',
  });
  await page.getByText('未知组件测试', { exact: true }).first().click();
  await page.getByText('哎呀！未找到页面', { exact: true }).waitFor();
  await page
    .getByText('功能尚未接入', { exact: true })
    .waitFor({ state: 'hidden' });
  await capture('unknown-component.png');
  checks.push({
    assertion: 4,
    evidence:
      'Unknown component unregistered/index resolves to the rendered 404 page with the application layout intact.',
  });
  await page.getByText('用户', { exact: true }).first().click();
  await waitUsers();

  expired = true;
  const beforeConcurrent = refreshCalls;
  assert.deepEqual(await callMe(5), [true, true, true, true, true]);
  assert.equal(refreshCalls - beforeConcurrent, 1);
  assert.equal(await page.locator('.ant-message-error').count(), 0);
  checks.push({
    assertion: 5,
    evidence:
      'Five simultaneous /auth/me calls with expired access produced one /auth/refresh and five successful replays; no error toast.',
  });
  expired = true;
  busyRefresh = 1;
  const beforeBusy = refreshCalls;
  assert.deepEqual(await callMe(5), [true, true, true, true, true]);
  assert.equal(refreshCalls - beforeBusy, 2);
  assert.equal(await page.locator('.ant-message-error').count(), 0);
  checks.push({
    assertion: 5,
    evidence:
      'First refresh returned HTTP 409/code 20109; one silent retry succeeded and all five queued requests completed.',
  });

  await page.getByLabel('关键词', { exact: true }).fill('user02');
  await page.getByRole('button', { name: /查\s*询/ }).click();
  await page.getByRole('cell', { exact: true, name: 'user02' }).waitFor();
  assert.ok(
    requests.some(
      (r) =>
        r.path === '/admin/users' &&
        r.query.keyword === 'user02' &&
        r.query.page === '1',
    ),
  );
  await page.getByRole('button', { name: /重\s*置/ }).click();
  await waitUsers();
  await page.locator('.ant-pagination-item-2').click();
  await page.getByRole('cell', { exact: true, name: 'user21' }).waitFor();
  assert.ok(
    requests.some((r) => r.path === '/admin/users' && r.query.page === '2'),
  );
  await page.getByLabel('状态', { exact: true }).click();
  await page
    .locator('.ant-select-dropdown')
    .getByText('锁定', { exact: true })
    .click();
  await page.getByRole('button', { name: /查\s*询/ }).click();
  await page.getByRole('cell', { exact: true, name: 'user03' }).waitFor();
  assert.ok(
    requests.some(
      (r) =>
        r.path === '/admin/users' &&
        r.query.status === 'locked' &&
        r.query.page === '1',
    ),
  );
  assert.equal(
    await page.getByRole('cell', { exact: true, name: 'user01' }).count(),
    0,
  );
  assert.ok(
    (await page
      .getByRole('cell', { exact: true, name: '2026-11-10 16:00:00' })
      .count()) > 0,
  );
  const size = await page.evaluate(async () => {
    const { getUsersApi } = await import('/src/api/core/admin-users.ts');
    return (await getUsersApi({ page_size: 200 })).page_size;
  });
  assert.equal(size, 100);
  assert.equal(requests.at(-1).query.page_size, '100');
  checks.push({
    assertion: 7,
    evidence:
      'Keyword search resets page, reset clears keyword, page 2 shows user21; locked status resets to page 1 and shows user03, excluding user01; page_size=200 is sent as 100 and returns 100; RFC3339 08:00Z renders as 16:00 in Asia/Shanghai. Fixture supports filtering; backend filter support still requires integration.',
  });

  for (const [status, code, text] of [
    [403, 20107, '没有权限执行此操作'],
    [409, 10004, '请求处理中，请稍后重试'],
    [429, 10005, '请求过于频繁，请稍后重试'],
  ]) {
    nextError = { code, status };
    assert.deepEqual(await callMe(), [false]);
    await page.getByText(text, { exact: true }).waitFor();
  }
  assert.ok(
    !(await page.locator('body').innerText()).includes(
      'BACKEND_PRIVATE_MESSAGE_MUST_NOT_RENDER',
    ),
  );
  checks.push({
    assertion: 8,
    evidence:
      'HTTP 403/409/429 rendered the expected local Chinese code mapping, with the sentinel backend message absent from the DOM.',
  });

  includeRoles = false;
  createPermission = true;
  await page.evaluate(async () => {
    const { useAuthStore } = await import('/src/store/auth.ts');
    await useAuthStore().logout(false);
  });
  await login();
  assert.equal(await page.getByText('角色', { exact: true }).count(), 0);
  const create = page.getByRole('button', { exact: true, name: '新增用户' });
  await create.waitFor();
  await create.click();
  await page.getByText('当前版本仅支持查看用户', { exact: true }).waitFor();
  assert.ok(
    !requests.some((r) => r.path === '/admin/users' && r.method !== 'GET'),
  );
  checks.push({
    assertion: 3,
    evidence:
      'After removing the role menu fixture and relogging, role disappears. Granting system:user:create exposes the demonstration button; clicking performs no write.',
  });

  revoked = true;
  const beforeRevocation = refreshCalls;
  assert.deepEqual(await callMe(), [false]);
  await page.getByRole('button', { name: 'login', exact: true }).waitFor();
  await page.getByText('登录已失效，请重新登录', { exact: true }).waitFor();
  assert.equal(refreshCalls, beforeRevocation);
  assert.equal(
    await page.evaluate(
      () =>
        Object.values(sessionStorage).filter((value) =>
          value.startsWith('fixture-refresh-'),
        ).length,
    ),
    0,
  );
  assert.equal(new URL(page.url()).pathname, '/auth/login');
  checks.push({
    assertion: 6,
    evidence:
      'A revoked-session HTTP 401/code 20103 response cleared credentials and navigated to login with no refresh.',
  });
  checks.push({
    assertion: 8,
    evidence:
      'HTTP 401/code 20103 returns the local session-expired message and clears state.',
  });
  assert.deepEqual(errors, []);
  checks.push({
    assertion: 10,
    evidence:
      'No uncaught page errors across login, reload, users, placeholders, unknown routes, refresh and revocation.',
  });
  console.log(
    JSON.stringify({ checks, errors, refreshCalls, requests }, null, 2),
  );
} catch (failure) {
  console.error(
    JSON.stringify(
      {
        url: page.url(),
        body: await page.locator('body').innerText(),
        buttons: await page.getByRole('button').allTextContents(),
      },
      null,
      2,
    ),
  );
  throw failure;
} finally {
  await writeFile(
    new URL('browser-results.json', output),
    JSON.stringify({ checks, errors, refreshCalls, requests }, null, 2),
  );
  await capture('final-state.png').catch(() => {});
  await browser.close();
}
