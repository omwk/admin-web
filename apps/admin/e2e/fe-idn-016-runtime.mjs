import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { RedisClient, spawn, SQL } from 'bun';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const backendRoot =
  process.env.FE_IDN_016_BACKEND_ROOT ||
  fileURLToPath(new URL('../../../../go-admin-api/', import.meta.url));
const output = `${root}/docs/evidence/fe-idn-016`;
const temporary = `${root}/.temp/fe-idn-016`;
const schema = 'feidn016_runtime_' + Date.now();
assert.match(schema, /^feidn016_runtime_\d+$/);
const sourceDSN = process.env.CH_DB_DSN || process.env.TEST_DATABASE_URL;
assert.ok(sourceDSN, 'Load the backend development environment');
const source = new SQL(sourceDSN);
const url = new URL(sourceDSN);
url.searchParams.set('search_path', schema);
const database = new SQL(url.href);
const redisAddress = process.env.CH_REDIS_ADDR || '127.0.0.1:16379';
const redisPassword = process.env.CH_REDIS_PASSWORD || '';
const redisDB = Number(process.env.FE_IDN_016_REDIS_DB || 14);
const redis = new RedisClient(
  `redis://${redisPassword ? ':' + encodeURIComponent(redisPassword) + '@' : ''}${redisAddress}/${redisDB}`,
);
const origin = process.env.FE_IDN_016_ORIGIN || 'http://127.0.0.1:5667';
const env = {
  ...process.env,
  CH_CONFIG_PATH: '',
  CH_DB_DSN: url.href,
  CH_REDIS_ADDR: redisAddress,
  CH_REDIS_DB: String(redisDB),
  CH_JWT_SECRET: randomBytes(32).toString('hex'),
  CH_APP_HTTP_ADDR: '127.0.0.1:18081',
  CH_SEED_ADMIN_PASSWORD: 'Acceptance@' + randomBytes(16).toString('hex'),
  FE_IDN_016_DATABASE_URL: url.href,
  FE_IDN_016_BACKEND: 'http://127.0.0.1:18081',
  FE_IDN_016_ORIGIN: origin,
};
const report = {
  task: 'FE-IDN-016',
  schema,
  origin,
  backend: env.FE_IDN_016_BACKEND,
  redisDB,
  startedAt: new Date().toISOString(),
  commands: [],
};
const children = [];
let before;
let failed = false;
let ownsRedis = false;
let ownsSchema = false;
const stableTables = [
  'tenant',
  'sys_user',
  'sys_role',
  'sys_menu',
  'sys_permission',
  'sys_dept',
  'sys_setting',
  'channel_provider',
  'notify_template',
  'storage_provider',
  'file_object',
];
async function baseline() {
  const data = {};
  for (const table of stableTables)
    data[table] = await source.unsafe(
      `SELECT id,md5(to_jsonb(t)::text) AS hash FROM public.${table} t ORDER BY id`,
    );
  return data;
}
async function command(binary, args, name, cwd = backendRoot) {
  const child = spawn([binary, ...args], {
    cwd,
    env,
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [out, err, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  await writeFile(`${temporary}/${name}.log`, out + err);
  if (['audit-prune', 'browser'].includes(name))
    await writeFile(`${output}/${name}.txt`, out + err);
  report.commands.push({ name, code });
  assert.equal(code, 0, `${name} failed; inspect the local runtime log`);
  console.log(`${name}: passed`);
}
async function ready(address) {
  for (let attempt = 0; attempt < 120; attempt++) {
    assert.ok(
      children.every((child) => child.exitCode === null),
      'Owned process exited before readiness',
    );
    try {
      const response = await fetch(address);
      if (response.ok || response.status === 401) return;
    } catch {}
    await Bun.sleep(250);
  }
  throw new Error('Owned service failed readiness');
}
try {
  await mkdir(temporary, { recursive: true });
  await mkdir(output, { recursive: true });
  for (const binary of ['api', 'cli', 'worker'])
    await command(
      'go',
      ['build', '-o', `${temporary}/${binary}.exe`, `./cmd/${binary}`],
      `build-${binary}`,
    );
  before = await baseline();
  report.originalPublicRows = Object.fromEntries(
    Object.entries(before).map(([name, rows]) => [name, rows.length]),
  );
  report.originalAudits =
    await source`SELECT id,md5(to_jsonb(t)::text) AS hash FROM public.audit_log t ORDER BY id`;
  report.redisInitialKeys = await redis.send('DBSIZE', []);
  assert.equal(
    report.redisInitialKeys,
    0,
    'The selected Redis DB must be empty before exclusive use',
  );
  ownsRedis = true;
  await source.unsafe(`CREATE SCHEMA ${schema}`);
  ownsSchema = true;
  await command(`${temporary}/cli.exe`, ['migrate', 'up'], 'migrate');
  await command(`${temporary}/cli.exe`, ['seed'], 'seed');
  const [provider] =
    await source`SELECT id FROM public.storage_provider WHERE enabled ORDER BY is_default DESC,id LIMIT 1`;
  assert.ok(
    provider,
    'A configured real MinIO provider is required in the development database',
  );
  // Keep encryption AAD intact; plaintext credentials never leave process memory.
  await database.unsafe(
    `INSERT INTO storage_provider SELECT * FROM public.storage_provider WHERE id=$1`,
    [provider.id],
  );
  await database`UPDATE storage_provider SET is_default=false`;
  await database`SELECT setval(pg_get_serial_sequence('storage_provider','id'),(SELECT max(id) FROM storage_provider))`;
  for (const program of ['api', 'worker']) {
    const log = Bun.file(`${temporary}/${program}.log`);
    children.push(
      spawn([`${temporary}/${program}.exe`], {
        cwd: backendRoot,
        env,
        stdout: log,
        stderr: log,
      }),
    );
  }
  await ready(env.FE_IDN_016_BACKEND + '/healthz');
  children.push(
    spawn(
      [
        'node',
        `${root}/node_modules/vite/bin/vite.js`,
        'preview',
        '--host',
        '127.0.0.1',
        '--port',
        new URL(origin).port,
        '--strictPort',
      ],
      {
        cwd: `${root}/apps/admin`,
        env,
        stdout: Bun.file(`${temporary}/preview.log`),
        stderr: Bun.file(`${temporary}/preview-error.log`),
      },
    ),
  );
  await ready(origin);
  await command('node', ['apps/admin/e2e/fe-idn-016.mjs'], 'browser', root);
} catch (error) {
  failed = true;
  report.failure = error.message;
  console.error(error.message);
} finally {
  // The browser helper API-deletes files and waits for real object cleanup first.
  for (const child of children) child.kill();
  report.processExitResults = await Promise.all(
    children.map((child) => child.exited),
  );
  report.ownedProcessesStopped = true;
  if (ownsSchema) {
    await command(
      `${temporary}/cli.exe`,
      ['audit-prune', '--before', new Date().toISOString()],
      'audit-prune',
    );
    const rows =
      await database`SELECT table_name FROM information_schema.tables WHERE table_schema=current_schema() AND table_type='BASE TABLE'`;
    report.ownedSchemaRowsBeforeDrop = {};
    for (const { table_name: table } of rows) {
      assert.match(table, /^[a-z_][a-z_0-9]*$/);
      const [count] = await database.unsafe(
        `SELECT count(*)::int AS count FROM ${table}`,
      );
      report.ownedSchemaRowsBeforeDrop[table] = count.count;
    }
    await source.unsafe(`DROP SCHEMA ${schema} CASCADE`);
    report.schemaCleanupSQL = `DROP SCHEMA ${schema} CASCADE`;
    const [remaining] =
      await source`SELECT count(*)::int AS count FROM information_schema.schemata WHERE schema_name=${schema}`;
    report.remainingSchemas = remaining.count;
    assert.equal(remaining.count, 0);
  }
  if (ownsRedis) {
    report.redisKeysDeleted = await redis.send('DBSIZE', []);
    await redis.send('FLUSHDB', []);
    report.remainingRedisKeys = await redis.send('DBSIZE', []);
    assert.equal(report.remainingRedisKeys, 0);
  }
  if (before) {
    assert.deepEqual(
      await baseline(),
      before,
      'Original public development data changed',
    );
    report.originalDevelopmentDataPreserved = true;
    const audits =
      await source`SELECT id,md5(to_jsonb(t)::text) AS hash FROM public.audit_log t ORDER BY id`;
    for (const original of report.originalAudits)
      assert.ok(
        audits.some(
          (row) => row.id === original.id && row.hash === original.hash,
        ),
      );
    report.originalAuditDataPreserved = true;
  }
  report.finishedAt = new Date().toISOString();
  await writeFile(
    `${output}/runtime.json`,
    JSON.stringify(report, null, 2) + '\n',
  );
  await source.close();
  await database.close();
  redis.close();
}
process.exit(failed ? 1 : 0);
