import assert from 'node:assert/strict';
import process from 'node:process';

import { SQL } from 'bun';

const url = new URL(process.env.FE_IDN_016_DATABASE_URL);
assert.match(
  url.searchParams.get('search_path') || '',
  /^feidn016_runtime_\d+$/,
);
const db = new SQL(url.href);
const payload = JSON.parse((await Bun.stdin.text()) || '{}');
try {
  if (process.argv[2] === 'reader') {
    const hash = await Bun.password.hash(payload.password, {
      algorithm: 'bcrypt',
      cost: 12,
    });
    const result = await db.begin(async (sql) => {
      const [role] =
        await sql`INSERT INTO sys_role(tenant_id,code,name,data_scope,status) VALUES(1,'feidn016_reader','存储验收只读用户','self','active') RETURNING id::int AS id`;
      const [dept] =
        await sql`SELECT id FROM sys_dept WHERE tenant_id=1 ORDER BY id LIMIT 1`;
      const [user] =
        await sql`INSERT INTO sys_user(tenant_id,username,password_hash,nickname,dept_id,status,is_super) VALUES(1,'feidn016_reader',${hash},'存储验收只读用户',${dept.id},'active',false) RETURNING id::int AS id,username`;
      await sql`INSERT INTO sys_user_role(tenant_id,user_id,role_id) VALUES(1,${user.id},${role.id})`;
      for (const id of payload.menus)
        await sql`INSERT INTO sys_role_menu(tenant_id,role_id,menu_id) VALUES(1,${role.id},${id})`;
      return { user, role };
    });
    console.log(JSON.stringify(result));
  } else if (process.argv[2] === 'objects') {
    const objects =
      await db`SELECT id::int,object_key,bucket,provider_id::int FROM file_object ORDER BY id`;
    const pending =
      await db`SELECT count(*)::int AS count FROM outbox_event WHERE event_type='file.cleanup' AND status<>'sent'`;
    console.log(JSON.stringify({ objects, pending: pending[0].count }));
  } else if (process.argv[2] === 'cleanup') {
    const report = { sql: [], remaining: {} };
    await db.begin(async (sql) => {
      for (const table of [
        'sys_user_role',
        'sys_role_menu',
        'sys_role_permission',
        'sys_role_dept',
      ]) {
        const rows = await sql.unsafe(
          `DELETE FROM ${table} WHERE role_id=$1 RETURNING role_id`,
          [payload.role],
        );
        report.sql.push({
          sql: `DELETE FROM ${table} WHERE role_id=$1 RETURNING role_id`,
          parameters: [payload.role],
          rows: rows.length,
        });
      }
      for (const [table, column, id] of [
        ['sys_refresh_token', 'user_id', payload.user],
        ['sys_user', 'id', payload.user],
        ['sys_role', 'id', payload.role],
      ]) {
        const rows = await sql.unsafe(
          `DELETE FROM ${table} WHERE ${column}=$1 RETURNING ${column}`,
          [id],
        );
        report.sql.push({
          sql: `DELETE FROM ${table} WHERE ${column}=$1 RETURNING ${column}`,
          parameters: [id],
          rows: rows.length,
        });
      }
      const events =
        await sql`DELETE FROM outbox_event WHERE event_type='file.cleanup' AND status='sent' RETURNING id`;
      report.sql.push({
        sql: "DELETE FROM outbox_event WHERE event_type='file.cleanup' AND status='sent' RETURNING id",
        rows: events.length,
      });
      for (const table of ['storage_provider', 'file_object']) {
        const [count] = await sql.unsafe(
          `SELECT count(*)::int AS count FROM ${table}`,
        );
        report.remaining[table] = count.count;
        assert.equal(count.count, 0);
      }
    });
    console.log(JSON.stringify(report));
  } else throw new Error('Unknown operation');
} finally {
  await db.close();
}
