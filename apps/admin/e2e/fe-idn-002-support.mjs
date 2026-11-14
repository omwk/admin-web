import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

// eslint-disable-next-line n/no-extraneous-import -- Workspace browser test tooling.
import { chromium } from 'playwright';

export const origin = process.env.FE_IDN_002_ORIGIN || 'http://127.0.0.1:5669';
const backend = process.env.FE_IDN_002_BACKEND || 'http://127.0.0.1:18080';
export const output = new URL(
  '../../../docs/evidence/fe-idn-002/',
  import.meta.url,
);
export const checks = [];
export const browserErrors = [];
export const secrets = new Set();
export const network = { publicRequests: [], discoveryRequests: [] };
let bearer;
export function openEmptyTenantRegistration(id, code) {
  assert.ok(process.env.FE_IDN_002_BACKEND_REPO, 'Set FE_IDN_002_BACKEND_REPO');
  assert.ok(process.env.FE_IDN_002_DATABASE_URL, 'Set FE_IDN_002_DATABASE_URL');
  const fixture = fileURLToPath(
    new URL('fixtures/registration.go', import.meta.url),
  );
  const result = spawnSync(
    'go',
    [
      '-C',
      process.env.FE_IDN_002_BACKEND_REPO,
      'run',
      '-mod=readonly',
      fixture,
    ],
    {
      env: {
        ...process.env,
        FE_IDN_002_TENANT_ID: String(id),
        FE_IDN_002_TENANT_CODE: code,
      },
      encoding: 'utf8',
      timeout: 60_000,
    },
  );
  assert.equal(
    result.status,
    0,
    'Enable registration only for the isolated tenant with zero active users',
  );
}
export function redact(value) {
  let result = String(value);
  for (const secret of secrets)
    if (secret) result = result.replaceAll(secret, '[REDACTED]');
  return result.replaceAll(/([?#&]token=)[^\s"'<> &]+/g, '$1[REDACTED]');
}
function remember(data) {
  for (const key of [
    'access_token',
    'refresh_token',
    'dev_verify_url',
    'invite_url',
  ]) {
    if (data?.[key]) secrets.add(data[key]);
  }
  if (data?.dev_verify_url) secrets.add(verificationToken(data.dev_verify_url));
}
export async function request(path, method = 'GET', input, token = bearer) {
  const result = await fetch(backend + '/api/v1' + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    ...(input === undefined ? {} : { body: JSON.stringify(input) }),
  });
  const body = result.status === 204 ? {} : await result.json();
  remember(body.data);
  return {
    status: result.status,
    code: body.code,
    message: body.message,
    traceId: body.trace_id,
    data: body.data,
  };
}
export const summary = ({ status, code, message, traceId }) => ({
  status,
  code,
  message,
  traceId,
});
export async function api(path, method = 'GET', input, token = bearer) {
  const result = await request(path, method, input, token);
  assert.ok(
    result.status >= 200 && result.status < 300,
    method + ' ' + path + ': ' + JSON.stringify(summary(result)),
  );
  return result.data;
}
export async function setup() {
  assert.ok(
    process.env.FE_IDN_002_ADMIN_PASSWORD,
    'Set FE_IDN_002_ADMIN_PASSWORD',
  );
  secrets.add(process.env.FE_IDN_002_ADMIN_PASSWORD);
  const auth = await api(
    '/auth/login',
    'POST',
    {
      tenant: 'default',
      account: 'admin',
      password: process.env.FE_IDN_002_ADMIN_PASSWORD,
    },
    null,
  );
  bearer = auth.access_token;
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  return { browser, auth };
}
export async function newPage(browser) {
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1100 },
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => browserErrors.push(redact(error.message)));
  page.on('request', (item) => {
    const path = new URL(item.url()).pathname;
    if (
      ['/api/v1/auth/register', '/api/v1/auth/register/verify'].includes(path)
    ) {
      const authorization = Boolean(item.headers().authorization);
      network.publicRequests.push({
        path,
        method: item.method(),
        authorization,
      });
      assert.equal(
        authorization,
        false,
        'Public request must not carry a session',
      );
    }
    if (
      /\/auth\/.*(?:settings|registration-status|registration-enabled)/.test(
        path,
      )
    )
      network.discoveryRequests.push(path);
  });
  return page;
}
export async function session(page, pair, path = '/system/settings') {
  await page.goto(origin + '/auth/login');
  await page.getByLabel('企业代码', { exact: true }).waitFor();
  await page.evaluate(
    (refresh) => sessionStorage.setItem('vben-web-antd:refresh_token', refresh),
    pair.refresh_token,
  );
  await page.goto(origin + path);
}
export const button = (name, root) =>
  root.getByRole('button', {
    name: new RegExp('^' + [...name].join('\\s*') + '$'),
  });
