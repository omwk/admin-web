import assert from 'node:assert/strict';
import process from 'node:process';

assert.ok(globalThis.Bun?.SQL, 'Run the database worker with Bun');
const dsn = process.env.FE_IDN_012_DATABASE_URL;
assert.ok(dsn, 'Set FE_IDN_012_DATABASE_URL to the development database');
const db = new globalThis.Bun.SQL(dsn);
const payload = JSON.parse(await globalThis.Bun.stdin.text());
const tables = [
  'tenant',
  'sys_dept',
  'sys_user',
  'sys_role',
  'sys_menu',
  'sys_setting',
  'notify_template',
];
async function baseline(sql = db) {
  const result = {};
  for (const table of tables) {
    const key = table === 'sys_setting' ? 'tenant_id,group_key,item_key' : 'id';
    result[table] = await sql.unsafe(
      `SELECT ${key},md5(to_jsonb(t)::text) AS hash FROM ${table} t ORDER BY ${key}`,
    );
  }
  result.audit_log =
    await sql`SELECT id,md5(to_jsonb(t)::text) AS hash FROM audit_log t ORDER BY id`;
  return result;
}
try {
  if (process.argv[2] === 'bootstrap') {
    assert.match(payload.code, /^feidn012_[0-9]+$/);
    const before = await baseline();
    const hash = await globalThis.Bun.password.hash(payload.password, {
      algorithm: 'bcrypt',
      cost: 12,
    });
    const fixture = await db.begin(async (sql) => {
      const [tenant] =
        await sql`INSERT INTO tenant(code,name,status) VALUES(${payload.code},'FE-IDN-012 acceptance','active') RETURNING id::int AS id,code`;
      const [dept] =
        await sql`INSERT INTO sys_dept(tenant_id,name,path,status) VALUES(${tenant.id},'acceptance','1','active') RETURNING id::int AS id`;
      const [owner] =
        await sql`INSERT INTO sys_user(tenant_id,username,password_hash,dept_id,status,is_super) VALUES(${tenant.id},'owner',${hash},${dept.id},'active',true) RETURNING id::int AS id`;
      for (const token of payload.tokens) {
        await sql`INSERT INTO auth_token(tenant_id,user_id,purpose,token_hash,expires_at,created_by,dept_id,role_ids,max_uses)
          VALUES(${tenant.id},${token.purpose === 'reset' ? owner.id : null},${token.purpose},${token.hash},now()+interval '1 hour',${owner.id},${token.purpose === 'invite' ? dept.id : null},'[]'::jsonb,1)`;
      }
      return { tenant, dept, owner };
    });
    process.stdout.write(JSON.stringify({ ...fixture, before }));
  } else {
    assert.equal(process.argv[2], 'cleanup');
    const { fixture, startedAt } = payload;
    assert.match(fixture.tenant.code, /^feidn012_[0-9]+$/);
    const cutoff = new Date().toISOString();
    const result = {
      cutoff,
      sql: [],
      remaining: {},
      originalAuditRecords: fixture.before.audit_log.length,
    };
    await db.begin(async (sql) => {
      const tenant =
        await sql`SELECT id FROM tenant WHERE id=${fixture.tenant.id} AND code=${fixture.tenant.code} FOR UPDATE`;
      assert.equal(tenant.length, 1, 'Cleanup tenant identity changed');
      await sql`SELECT set_config('commercehub.audit_prune_before',${cutoff},true)`;
      const audits =
        await sql`DELETE FROM audit_log WHERE user_agent IN ('FE-IDN-012 acceptance browser','FE-IDN-012 acceptance API') AND created_at>=${startedAt} AND created_at<${cutoff} RETURNING id`;
      result.sql.push({
        sql: 'DELETE FROM audit_log WHERE user_agent IN ($1,$2) AND created_at >= $3 AND created_at < $4 RETURNING id',
        rows: audits.length,
      });
      for (const table of [
        'sys_refresh_token',
        'auth_token',
        'password_history',
        'sys_user_role',
        'sys_user',
        'sys_dept',
      ]) {
        const query = `DELETE FROM ${table} WHERE tenant_id=$1 RETURNING tenant_id`;
        const rows = await sql.unsafe(query, [fixture.tenant.id]);
        result.sql.push({
          sql: query,
          tenantID: fixture.tenant.id,
          rows: rows.length,
        });
        const [remaining] = await sql.unsafe(
          `SELECT count(*)::int AS count FROM ${table} WHERE tenant_id=$1`,
          [fixture.tenant.id],
        );
        assert.equal(remaining.count, 0);
        result.remaining[table] = remaining.count;
      }
      const rows =
        await sql`DELETE FROM tenant WHERE id=${fixture.tenant.id} AND code=${fixture.tenant.code} RETURNING id`;
      result.sql.push({
        sql: 'DELETE FROM tenant WHERE id=$1 AND code=$2 RETURNING id',
        tenantID: fixture.tenant.id,
        rows: rows.length,
      });
      const after = await baseline(sql);
      for (const table of tables)
        assert.deepEqual(
          after[table],
          fixture.before[table],
          table + ' baseline changed',
        );
      for (const row of fixture.before.audit_log)
        assert.ok(
          after.audit_log.some(
            (item) => item.id === row.id && item.hash === row.hash,
          ),
          'Existing audit changed',
        );
      result.baselinePreserved = true;
      result.configurationRestored = 'No existing configuration changed';
    });
    process.stdout.write(JSON.stringify(result));
  }
} finally {
  await db.close();
}
