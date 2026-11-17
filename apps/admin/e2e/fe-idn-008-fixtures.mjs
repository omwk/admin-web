import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import {
  api,
  publicResult,
  report,
  request,
  userAgents,
} from './fe-idn-008-support.mjs';

// Keep Playwright on Node; use the existing Bun runtime only for local SQL fixtures.
function runDatabase(operation, payload) {
  return new Promise((resolve, reject) => {
    const child = execFile(
      process.env.FE_IDN_008_BUN || 'bun',
      [
        fileURLToPath(new URL('./fe-idn-008-db.mjs', import.meta.url)),
        operation,
      ],
      { timeout: 20000, maxBuffer: 4 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          reject(
            new Error('Database fixture worker: ' + (stderr || error.message)),
          );
          return;
        }
        try {
          resolve(JSON.parse(stdout));
        } catch (error_) {
          reject(error_);
        }
      },
    );
    child.stdin.on('error', reject);
    child.stdin.end(JSON.stringify(payload));
  });
}
export function database() {
  assert.ok(
    process.env.FE_IDN_008_DATABASE_URL,
    'Set FE_IDN_008_DATABASE_URL to the local development database',
  );
  const query = (strings, ...values) =>
    runDatabase('query', {
      statement: strings.reduce(
        (text, part, index) => text + (index ? '$' + index : '') + part,
        '',
      ),
      values,
    });
  query.prune = (payload) => runDatabase('prune', payload);
  return query;
}
export async function baseline(db) {
  return {
    tenants: await db`SELECT id, code FROM tenant ORDER BY id`,
    templates: await db`SELECT id, code FROM tenant_template ORDER BY id`,
    settings:
      await db`SELECT tenant_id, group_key, item_key, md5(value::text) AS value_hash FROM sys_setting ORDER BY tenant_id, group_key, item_key`,
    audits: await db`SELECT id FROM audit_log ORDER BY id`,
  };
}
export async function backdate(db, tenant) {
  assert.match(tenant.code, /^feidn008_[0-9]+_tenant$/);
  const rows =
    await db`UPDATE tenant SET deleted_at = now() - interval '366 days' WHERE id = ${tenant.id} AND code = ${tenant.code} AND deleted_at IS NOT NULL RETURNING id, deleted_at`;
  assert.equal(rows.length, 1);
  report.fixtureSQL.push({
    sql: "UPDATE tenant SET deleted_at=now()-interval '366 days' WHERE id=$1 AND code=$2 AND deleted_at IS NOT NULL RETURNING id,deleted_at",
    params: [tenant.id, tenant.code],
    rows: rows.length,
    deletedAt: rows[0].deleted_at,
  });
}
export async function addBusiness(db, tenant) {
  const rows =
    await db`INSERT INTO category(tenant_id,name,path,level) VALUES(${tenant.id},${tenant.code},'1',1) RETURNING id`;
  assert.equal(rows.length, 1);
  report.fixtureSQL.push({
    sql: "INSERT INTO category(tenant_id,name,path,level) VALUES($1,$2,'1',1) RETURNING id",
    params: [tenant.id, tenant.code],
    rows: rows.length,
  });
  return rows[0].id;
}
export async function removeBusiness(db, tenant) {
  const rows =
    await db`DELETE FROM category WHERE tenant_id=${tenant.id} AND name=${tenant.code} RETURNING id`;
  report.fixtureSQL.push({
    sql: 'DELETE FROM category WHERE tenant_id=$1 AND name=$2 RETURNING id',
    params: [tenant.id, tenant.code],
    rows: rows.length,
  });
  return rows.length;
}
export async function cleanup(db, before) {
  const result = {
    tenantDeletes: [],
    templateDeletes: [],
    rows: [],
    modifiedSettings: [],
    sql: [],
  };
  for (const tenant of report.resources.tenants) {
    assert.match(tenant.code, /^feidn008_[0-9]+_tenant$/);
    const actual = await db`SELECT id, code FROM tenant WHERE id=${tenant.id}`;
    if (!actual.length) {
      result.tenantDeletes.push({
        id: tenant.id,
        alreadyDeletedByAcceptance: true,
      });
      continue;
    }
    assert.equal(actual[0].code, tenant.code);
    await removeBusiness(db, tenant);
    await api('/admin/tenants/' + tenant.id + '/archive', 'POST');
    await backdate(db, tenant);
    const deleted = await request(
      '/admin/tenants/' +
        tenant.id +
        '?confirm=' +
        encodeURIComponent(tenant.code),
      'DELETE',
    );
    assert.equal(deleted.status, 204);
    result.tenantDeletes.push({ id: tenant.id, ...publicResult(deleted) });
  }
  for (const template of report.resources.templates) {
    assert.match(template.code, /^feidn008_[0-9]+_template$/);
    const deleted = await request(
      '/admin/tenant-templates/' + template.id,
      'DELETE',
    );
    assert.equal(deleted.status, 204);
    result.templateDeletes.push({ id: template.id, ...publicResult(deleted) });
  }
  await request('/auth/logout', 'POST');
  const cutoff = new Date().toISOString();
  const pruned = await db.prune({
    cutoff,
    userAgents,
    startedAt: report.startedAt,
  });
  result.rows.push(...pruned.rows);
  result.sql.push(...pruned.sql);
  const after = await baseline(db);
  assert.deepEqual(after.tenants, before.tenants);
  assert.deepEqual(after.templates, before.templates);
  assert.deepEqual(after.settings, before.settings);
  for (const audit of before.audits)
    assert.ok(after.audits.some((row) => row.id === audit.id));
  result.remaining = {
    taskTenants: 0,
    taskTemplates: 0,
    taskBusinessRows: 0,
    taskAudits: 0,
    taskSessions: 0,
    baselineTenantsPreserved: before.tenants.length,
    baselineTemplatesPreserved: before.templates.length,
    baselineAuditRecordsPreserved: before.audits.length,
    settingsUnchanged: true,
  };
  result.auditPrune = {
    cutoff,
    method:
      'audit-prune transaction-local cutoff guard plus task-specific user-agent and start time',
    reason:
      'CLI audit-prune has only an upper bound; retain unrelated audit records by adding the exact task predicate.',
  };
  return result;
}
