import assert from 'node:assert/strict';
import process from 'node:process';

assert.ok(globalThis.Bun?.SQL, 'Database fixture worker requires Bun');
assert.ok(process.env.FE_IDN_008_DATABASE_URL, 'Set FE_IDN_008_DATABASE_URL');
const db = new globalThis.Bun.SQL(process.env.FE_IDN_008_DATABASE_URL);
const payload = JSON.parse(await globalThis.Bun.stdin.text());
try {
  if (process.argv[2] === 'query') {
    const rows = await db.unsafe(payload.statement, payload.values);
    process.stdout.write(JSON.stringify(rows));
  } else {
    assert.equal(process.argv[2], 'prune');
    const { cutoff, userAgents, startedAt } = payload;
    const report = { startedAt };
    const result = { rows: [], sql: [] };
    await db.begin(async (transaction) => {
      const preserved =
        await transaction`SELECT id FROM audit_log WHERE NOT (user_agent IN (${userAgents[0]},${userAgents[1]}) AND created_at>=${report.startedAt}) ORDER BY id`;
      await transaction`SELECT set_config('commercehub.audit_prune_before',${cutoff},true)`;
      const audits =
        await transaction`DELETE FROM audit_log WHERE user_agent IN (${userAgents[0]},${userAgents[1]}) AND created_at>=${report.startedAt} AND created_at<${cutoff} RETURNING id`;
      const sessions =
        await transaction`DELETE FROM sys_refresh_token WHERE user_agent IN (${userAgents[0]},${userAgents[1]}) AND created_at>=${report.startedAt} RETURNING id`;
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
          params: [...userAgents, report.startedAt, cutoff],
          rows: audits.length,
        },
        {
          sql: 'DELETE FROM sys_refresh_token WHERE user_agent IN ($1,$2) AND created_at>=$3 RETURNING id',
          params: [...userAgents, report.startedAt],
          rows: sessions.length,
        },
      );
      assert.deepEqual(
        await transaction`SELECT id FROM audit_log ORDER BY id`,
        preserved,
      );
      assert.equal(
        (
          await transaction`SELECT count(*)::int AS count FROM audit_log WHERE user_agent IN (${userAgents[0]},${userAgents[1]}) AND created_at>=${report.startedAt}`
        )[0].count,
        0,
      );
      assert.equal(
        (
          await transaction`SELECT count(*)::int AS count FROM sys_refresh_token WHERE user_agent IN (${userAgents[0]},${userAgents[1]}) AND created_at>=${report.startedAt}`
        )[0].count,
        0,
      );
    });

    process.stdout.write(JSON.stringify(result));
  }
} finally {
  await db.close();
}
