import assert from 'node:assert/strict';
import process from 'node:process';

assert.ok(globalThis.Bun?.SQL, 'Run this worker with Bun');
const dsn =
  process.env.FE_IDN_011_DATABASE_URL || process.env.TEST_DATABASE_URL;
assert.ok(dsn, 'Set FE_IDN_011_DATABASE_URL to the local development database');
const db = new globalThis.Bun.SQL(dsn);
const payload = JSON.parse(await globalThis.Bun.stdin.text());
const agents = ['FE-IDN-011 acceptance API', 'FE-IDN-011 acceptance browser'];
async function baseline(sql = db) {
  const result = {};
  for (const table of [
    'sys_user',
    'channel_provider',
    'sys_setting',
    'sys_menu',
    'tenant',
    'sys_role',
    'notify_template',
    'notify_delivery',
    'notify_outbox',
  ]) {
    const key = table === 'sys_setting' ? 'tenant_id,group_key,item_key' : 'id';
    result[table] = await sql.unsafe(
      `SELECT ${key},md5(to_jsonb(t)::text) AS hash FROM ${table} t ORDER BY ${key}`,
    );
  }
  result.audit_log = await sql`SELECT id FROM audit_log ORDER BY id`;
  return result;
}
try {
  if (process.argv[2] === 'probe') {
    const states =
      await db`SELECT status,count(*)::int AS count FROM notify_delivery GROUP BY status ORDER BY status`;
    const stalled =
      await db`SELECT id FROM notify_delivery WHERE tenant_id=1 AND status='pending' AND attempts=0 AND created_at<now()-interval '5 minutes'`;
    const audits = await db`SELECT count(*)::int AS count FROM audit_log`;
    const remaining = {};
    for (const [name, query] of [
      [
        'users',
        "SELECT count(*)::int AS count FROM sys_user WHERE username ~ '^feidn011_[0-9]+$'",
      ],
      [
        'templates',
        "SELECT count(*)::int AS count FROM notify_template WHERE code ~ '^feidn011_[0-9]+[.]'",
      ],
      [
        'deliveries',
        "SELECT count(*)::int AS count FROM notify_delivery WHERE template_code ~ '^feidn011_[0-9]+[.]'",
      ],
      [
        'outboxes',
        "SELECT count(*)::int AS count FROM notify_outbox WHERE template_code ~ '^feidn011_[0-9]+[.]'",
      ],
      [
        'audits',
        "SELECT count(*)::int AS count FROM audit_log WHERE user_agent LIKE 'FE-IDN-011 acceptance %'",
      ],
    ]) {
      const rows = await db.unsafe(query);
      remaining[name] = rows[0].count;
    }
    process.stdout.write(
      JSON.stringify({
        states,
        stalled,
        auditCount: audits[0].count,
        remaining,
      }),
    );
  } else if (process.argv[2] === 'bootstrap') {
    const { username, password } = payload;
    assert.match(username, /^feidn011_[0-9]+$/);
    const before = await baseline();
    const existingStalled =
      await db`SELECT id FROM notify_delivery WHERE tenant_id=1 AND status='pending' AND attempts=0 AND created_at<now()-interval '5 minutes'`;
    assert.equal(
      existingStalled.length,
      0,
      'Existing stalled records: use an isolated development instance before testing global requeue',
    );
    const hash = await globalThis.Bun.password.hash(password, {
      algorithm: 'bcrypt',
      cost: 12,
    });
    const fixture = await db.begin(async (sql) => {
      const users =
        await sql`INSERT INTO sys_user(tenant_id,username,password_hash,nickname,dept_id,status,is_super)
        SELECT tenant_id,${username},${hash},'投递记录验收',dept_id,'active',true FROM sys_user
        WHERE tenant_id=1 AND username='admin' AND deleted_at IS NULL RETURNING id::int AS id,tenant_id::int AS tenant_id,username`;
      assert.equal(users.length, 1);
      const user = users[0];
      await sql`INSERT INTO sys_user_role(tenant_id,user_id,role_id)
        SELECT tenant_id,${user.id},role_id FROM sys_user_role
        WHERE user_id=(SELECT id FROM sys_user WHERE tenant_id=1 AND username='admin' AND deleted_at IS NULL)`;
      const templates = [];
      for (const [suffix, subject] of [
        ['verify', '身份验证（验收）'],
        ['order', '订单通知（验收）'],
      ]) {
        const rows =
          await sql`INSERT INTO notify_template(tenant_id,code,locale,subject,body,format)
          VALUES(1,${username + '.' + suffix},'zh-CN',${subject},'验收消息','text') RETURNING id::int AS id,code,subject`;
        templates.push(rows[0]);
      }
      const specs = [
        [
          'failed',
          'email',
          'a***@example.invalid',
          1,
          'message_unavailable',
          0,
          0,
        ],
        ['skipped', 'sms', '138****8000', 0, 'recipient_unavailable', 0, 0],
        ['sent', 'email', null, 1, '', 0, 0],
        ['pending', 'email', 'b***@example.invalid', 0, '', 0, 0],
        ['pending', 'email', 'c***@example.invalid', 0, '', 6, 0],
        ['pending', 'sms', '139****9000', 0, '', 7, 0],
        ['failed', 'sms', '137****7000', 1, 'provider_timeout', 0, 1],
        ['pending', 'email', 'd***@example.invalid', 1, '', 6, 0],
      ];
      const deliveries = [];
      for (const [
        status,
        channel,
        mask,
        attempts,
        error,
        minutes,
        template,
      ] of specs) {
        const created = new Date(Date.now() - minutes * 60_000).toISOString();
        const code = templates[template].code;
        const rows =
          await sql`INSERT INTO notify_delivery(tenant_id,channel,template_code,recipient_masked,status,attempts,last_error,created_at)
          VALUES(1,${channel},${code},${mask},${status},${attempts},${error},${created}) RETURNING id::int AS id,status,channel,template_code,recipient_masked,created_at,attempts`;
        // Keep synthetic, recipient-free outboxes out of the running worker until an explicit retry.
        await sql`INSERT INTO notify_outbox(id,tenant_id,channel,template_code,payload,status)
          VALUES(${rows[0].id},1,${channel},${code},'{}'::jsonb,${status === 'sent' ? 'sent' : 'failed'})`;
        deliveries.push(rows[0]);
      }
      return { user, templates, deliveries };
    });
    process.stdout.write(JSON.stringify({ before, ...fixture }));
  } else if (process.argv[2] === 'inspect') {
    const ids = payload.ids;
    const rows =
      await db`SELECT d.id,d.status,d.attempts,o.status AS outbox_status
      FROM notify_delivery d JOIN notify_outbox o USING(id) WHERE d.id IN ${db(ids)} ORDER BY d.id`;
    process.stdout.write(JSON.stringify(rows));
  } else {
    assert.equal(process.argv[2], 'cleanup');
    const { fixture, startedAt } = payload;
    const { user, templates, deliveries, before } = fixture;
    assert.match(user.username, /^feidn011_[0-9]+$/);
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
      ];
      for (const row of deliveries) {
        queries.push([
          'DELETE FROM notify_outbox WHERE tenant_id=1 AND id=$1 AND template_code=$2 RETURNING id',
          [row.id, row.template_code],
        ]);
        queries.push([
          'DELETE FROM notify_delivery WHERE tenant_id=1 AND id=$1 AND template_code=$2 RETURNING id',
          [row.id, row.template_code],
        ]);
      }
      for (const template of templates)
        queries.push([
          'DELETE FROM notify_template WHERE tenant_id=1 AND id=$1 AND code=$2 RETURNING id',
          [template.id, template.code],
        ]);
      queries.push([
        'DELETE FROM sys_user_role WHERE tenant_id=1 AND user_id=$1 RETURNING role_id',
        [user.id],
      ]);
      queries.push([
        'DELETE FROM sys_user WHERE tenant_id=1 AND id=$1 AND username=$2 RETURNING id',
        [user.id, user.username],
      ]);
      for (const [query, params] of queries) {
        const rows = await sql.unsafe(query, params);
        result.sql.push({ sql: query, params, rows: rows.length });
      }
      const after = await baseline(sql);
      for (const [table, rows] of Object.entries(before || {})) {
        if (table === 'audit_log') {
          for (const row of rows)
            assert.ok(
              after[table].some((item) => item.id === row.id),
              'Existing audit removed',
            );
        } else
          assert.deepEqual(after[table], rows, table + ' baseline changed');
      }
      for (const [name, query, params] of [
        [
          'users',
          'SELECT count(*)::int AS count FROM sys_user WHERE username=$1',
          [user.username],
        ],
        [
          'templates',
          'SELECT count(*)::int AS count FROM notify_template WHERE code LIKE $1',
          [user.username + '.%'],
        ],
        [
          'deliveries',
          'SELECT count(*)::int AS count FROM notify_delivery WHERE template_code LIKE $1',
          [user.username + '.%'],
        ],
        [
          'outboxes',
          'SELECT count(*)::int AS count FROM notify_outbox WHERE template_code LIKE $1',
          [user.username + '.%'],
        ],
        [
          'sessions',
          'SELECT count(*)::int AS count FROM sys_refresh_token WHERE user_id=$1',
          [user.id],
        ],
        [
          'audits',
          'SELECT count(*)::int AS count FROM audit_log WHERE user_agent IN ($1,$2) AND created_at>=$3',
          [...agents, startedAt],
        ],
      ]) {
        const rows = await sql.unsafe(query, params);
        assert.equal(rows[0].count, 0, name + ' leftovers');
        result.remaining[name] = rows[0].count;
      }
      result.baselinePreserved = Boolean(before);
      result.baselineAuditRecordsPreserved = before?.audit_log.length;
    });
    process.stdout.write(JSON.stringify(result));
  }
} finally {
  await db.close();
}
