import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import process from 'node:process';

import {
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

const state = await setup();
const report = {
  phase: 'c',
  source: 'real-18080-and-msedge',
  checks: [],
  cleanup: false,
};
let activePage;
let browserErrors = [];
try {
  const pair = await login(state.user.username, state.password);
  const other = await login(state.user.username, state.password);
  const { page, errors } = await newPage(
    state.browser,
    pair,
    '/profile/sessions',
  );
  activePage = page;
  browserErrors = errors;
  await page.getByTestId('my-sessions').waitFor();
  await page
    .getByTestId('my-sessions')
    .locator('tbody tr[data-row-key]')
    .first()
    .waitFor();
  const rows = await page
    .getByTestId('my-sessions')
    .locator('tbody tr[data-row-key]')
    .count();
  assert.ok(rows >= 2);
  await shot('09-sessions-real', page);
  const list = await request(
    '/auth/sessions',
    'GET',
    undefined,
    other.access_token,
  );
  assert.equal(list.status, 200);
  report.metadata = list.data.list.map((row) => ({
    sidPresent: Boolean(row.sid),
    ipPresent: Boolean(row.ip),
    uaPresent: Boolean(row.user_agent),
    currentPresent: row.current !== undefined,
  }));
  report.limitations = report.metadata.some(
    (row) => !row.sidPresent || !row.ipPresent || !row.uaPresent,
  )
    ? [
        'Backend omits IP/User-Agent/current and returns empty sid; live device metadata cannot be verified.',
      ]
    : [];
  await button('全部下线', page).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByText(/当前设备也将退出登录/).waitFor();
  await shot('09-logout-all-confirm-real', page);
  await button('取消', dialog).click();
  assert.equal(
    (await request('/auth/me', 'GET', undefined, other.access_token)).status,
    200,
  );
  await button('全部下线', page).click();
  const revoked = await response(page, '/auth/logout-all', 'POST', () =>
    button('确认全部下线', dialog).click(),
  );
  assert.equal(revoked.status, 204);
  await page.waitForURL((url) => url.pathname === '/auth/login');
  assert.equal(await page.evaluate(() => sessionStorage.length), 0);
  const otherResult = await request(
    '/auth/me',
    'GET',
    undefined,
    other.access_token,
  );
  assert.equal(otherResult.status, 401);
  await shot('09-logout-all-login-real', page);
  report.checks.push({
    item: 9,
    status: report.limitations.length ? 'partial' : 'pass',
    rows,
    cancelRetainsSession: true,
    logoutAll: revoked.status,
    otherSession: summary(otherResult),
    destination: '/auth/login',
    sessionStorageEntries: 0,
  });
  assert.deepEqual(errors, []);
  report.browserErrors = errors;
} catch (error) {
  report.failure = error.message;
  report.url = activePage?.url();
  report.browserErrors = browserErrors;
  report.visibleError = await activePage?.getByRole('alert').allTextContents();
  if (activePage) await shot('failure-sessions', activePage);
  throw error;
} finally {
  await cleanup(state);
  report.cleanup = true;
  await writeFile(
    new URL('phase-c.json', output),
    JSON.stringify(report, null, 2),
  );
  process.stdout.write(JSON.stringify(report) + '\n');
}