export async function response(page, path, method, action) {
  const pending = page.waitForResponse(
    (item) =>
      new URL(item.url()).pathname === '/api/v1' + path &&
      item.request().method() === method,
  );
  await action();
  const result = await pending;
  const body = result.status() === 204 ? {} : await result.json();
  remember(body.data);
  return {
    status: result.status(),
    code: body.code,
    message: body.message,
    traceId: body.trace_id,
    data: body.data,
    input: result.request().postDataJSON(),
  };
}
export async function settings(page) {
  await page.goto(origin + '/system/settings');
  await page.getByRole('tab', { name: /注册 tenant/ }).click();
  const group = page.locator('[data-setting-group="tenant"]');
  await group.waitFor();
  return group;
}
export async function fillRegistration(page, credentials, password) {
  await page.goto(
    origin + '/auth/register?tenant=' + encodeURIComponent(credentials.tenant),
  );
  for (const [label, value] of Object.entries({
    账号: credentials.account,
    邮箱: credentials.email,
    密码: password,
    确认密码: password,
  }))
    await page.getByLabel(label, { exact: true }).fill(value);
}
export async function register(page, credentials, password) {
  await fillRegistration(page, credentials, password);
  return response(page, '/auth/register', 'POST', () =>
    button('注册', page).click(),
  );
}
export function verificationToken(link) {
  const url = new URL(link, origin);
  const token =
    url.searchParams.get('token') ||
    new URLSearchParams(url.hash.slice(1)).get('token');
  assert.ok(token, 'Development link carries a verification token');
  return token;
}
export async function verify(page, link, fragment = false) {
  const token = verificationToken(link);
  secrets.add(token);
  return response(page, '/auth/register/verify', 'POST', () =>
    page.goto(
      origin +
        '/auth/register/verify' +
        (fragment ? '#token=' : '?token=') +
        encodeURIComponent(token),
    ),
  );
}
export async function login(page, credentials, password) {
  await page.goto(
    origin + '/auth/login?tenant=' + encodeURIComponent(credentials.tenant),
  );
  await page.getByLabel('账号', { exact: true }).fill(credentials.account);
  await page.getByLabel('密码', { exact: true }).fill(password);
  return response(page, '/auth/login', 'POST', () =>
    page.getByRole('button', { name: 'login', exact: true }).click(),
  );
}
export async function shot(name, page) {
  const result = page.locator('.ant-result');
  if (await result.count()) {
    await result.waitFor({ state: 'visible' });
  }
  // The authentication layout also animates an ancestor of the result panel.
  await page.evaluate(async () => {
    for (let frame = 0; frame < 2; frame++) {
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      );
      await Promise.all(
        document
          .getAnimations()
          .filter(
            (animation) =>
              animation.effect?.getComputedTiming().iterations !== Infinity,
          )
          .map((animation) => animation.finished.catch(() => {})),
      );
    }
  });
  await page.screenshot({
    path: fileURLToPath(new URL(name + '.png', output)),
    fullPage: true,
    animations: 'disabled',
    mask: [page.locator('input[type="password"]')],
  });
}
export function check(item, assertion, evidence) {
  checks.push({ item, result: 'pass', assertion, ...evidence });
  process.stdout.write('FE-IDN-002 acceptance ' + item + ': passed\n');
}
