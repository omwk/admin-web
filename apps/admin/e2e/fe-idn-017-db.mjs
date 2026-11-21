import assert from 'node:assert/strict';
import process from 'node:process';

import { SQL } from 'bun';

const url = new URL(process.env.FE_IDN_017_DATABASE_URL);
assert.match(
  url.searchParams.get('search_path') || '',
  /^feidn017_runtime_\d+$/,
);
const db = new SQL(url.href);
const payload = JSON.parse((await Bun.stdin.text()) || '{}');
try {
  if (process.argv[2] === 'menu') {
    const [original] =
      await db`SELECT component FROM sys_menu WHERE id=${payload.id} AND path='/system/files'`;
    const rows =
      await db`UPDATE sys_menu SET component='system/files/index' WHERE id=${payload.id} AND path='/system/files' RETURNING id::int`;
    assert.equal(rows.length, 1);
    console.log(
      JSON.stringify({
        sql: "UPDATE sys_menu SET component='system/files/index' WHERE id=$1 AND path='/system/files' RETURNING id",
        id: payload.id,
        originalComponent: original.component,
        rows: rows.length,
        reason:
          'Existing registry full-path format; shorthand resolver belongs to FE-IDN-018',
      }),
    );
  } else if (process.argv[2] === 'restore-menu') {
    const rows =
      await db`UPDATE sys_menu SET component=${payload.originalComponent} WHERE id=${payload.id} AND path='/system/files' RETURNING id`;
    assert.equal(rows.length, 1);
    console.log(
      JSON.stringify({
        sql: 'UPDATE sys_menu SET component=$1 WHERE id=$2 RETURNING id',
        rows: rows.length,
        id: payload.id,
        restored: true,
      }),
    );
  } else if (process.argv[2] === 'objects') {
    const [pending] =
      await db`SELECT count(*)::int AS count FROM outbox_event WHERE event_type='file.cleanup' AND status<>'sent'`;
    const [files] = await db`SELECT count(*)::int AS count FROM file_object`;
    console.log(JSON.stringify({ pending: pending.count, files: files.count }));
  } else {
    assert.equal(process.argv[2], 'cleanup');
    const events =
      await db`DELETE FROM outbox_event WHERE event_type='file.cleanup' AND status='sent' RETURNING id`;
    const remaining = {};
    for (const table of ['storage_provider', 'file_object']) {
      const [count] = await db.unsafe(
        `SELECT count(*)::int AS count FROM ${table}`,
      );
      remaining[table] = count.count;
      assert.equal(count.count, 0);
    }
    console.log(
      JSON.stringify({
        sql: [
          {
            sql: "DELETE FROM outbox_event WHERE event_type='file.cleanup' AND status='sent' RETURNING id",
            rows: events.length,
          },
        ],
        remaining,
      }),
    );
  }
} finally {
  await db.close();
}
