import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import process from 'node:process';

import { output, request, summary } from './fe-ui-001-support.mjs';

assert.ok(process.env.FE_UI_ADMIN_PASSWORD, 'FE_UI_ADMIN_PASSWORD is required');
await mkdir(output, { recursive: true });
const login = await request('/auth/login', 'POST', {
  tenant: 'default',
  account: 'admin',
  password: process.env.FE_UI_ADMIN_PASSWORD,
});
const report = {
  checkedAt: new Date().toISOString(),
  backendMain: '43becf92aba99690937cd71ddce68b90e8b9291e',
  mergedPR: 'https://github.com/omwk/go-admin-api/pull/44',
  exactLoginFields: ['tenant', 'account', 'password'],
  login: summary(login),
};
if (login.status === 200) {
  try {
    const me = await request(
      '/auth/me',
      'GET',
      undefined,
      login.data.access_token,
    );
    const user = me.data.user;
    report.meFields = Object.keys(user).sort();
    report.tenantCode = me.data.tenant_code ?? user.tenant_code ?? null;
    report.newContractDeployed = report.tenantCode === 'default';
  } finally {
    const logout = await request(
      '/auth/logout',
      'POST',
      undefined,
      login.data.access_token,
    );
    report.logout = summary(logout);
  }
}
await writeFile(
  new URL('dependency.json', output),
  JSON.stringify(report, null, 2),
);
process.stdout.write(JSON.stringify(report) + '\n');
