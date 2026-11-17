import assert from 'node:assert/strict';
import process from 'node:process';

assert.ok(globalThis.Bun?.SQL, 'Use Bun for the database fixture worker');
assert.ok(process.env.FE_IDN_009_DATABASE_URL, 'Set FE_IDN_009_DATABASE_URL');
const db = new globalThis.Bun.SQL(process.env.FE_IDN_009_DATABASE_URL);
const payload = JSON.parse(await globalThis.Bun.stdin.text());
async function baseline(sql = db) {
  return {
    menus:
      await sql`SELECT to_jsonb(m)-'created_at'-'updated_at' AS row FROM sys_menu m ORDER BY id`,
    settings:
      await sql`SELECT tenant_id,group_key,item_key,md5(value::text) AS hash FROM sys_setting ORDER BY tenant_id,group_key,item_key`,
    tenants: await sql`SELECT id,code FROM tenant ORDER BY id`,
    templates: await sql`SELECT id,code FROM tenant_template ORDER BY id`,
    audits: await sql`SELECT id FROM audit_log ORDER BY id`,
  };
}
try {
  if (process.argv[2] === 'baseline') {
    process.stdout.write(JSON.stringify(await baseline()));
  } else {
    assert.equal(process.argv[2], 'cleanup');
    const { agents, startedAt, resources, before } = payload;
    assert.equal(agents[0], 'FE-IDN-009 acceptance API');
    assert.equal(agents[1], 'FE-IDN-009 acceptance browser');
    const cutoff = new Date().toISOString();
    const result = { cutoff, rows: [], sql: [], remaining: {} };
    await db.begin(async (transaction) => {
      await transaction`SELECT set_config('commercehub.audit_prune_before',${cutoff},true)`;
      const audits =
        await transaction`DELETE FROM audit_log WHERE user_agent IN (${agents[0]},${agents[1]}) AND created_at>=${startedAt} AND created_at<${cutoff} RETURNING id`;
      const sessions =
        await transaction`DELETE FROM sys_refresh_token WHERE user_agent IN (${agents[0]},${agents[1]}) AND created_at>=${startedAt} RETURNING id`;
      result.rows.push(
        { table: 'audit_log', deleted: audits.length },
        { table: 'sys_refresh_token', deleted: sessions.length },
      );
      result.sql.push(
        {
          sql: "SELECT set_config('commercehub.audit_prune_before',$1,true)",
          params: [cutoff],
        },
        {
          sql: 'DELETE FROM audit_log WHERE user_agent IN ($1,$2) AND created_at>=$3 AND created_at<$4 RETURNING id',
          params: [...agents, startedAt, cutoff],
          rows: audits.length,
        },
        {
          sql: 'DELETE FROM sys_refresh_token WHERE user_agent IN ($1,$2) AND created_at>=$3 RETURNING id',
          params: [...agents, startedAt],
          rows: sessions.length,
        },
      );
      for (const user of resources.users) {
        assert.match(user.username, /^feidn009_[0-9]+$/);
        const history =
          await transaction`DELETE FROM password_history WHERE tenant_id=1 AND user_id=${user.id} RETURNING id`;
        const links =
          await transaction`DELETE FROM auth_token WHERE tenant_id=1 AND user_id=${user.id} RETURNING id`;
        const removed =
          await transaction`DELETE FROM sys_user WHERE tenant_id=1 AND id=${user.id} AND username=${user.username} AND deleted_at IS NOT NULL RETURNING id`;
        result.rows.push(
          { table: 'password_history', deleted: history.length },
          { table: 'auth_token', deleted: links.length },
          { table: 'sys_user', deleted: removed.length },
        );
        result.sql.push(
          {
            sql: 'DELETE FROM password_history WHERE tenant_id=1 AND user_id=$1 RETURNING id',
            params: [user.id],
            rows: history.length,
          },
          {
            sql: 'DELETE FROM auth_token WHERE tenant_id=1 AND user_id=$1 RETURNING id',
            params: [user.id],
            rows: links.length,
          },
          {
            sql: 'DELETE FROM sys_user WHERE tenant_id=1 AND id=$1 AND username=$2 AND deleted_at IS NOT NULL RETURNING id',
            params: [user.id, user.username],
            rows: removed.length,
          },
        );
        assert.equal(
          (
            await transaction`SELECT count(*)::int AS count FROM sys_user WHERE id=${user.id}`
          )[0].count,
          0,
        );
      }
      for (const product of resources.products) {
        assert.match(product.title, /^FE-IDN-009 /);
        const removed =
          await transaction`DELETE FROM product WHERE tenant_id=1 AND id=${product.id} AND title=${product.title} AND deleted_at IS NOT NULL RETURNING id`;
        result.sql.push({
          sql: 'DELETE FROM product WHERE tenant_id=1 AND id=$1 AND title=$2 AND deleted_at IS NOT NULL RETURNING id',
          params: [product.id, product.title],
          rows: removed.length,
        });
      }
      const after = await baseline(transaction);
      for (const name of ['menus', 'settings', 'tenants', 'templates'])
        assert.deepEqual(after[name], before[name], name + ' baseline changed');
      for (const audit of before.audits)
        assert.ok(after.audits.some((row) => row.id === audit.id));
      assert.equal(
        (
          await transaction`SELECT count(*)::int AS count FROM audit_log WHERE user_agent IN (${agents[0]},${agents[1]}) AND created_at>=${startedAt}`
        )[0].count,
        0,
      );
      assert.equal(
        (
          await transaction`SELECT count(*)::int AS count FROM sys_refresh_token WHERE user_agent IN (${agents[0]},${agents[1]}) AND created_at>=${startedAt}`
        )[0].count,
        0,
      );
      result.remaining = {
        taskUsers: 0,
        taskRoles: 0,
        taskProducts: 0,
        taskTemplates: 0,
        taskAudits: 0,
        taskSessions: 0,
        menusRestored: true,
        settingsUnchanged: true,
        baselineAuditRecordsPreserved: before.audits.length,
      };
    });
    process.stdout.write(JSON.stringify(result));
  }
} finally {
  await db.close();
}
