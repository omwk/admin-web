import assert from 'node:assert/strict';
import process from 'node:process';

assert.ok(globalThis.Bun?.SQL, 'Run this worker with Bun');
const dsn =
  process.env.FE_IDN_014_DATABASE_URL ||
  process.env.CH_DB_DSN ||
  process.env.TEST_DATABASE_URL;
assert.ok(dsn, 'Set FE_IDN_014_DATABASE_URL to the development database');
const db = new globalThis.Bun.SQL(dsn);
const payload = JSON.parse((await globalThis.Bun.stdin.text()) || '{}');
const stableTables = [
  'tenant',
  'sys_user',
  'sys_dept',
  'sys_role',
  'sys_menu',
  'sys_permission',
  'sys_setting',
  'channel_provider',
  'notify_template',
  'sys_user_channel',
];
async function baseline(sql = db) {
  const result = {};
  for (const table of stableTables)
    result[table] = await sql.unsafe(
      `SELECT id,md5(to_jsonb(t)::text) AS hash FROM ${table} t ORDER BY id`,
    );
  result.audit_log =
    await sql`SELECT id,md5(to_jsonb(t)::text) AS hash FROM audit_log t ORDER BY id`;
  return result;
}
try {
  if (process.argv[2] === 'bootstrap') {
    assert.match(payload.code, /^feidn014_[0-9]+$/);
    const before = await baseline();
    const hash = await globalThis.Bun.password.hash(payload.password, {
      algorithm: 'bcrypt',
      cost: 12,
    });
    const fixture = await db.begin(async (sql) => {
      const [tenant] =
        await sql`INSERT INTO tenant(code,name,status) VALUES(${payload.code},'个人通知方式验收','active') RETURNING id::int AS id,code`;
      const [dept] =
        await sql`INSERT INTO sys_dept(tenant_id,name,path,status) VALUES(${tenant.id},'验收部门','1','active') RETURNING id::int AS id`;
      await sql`INSERT INTO sys_permission(tenant_id,code,name,module,type) SELECT ${tenant.id},code,name,module,type FROM sys_permission WHERE tenant_id=1`;
      const menus =
        await sql`SELECT * FROM sys_menu WHERE tenant_id=1 ORDER BY id`;
      const mapping = new Map();
      for (const menu of menus) {
        const [copy] =
          await sql`INSERT INTO sys_menu(tenant_id,parent_id,name,type,path,component,redirect,icon,sort,visible,keep_alive,is_external,permission_code,meta,status)
          VALUES(${tenant.id},0,${menu.name},${menu.type},${menu.path},${menu.component},${menu.redirect},${menu.icon},${menu.sort},${menu.visible},${menu.keep_alive},${menu.is_external},${menu.permission_code},${JSON.stringify(menu.meta)}::jsonb,${menu.status}) RETURNING id::int AS id`;
        mapping.set(String(menu.id), copy.id);
      }
      for (const menu of menus)
        if (Number(menu.parent_id))
          await sql`UPDATE sys_menu SET parent_id=${mapping.get(String(menu.parent_id))} WHERE id=${mapping.get(String(menu.id))}`;
      const [adminRole] =
        await sql`INSERT INTO sys_role(tenant_id,code,name,data_scope,status) VALUES(${tenant.id},'acceptance_admin','验收管理员','all','active') RETURNING id::int AS id`;
      const [audienceRole] =
        await sql`INSERT INTO sys_role(tenant_id,code,name,data_scope,status) VALUES(${tenant.id},'acceptance_audience','公告验收组','all','active') RETURNING id::int AS id`;
      await sql`INSERT INTO sys_role_permission(tenant_id,role_id,permission_id) SELECT ${tenant.id},${adminRole.id},id FROM sys_permission WHERE tenant_id=${tenant.id}`;
      await sql`INSERT INTO sys_role_permission(tenant_id,role_id,permission_id) SELECT ${tenant.id},${audienceRole.id},id FROM sys_permission WHERE tenant_id=${tenant.id} AND code='system:notify:list'`;
      for (const role of [adminRole, audienceRole])
        await sql`INSERT INTO sys_role_menu(tenant_id,role_id,menu_id) SELECT ${tenant.id},${role.id},id FROM sys_menu WHERE tenant_id=${tenant.id}`;
      const users = [];
      for (const [username, nickname, superUser] of [
        ['owner', '验收管理员', true],
        ['reader', '验收读者', false],
        ['member', '验收成员', false],
      ]) {
        const [user] =
          await sql`INSERT INTO sys_user(tenant_id,username,password_hash,nickname,email,dept_id,status,is_super) VALUES(${tenant.id},${username},${hash},${nickname},${username + '@example.invalid'},${dept.id},'active',${superUser}) RETURNING id::int AS id,username`;
        await sql`INSERT INTO sys_user_role(tenant_id,user_id,role_id) VALUES(${tenant.id},${user.id},${superUser ? adminRole.id : audienceRole.id})`;
        users.push(user);
      }
      return { tenant, dept, adminRole, audienceRole, users };
    });
    process.stdout.write(JSON.stringify({ ...fixture, before }));
  } else if (process.argv[2] === 'inspect') {
    const tenant = payload.tenant;
    const notifications =
      await db`SELECT id::int AS id,target,template,payload,read_at FROM notification WHERE tenant_id=${tenant} ORDER BY id`;
    const deliveries =
      await db`SELECT id::int AS id,template_code,status,provider_id::int AS provider_id FROM notify_delivery WHERE tenant_id=${tenant} ORDER BY id`;
    process.stdout.write(JSON.stringify({ notifications, deliveries }));
  } else if (process.argv[2] === 'cleanup') {
    const { fixture, startedAt } = payload;
    assert.match(fixture.tenant.code, /^feidn014_[0-9]+$/);
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
      assert.equal(tenant.length, 1, 'Fixture tenant identity changed');
      await sql`SELECT set_config('commercehub.audit_prune_before',${cutoff},true)`;
      const audits =
        await sql`DELETE FROM audit_log WHERE tenant_id=${fixture.tenant.id} AND created_at>=${startedAt} AND created_at<${cutoff} RETURNING id`;
      result.sql.push({
        sql: 'DELETE FROM audit_log WHERE tenant_id=$1 AND created_at >= $2 AND created_at < $3 RETURNING id',
        rows: audits.length,
      });
      for (const table of [
        'notify_outbox',
        'notify_delivery',
        'notification_read',
        'notification_preference',
        'notification',
        'sys_user_channel',
        'sys_refresh_token',
        'auth_token',
        'password_history',
        'sys_user_role',
        'sys_role_menu',
        'sys_role_permission',
        'sys_role_dept',
        'sys_user',
        'sys_role',
        'sys_menu',
        'sys_permission',
        'sys_dept',
        'sys_setting',
        'channel_provider',
        'notify_template',
        'idempotency_key',
        'outbox_event',
      ]) {
        const exists =
          await sql`SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema() AND table_name=${table} AND column_name='tenant_id'`;
        if (!exists.length) continue;
        const rows = await sql.unsafe(
          `DELETE FROM ${table} WHERE tenant_id=$1 RETURNING tenant_id`,
          [fixture.tenant.id],
        );
        result.sql.push({
          sql: `DELETE FROM ${table} WHERE tenant_id=$1 RETURNING tenant_id`,
          tenantID: fixture.tenant.id,
          rows: rows.length,
        });
        const [remaining] = await sql.unsafe(
          `SELECT count(*)::int AS count FROM ${table} WHERE tenant_id=$1`,
          [fixture.tenant.id],
        );
        result.remaining[table] = remaining.count;
        assert.equal(remaining.count, 0);
      }
      const rows =
        await sql`DELETE FROM tenant WHERE id=${fixture.tenant.id} AND code=${fixture.tenant.code} RETURNING id`;
      result.sql.push({
        sql: 'DELETE FROM tenant WHERE id=$1 AND code=$2 RETURNING id',
        rows: rows.length,
      });
      for (const table of ['audit_log', 'tenant']) {
        const [remaining] = await sql.unsafe(
          `SELECT count(*)::int AS count FROM ${table} WHERE ${table === 'tenant' ? 'id' : 'tenant_id'}=$1`,
          [fixture.tenant.id],
        );
        result.remaining[table] = remaining.count;
        assert.equal(remaining.count, 0);
      }
      const after = await baseline(sql);
      for (const table of stableTables)
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
          'Original audit changed',
        );
      result.baselinePreserved = true;
      result.configurationRestored =
        'No existing settings or providers changed';
    });
    process.stdout.write(JSON.stringify(result));
  } else {
    assert.equal(process.argv[2], 'probe');
    const [info] =
      await db`SELECT current_database() AS database, current_schema() AS schema`;
    const templates =
      await db`SELECT code,name FROM notify_template WHERE tenant_id IS NULL ORDER BY code`;
    const menus =
      await db`SELECT path,component FROM sys_menu WHERE tenant_id=1 AND path LIKE '/system/notifications%' ORDER BY id`;
    const tables =
      await db`SELECT table_name FROM information_schema.tables WHERE table_schema=current_schema() AND table_name IN ('sys_user','notify_template','schema_migrations','audit_log')`;
    process.stdout.write(JSON.stringify({ info, templates, menus, tables }));
  }
} finally {
  await db.close();
}
