import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import process from 'node:process';

import {
  api,
  button,
  cleanup,
  login,
  newPage,
  origin,
  output,
  setup,
  shot,
} from './fe-ui-001-support.mjs';

const state = await setup();
const report = {
  phase: 'd',
  source: 'real-18080-and-msedge',
  checks: [],
  cleanup: false,
};
let activePage;
async function logout(page) {
  await page
    .locator('button')
    .filter({ has: page.locator('svg.lucide-log-out') })
    .click();
  const dialog = page.getByRole('dialog');
  await dialog.waitFor();
  await button('确认', dialog).click();
}
try {
  const pair = await login(state.user.username, state.password);
  const { page, errors } = await newPage(state.browser, pair, '/home');
  activePage = page;
  await page
    .getByText('你还没有被分配权限，请联系管理员', { exact: true })
    .waitFor();
  assert.equal(new URL(page.url()).pathname, '/home');
  assert.equal(await page.getByTestId('home-notifications').count(), 0);
  await shot('11-home-empty-real', page);
  const admin = await newPage(state.browser, state.admin, '/home');
  await admin.page.getByTestId('home-shortcuts').waitFor();
  const shortcuts = await admin.page
    .getByTestId('home-shortcuts')
    .getByRole('link')
    .count();
  assert.ok(shortcuts >= 1 && shortcuts <= 6);
  await admin.page.getByTestId('home-notifications').waitFor();
  await shot('11-home-permissions-real', admin.page);
  report.checks.push({
    item: 11,
    status: 'pass',
    noGrants: 'specified empty state at /home; no notifications card',
    grantedShortcuts: shortcuts,
    fixedHome: true,
  });
  await page.goto(origin + '/system/users');
  await page
    .getByText('抱歉，您没有权限访问此页面。', { exact: true })
    .waitFor();
  await shot('12-known-route-forbidden-real', page);
  await page.goto(origin + '/this-path-does-not-exist-fe-ui-001');
  await page.getByText('404 · 页面不存在', { exact: true }).waitFor();
  await button('返回首页', page).click();
  await page.getByTestId('home-welcome').waitFor();
  await page.goto(origin + '/profile');
  await page.getByLabel('昵称', { exact: true }).waitFor();
  await page.goto(origin + '/unknown-fe-ui-back');
  await page.getByText('404 · 页面不存在', { exact: true }).waitFor();
  await button('返回上一页', page).click();
  await page.getByLabel('昵称', { exact: true }).waitFor();
  await page.goto(origin + '/unknown-fe-ui-final');
  await page.getByText('404 · 页面不存在', { exact: true }).waitFor();
  await shot('12-not-found-real', page);
  report.checks.push({
    item: 12,
    status: 'pass',
    unknown: '404',
    knownUnauthorized: '403',
    homeButton: true,
    backButton: true,
  });
  await page.goto(origin + '/profile');
  await page.getByLabel('昵称', { exact: true }).waitFor();
  await page.evaluate(() =>
    sessionStorage.setItem('private-page-state', 'sensitive'),
  );
  await logout(page);
  await page.waitForURL((url) => url.pathname === '/auth/login');
  assert.equal(await page.evaluate(() => sessionStorage.length), 0);
  await page.goBack();
  await page.waitForURL((url) => url.pathname === '/auth/login');
  assert.equal(await page.getByLabel('昵称', { exact: true }).count(), 0);
  await shot('10-logout-back-guard-real', page);
  const next = await login(state.user.username, state.password);
  const failed = await newPage(state.browser, next, '/profile');
  activePage = failed.page;
  await failed.page.getByLabel('昵称', { exact: true }).waitFor();
  await failed.page.route('**/api/v1/auth/logout', (route) =>
    route.fulfill({
      status: 503,
      json: { code: 10002, message: 'test unavailable' },
    }),
  );
  await logout(failed.page);
  await failed.page.waitForURL((url) => url.pathname === '/auth/login');
  assert.equal(await failed.page.evaluate(() => sessionStorage.length), 0);
  await shot('10-logout-server-failure-ui-fixture', failed.page);
  await api('/auth/logout', 'POST', undefined, next.access_token);
  report.checks.push({
    item: 10,
    status: 'pass',
    storageCleared: true,
    backDoesNotExposeProfile: true,
    remoteFailure: '503 response fixture with real authenticated user',
    replacementNavigation: true,
  });
  assert.deepEqual([...errors, ...admin.errors, ...failed.errors], []);
  report.browserErrors = [];
} catch (error) {
  report.failure = error.message;
  report.url = activePage?.url();
  if (activePage) await shot('failure-shell', activePage);
  throw error;
} finally {
  await cleanup(state);
  report.cleanup = true;
  await writeFile(
    new URL('phase-d.json', output),
    JSON.stringify(report, null, 2),
  );
  process.stdout.write(JSON.stringify(report) + '\n');
}
