import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { RedisClient, spawn, SQL } from 'bun';

const backendRoot =
  process.env.FE_IDN_015_BACKEND_ROOT ||
  fileURLToPath(new URL('../../../../go-admin-api/', import.meta.url));
const root = fileURLToPath(new URL('../../../', import.meta.url)).replace(
  /\/$/,
  '',
);
const appRoot = fileURLToPath(new URL('../', import.meta.url));
const origin = process.env.FE_IDN_015_ORIGIN || 'http://127.0.0.1:5667';
const schema = 'feidn015_runtime_' + Date.now();
assert.match(schema, /^feidn015_runtime_\d+$/);
const sourceDSN = process.env.CH_DB_DSN || process.env.TEST_DATABASE_URL;
assert.ok(sourceDSN);
const url = new URL(sourceDSN);
url.searchParams.set('search_path', schema);
const dsn = url.href;
const database = new SQL(sourceDSN);
const password = process.env.CH_REDIS_PASSWORD || '';
const redis = new RedisClient(
  'redis://' +
    (password ? ':' + encodeURIComponent(password) + '@' : '') +
    '127.0.0.1:16379/15',
  { connectionTimeout: 3000 },
);
const env = {
  ...process.env,
  CH_CONFIG_PATH: '',
  CH_DB_DSN: dsn,
  CH_REDIS_ADDR: '127.0.0.1:16379',
  CH_REDIS_DB: '15',
  CH_REDIS_PASSWORD: '',
  CH_JWT_SECRET: randomBytes(32).toString('hex'),
  CH_APP_HTTP_ADDR: '127.0.0.1:18081',
  CH_APP_PUBLIC_URL: origin,
  CH_SEED_ADMIN_PASSWORD: 'Acceptance@' + randomBytes(16).toString('hex'),
  FE_IDN_015_BACKEND: 'http://127.0.0.1:18081',
  FE_IDN_015_DATABASE_URL: dsn,
  FE_IDN_015_ORIGIN: origin,
  FE_IDN_015_HISTORY: 'hash',
};
const evidence = {
  schema,
  backend: env.FE_IDN_015_BACKEND,
  origin,
  history: 'hash',
  redisDB: 15,
  commands: [],
  startedAt: new Date().toISOString(),
};
const processes = [];
let ownsSchema = false;
let ownsRedis = false;
let failed = false;
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
  await writeFile(`${root}/.temp/fe-idn-015/${name}.log`, out + err);
  if (['audit-prune', 'browser'].includes(name))
    await writeFile(`${root}/docs/evidence/fe-idn-015/${name}.txt`, out + err);
  evidence.commands.push({ name, code });
  assert.equal(code, 0, name + ' failed (see local runtime log)');
  console.log(name + ': passed');
}
async function baseline() {
  const result = {};
  for (const table of [
    'tenant',
    'sys_user',
    'sys_role',
    'sys_menu',
    'sys_permission',
    'sys_dept',
    'sys_setting',
    'channel_provider',
    'notify_template',
    'sys_user_channel',
  ])
    result[table] = await database.unsafe(
      `SELECT id,md5(to_jsonb(t)::text) AS hash FROM public.${table} t ORDER BY id`,
    );
  return result;
}
let before;
try {
  await mkdir(`${root}/.temp/fe-idn-015`, { recursive: true });
  for (const binary of ['api', 'cli', 'worker'])
    await command(
      'go',
      [
        'build',
        '-o',
        `${root}/.temp/fe-idn-015/${binary}.exe`,
        `./cmd/${binary}`,
      ],
      `build-${binary}`,
    );
  before = await baseline();
  const [info] = await database`SELECT current_database() AS database`;
  evidence.database = info.database;
  evidence.redisInitialKeys = await redis.send('DBSIZE', []);
  assert.equal(
    evidence.redisInitialKeys,
    0,
    'Redis DB15 must be empty before exclusive acceptance use',
  );
  ownsRedis = true;
  await database.unsafe(`CREATE SCHEMA ${schema}`);
  ownsSchema = true;
  await command(
    `${root}/.temp/fe-idn-015/cli.exe`,
    ['migrate', 'up'],
    'migrate',
  );
  await command(`${root}/.temp/fe-idn-015/cli.exe`, ['seed'], 'seed');
  for (const program of ['api', 'worker']) {
    await writeFile(`${root}/.temp/fe-idn-015/${program}.log`, '');
    const log = Bun.file(`${root}/.temp/fe-idn-015/${program}.log`);
    const child = spawn([`${root}/.temp/fe-idn-015/${program}.exe`], {
      cwd: backendRoot,
      env,
      stdout: log,
      stderr: log,
    });
    processes.push(child);
  }
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    assert.ok(
      processes.every((child) => child.exitCode === null),
      'Owned API/worker exited unexpectedly',
    );
    try {
      const response = await fetch(env.FE_IDN_015_BACKEND + '/healthz');
      if (response.ok || response.status === 401) {
        ready = true;
        break;
      }
    } catch {}
    await Bun.sleep(250);
  }
  assert.ok(ready, 'Owned backend did not start');
  assert.ok(
    await Bun.file(`${appRoot}/dist/index.html`).exists(),
    'Build the production app before browser acceptance',
  );
  const previewLog = Bun.file(`${root}/.temp/fe-idn-015/preview.log`);
  await writeFile(`${root}/.temp/fe-idn-015/preview.log`, '');
  processes.push(
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
      { cwd: appRoot, env, stdout: previewLog, stderr: previewLog },
    ),
  );
  ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      if ((await fetch(origin)).ok) {
        ready = true;
        break;
      }
    } catch {}
    await Bun.sleep(250);
  }
  assert.ok(ready, 'Owned production preview did not start');
  await command('node', ['apps/admin/e2e/fe-idn-015.mjs'], 'browser', root);
  await command(
    `${root}/.temp/fe-idn-015/cli.exe`,
    ['audit-prune', '--before', new Date().toISOString()],
    'audit-prune',
  );
} catch (error) {
  failed = true;
  evidence.failure = error.message;
  console.error(error.message);
} finally {
  for (const child of processes) child.kill();
  evidence.processExitResults = await Promise.all(
    processes.map((child) => child.exited),
  );
  evidence.ownedProcessesStopped = true;
  if (ownsSchema) {
    await database.unsafe(`DROP SCHEMA ${schema} CASCADE`);
    const remaining =
      await database`SELECT count(*)::int AS count FROM information_schema.schemata WHERE schema_name=${schema}`;
    evidence.remainingSchemas = remaining[0].count;
    assert.equal(evidence.remainingSchemas, 0);
  }
  if (ownsRedis) {
    evidence.redisKeysDeleted = await redis.send('DBSIZE', []);
    await redis.send('FLUSHDB', []);
    evidence.remainingRedisKeys = await redis.send('DBSIZE', []);
    assert.equal(evidence.remainingRedisKeys, 0);
  }
  if (before) {
    assert.deepEqual(
      await baseline(),
      before,
      'Original public development data changed',
    );
    evidence.originalDevelopmentDataPreserved = true;
  }
  evidence.finishedAt = new Date().toISOString();
  await writeFile(
    `${root}/docs/evidence/fe-idn-015/runtime.json`,
    JSON.stringify(evidence, null, 2) + '\n',
  );
  await database.close();
  redis.close();
}
process.exit(failed ? 1 : 0);
