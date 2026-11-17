import assert from 'node:assert/strict';
import process from 'node:process';

assert.ok(globalThis.Bun?.SQL, 'Use Bun for this database worker');
assert.ok(process.env.FE_IDN_010_DATABASE_URL, 'Set FE_IDN_010_DATABASE_URL');
const db = new globalThis.Bun.SQL(process.env.FE_IDN_010_DATABASE_URL);
const payload = JSON.parse(await globalThis.Bun.stdin.text());
async function baseline(sql = db) {
  return {
    users: await sql`SELECT id FROM sys_user ORDER BY id`,
    providers:
      await sql`SELECT id,md5(to_jsonb(p)::text) AS hash FROM channel_provider p ORDER BY id`,
    settings:
      await sql`SELECT tenant_id,group_key,item_key,md5(value::text) AS hash FROM sys_setting ORDER BY tenant_id,group_key,item_key`,
    menus:
      await sql`SELECT id,md5(to_jsonb(m)::text) AS hash FROM sys_menu m ORDER BY id`,
    tenants: await sql`SELECT id FROM tenant ORDER BY id`,
    templates: await sql`SELECT id FROM tenant_template ORDER BY id`,
    roles: await sql`SELECT id FROM sys_role ORDER BY id`,
    audits: await sql`SELECT id FROM audit_log ORDER BY id`,
  };
}
try {
  if (process.argv[2] === 'bootstrap') {
    const before = await baseline();
    const { username, password } = payload;
    assert.match(username, /^feidn010_[0-9]+$/);
    const hash = await globalThis.Bun.password.hash(password, {
      algorithm: 'bcrypt',
      cost: 12,
    });
    const user = await db.begin(async (sql) => {
      const rows =
        await sql`INSERT INTO sys_user(tenant_id,username,password_hash,nickname,dept_id,status,is_super)
        SELECT tenant_id,${username},${hash},'渠道表单验收',dept_id,'active',true
        FROM sys_user WHERE tenant_id=1 AND username='admin' AND deleted_at IS NULL
        RETURNING id,tenant_id,username`;
      assert.equal(rows.length, 1);
      await sql`INSERT INTO sys_user_role(tenant_id,user_id,role_id)
        SELECT tenant_id,${rows[0].id},role_id FROM sys_user_role
        WHERE user_id=(SELECT id FROM sys_user WHERE tenant_id=1 AND username='admin' AND deleted_at IS NULL)`;
      return rows[0];
    });
    process.stdout.write(JSON.stringify({ before, user }));
  } else {
    assert.equal(process.argv[2], 'cleanup');
    const { agents, startedAt, before, user, prefix } = payload;
    assert.match(user.username, /^feidn010_[0-9]+$/);
    assert.equal(agents[0], 'FE-IDN-010 acceptance API');
    assert.equal(agents[1], 'FE-IDN-010 acceptance browser');
    const cutoff = new Date().toISOString();
    const result = { cutoff, sql: [], remaining: {} };
    await db.begin(async (sql) => {
      await sql`SELECT set_config('commercehub.audit_prune_before',${cutoff},true)`;
      result.sql.push({
        sql: "SELECT set_config('commercehub.audit_prune_before',$1,true)",
        params: [cutoff],
      });
      const queries = [
        [
          'DELETE FROM audit_log WHERE user_agent IN ($1,$2) AND created_at>=$3 AND created_at<$4 RETURNING id',
          [...agents, startedAt, cutoff],
        ],
        [
          'DELETE FROM sys_refresh_token WHERE user_id=$1 AND user_agent IN ($2,$3) AND created_at>=$4 RETURNING id',
          [user.id, ...agents, startedAt],
        ],
        [
          'DELETE FROM password_history WHERE tenant_id=1 AND user_id=$1 RETURNING id',
          [user.id],
        ],
        [
          'DELETE FROM auth_token WHERE tenant_id=1 AND (user_id=$1 OR created_by=$1) RETURNING id',
          [user.id],
        ],
        [
          'DELETE FROM sys_user_role WHERE tenant_id=1 AND user_id=$1 RETURNING role_id',
          [user.id],
        ],
        [
          'DELETE FROM sys_user WHERE tenant_id=1 AND id=$1 AND username=$2 RETURNING id',
          [user.id, user.username],
        ],
      ];
      for (const [query, params] of queries) {
        const rows = await sql.unsafe(query, params);
        result.sql.push({ sql: query, params, rows: rows.length });
      }
      const after = await baseline(sql);
      for (const key of [
        'users',
        'providers',
        'settings',
        'menus',
        'tenants',
        'templates',
        'roles',
      ])
        assert.deepEqual(after[key], before[key], key + ' baseline changed');
      for (const row of before.audits)
        assert.ok(after.audits.some((audit) => audit.id === row.id));
      const remaining = {
        users:
          await sql`SELECT count(*)::int AS count FROM sys_user WHERE username=${user.username}`,
        providers:
          await sql`SELECT count(*)::int AS count FROM channel_provider WHERE name LIKE ${prefix + '%'}`,
        audits:
          await sql`SELECT count(*)::int AS count FROM audit_log WHERE user_agent IN (${agents[0]},${agents[1]}) AND created_at>=${startedAt}`,
        sessions:
          await sql`SELECT count(*)::int AS count FROM sys_refresh_token WHERE user_id=${user.id}`,
      };
      for (const [key, rows] of Object.entries(remaining)) {
        assert.equal(rows[0].count, 0, key + ' leftovers');
        result.remaining[key] = 0;
      }
      result.baselinePreserved = true;
      result.baselineAuditRecordsPreserved = before.audits.length;
    });
    process.stdout.write(JSON.stringify(result));
  }
} finally {
  await db.close();
}
