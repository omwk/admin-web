import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

// eslint-disable-next-line n/no-extraneous-import -- Existing workspace browser tooling.
import { chromium } from 'playwright';

const origin = process.env.FE_IDN_012_ORIGIN || 'http://127.0.0.1:5666';
const backend = process.env.FE_IDN_012_BACKEND || 'http://127.0.0.1:18081';
const output = new URL('../../../docs/evidence/fe-idn-012/', import.meta.url);
const report = {
  task: 'FE-IDN-012',
  startedAt: new Date().toISOString(),
  origin,
  backend,
  checks: [],
  requests: [],
  browserErrors: [],
};
const code = 'feidn012_' + Date.now();
const password = 'Account@' + randomBytes(16).toString('hex');
const tokens = ['invite', 'invite', 'invite', 'reset'].map((purpose) => ({
  purpose,
  raw: randomBytes(32).toString('base64url'),
}));
async function database(operation, payload) {
  return new Promise((resolve, reject) => {
    const child = execFile(
      process.env.FE_IDN_012_BUN || 'bun',
      [fileURLToPath(new URL('fe-idn-012-db.mjs', import.meta.url)), operation],
      { timeout: 30_000 },
      (error, stdout, stderr) => {
        if (error)
          return reject(
            new Error('Database worker: ' + (stderr || error.message)),
          );
        try {
          resolve(JSON.parse(stdout));
        } catch (parseError) {
          reject(parseError);
        }
      },
    );
    child.stdin.on('error', reject);
    child.stdin.end(JSON.stringify(payload));
  });
}
async function persist() {
  await writeFile(
    new URL('acceptance.json', output),
    JSON.stringify(report, null, 2) + '\n',
  );
}
async function shot(name, page) {
  await page.screenshot({
    path: fileURLToPath(new URL(name + '.png', output)),
    fullPage: true,
    animations: 'disabled',
    mask: [page.locator('input[type="password"]')],
  });
  return name + '.png';
}
async function record(item, evidence) {
  report.checks.push({ item, result: 'pass', ...evidence });
  await persist();
}
let fixture;
let browser;
let failure;
try {
  await mkdir(output, { recursive: true });
  fixture = await database('bootstrap', {
    code,
    password,
    tokens: tokens.map((token) => ({
      purpose: token.purpose,
      hash: createHash('sha256').update(token.raw).digest('hex'),
    })),
  });
  report.fixture = {
    tenant: fixture.tenant,
    originalAuditRecords: fixture.before.audit_log.length,
  };
  browser = await chromium.launch({
    headless: true,
    channel: process.env.FE_IDN_012_BROWSER_CHANNEL || 'msedge',
  });
  const context = await browser.newContext({
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    viewport: { width: 1600, height: 1100 },
    userAgent: 'FE-IDN-012 acceptance browser',
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => report.browserErrors.push(error.message));
  // Proxy to an unmodified real API response from the separately built test process.
  await page.route(origin + '/api/**', async (route) => {
    const url = new URL(route.request().url());
    const response = await route.fetch({
      url: backend + url.pathname + url.search,
    });
    await route.fulfill({ response });
  });
  page.on('response', async (response) => {
    const path = new URL(response.url()).pathname;
    if (!path.startsWith('/api/v1/auth/')) return;
    const request = response.request();
    const input = request.postDataJSON() || {};
    report.requests.push({
      path,
      method: request.method(),
      status: response.status(),
      tenant: input.tenant,
      tenant_id: input.tenant_id,
      authenticated: Boolean(request.headers().authorization),
    });
  });
  await page.goto(origin + '/auth/invite/accept?tenant=acme#token=x');
  await page.getByLabel('新密码', { exact: true }).waitFor();
  assert.equal(
    await page.getByLabel('新密码', { exact: true }).isEnabled(),
    true,
  );
  await record(1, {
    url: '?tenant=acme#token=x',
    screenshot: await shot('01-code-link', page),
  });
  await page.goto(origin + '/auth/invite/accept?tenant_id=2#token=x');
  assert.equal(
    await page.getByLabel('新密码', { exact: true }).isEnabled(),
    true,
  );
  await record(2, {
    url: '?tenant_id=2#token=x',
    screenshot: await shot('02-legacy-link', page),
  });
  await page.goto(origin + '/auth/invite/accept#token=x');
  await page
    .getByText('链接不完整，请联系管理员重新生成。', { exact: true })
    .waitFor();
  assert.equal(
    await page.getByRole('button', { name: /创\s*建\s*账\s*号/ }).isDisabled(),
    true,
  );
  await record(3, {
    screenshot: await shot('03-incomplete-link', page),
    disabled: true,
  });
  await page.evaluate(() =>
    localStorage.setItem('vben-web-antd:last-tenant-code', 'remembered-other'),
  );
  async function complete(mode, index, query, expectedTenant) {
    const path =
      mode === 'invite' ? '/auth/invite/accept' : '/auth/password/reset';
    const nextPassword =
      mode === 'reset'
        ? 'Updated@' + randomBytes(16).toString('hex')
        : password;
    await page.goto(
      origin + path + '?' + query + '#token=' + tokens[index].raw,
    );
    if (mode === 'invite')
      await page.getByLabel('用户名', { exact: true }).fill('member-' + index);
    await page.getByLabel('新密码', { exact: true }).fill(nextPassword);
    await page.getByLabel('确认密码', { exact: true }).fill(nextPassword);
    const pending = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/v1' + path &&
        response.request().method() === 'POST',
    );
    await page
      .getByRole('button', {
        name: mode === 'invite' ? /创\s*建\s*账\s*号/ : /更\s*新\s*密\s*码/,
      })
      .click();
    const response = await pending;
    assert.equal(response.status(), mode === 'invite' ? 201 : 204);
    await page
      .getByText(mode === 'invite' ? '账号已创建' : '密码已更新', {
        exact: true,
      })
      .waitFor();
    assert.equal(new URL(page.url()).hash, '');
    await page.getByRole('link', { name: '前往登录' }).click();
    const tenant = page.getByLabel('企业代码', { exact: true });
    await tenant.waitFor();
    assert.equal(await tenant.inputValue(), expectedTenant);
    assert.equal(new URL(page.url()).hash, '');
    return {
      mode,
      status: response.status(),
      loginTenant: await tenant.inputValue(),
      screenshot: await shot('login-' + mode + '-' + index, page),
    };
  }
  const codeInvite = await complete('invite', 0, 'tenant=' + code, code);
  const legacyInvite = await complete(
    'invite',
    1,
    'tenant_id=' + fixture.tenant.id,
    '',
  );
  const precedenceInvite = await complete(
    'invite',
    2,
    'tenant=' + code + '&tenant_id=1',
    code,
  );
  const codeReset = await complete('reset', 3, 'tenant=' + code, code);
  await record(4, {
    codeInvite,
    precedenceInvite,
    codeReset,
    realBackend: true,
  });
  await record(5, {
    legacyInvite,
    rememberedTenant: 'remembered-other',
    realBackend: true,
  });
  await page.goto(
    origin + '/auth/register/verify?tenant=&tenant_id=invalid#token=invalid',
  );
  await page
    .getByText('链接已失效，请重新获取验证邮件', { exact: true })
    .waitFor();
  await record(6, {
    realBackend: true,
    screenshot: await shot('06-invalid-verification', page),
  });
  assert.deepEqual(report.browserErrors, []);
  assert.equal(
    report.requests.filter((request) => request.path.endsWith('/invite/accept'))
      .length,
    3,
  );
  assert.equal(
    report.requests.some((request) => request.authenticated),
    false,
  );
} catch (error) {
  failure = error;
  report.failure = error.message.replaceAll(
    /#token=[^\s"']+/g,
    '#token=[REDACTED]',
  );
} finally {
  await browser?.close();
  if (fixture)
    report.cleanup = await database('cleanup', {
      fixture,
      startedAt: report.startedAt,
    });
  report.completedAt = new Date().toISOString();
  await persist();
}
if (failure) throw new Error(report.failure);
process.stdout.write(
  'FE-IDN-012 browser acceptance 1-6: passed; fixture cleanup: passed\n',
);
