import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { RedisClient, spawn, SQL } from 'bun';
import { preview } from 'vite';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const backendRoot = fileURLToPath(
  new URL('../../../../go-admin-api/', import.meta.url),
);
const output = `${root}/docs/evidence/fe-idn-018`;
const temporary = `${root}/.temp/fe-idn-018`;
const schema = 'feidn018_runtime_' + Date.now();
assert.match(schema, /^feidn018_runtime_\d+$/);
const sourceDSN = process.env.CH_DB_DSN || process.env.TEST_DATABASE_URL;
assert.ok(sourceDSN, 'Load the backend development environment');
const source = new SQL(sourceDSN);
const url = new URL(sourceDSN);
url.searchParams.set('search_path', schema);
const database = new SQL(url.href);
const redisAddress = process.env.CH_REDIS_ADDR || '127.0.0.1:16379';
const redisPassword = process.env.CH_REDIS_PASSWORD || '';
const redisDB = 13;
const redis = new RedisClient(
  `redis://${redisPassword ? ':' + encodeURIComponent(redisPassword) + '@' : ''}${redisAddress}/${redisDB}`,
);
const origin = 'http://127.0.0.1:5667';
const backend = 'http://127.0.0.1:18081';
const env = {
  ...process.env,
  CH_CONFIG_PATH: '',
  CH_DB_DSN: url.href,
  CH_REDIS_ADDR: redisAddress,
  CH_REDIS_DB: String(redisDB),
  CH_JWT_SECRET: randomBytes(32).toString('hex'),
  CH_APP_HTTP_ADDR: '127.0.0.1:18081',
  CH_SEED_ADMIN_PASSWORD: 'Acceptance@' + randomBytes(16).toString('hex'),
};
const report = {
  task: 'FE-IDN-018',
  schema,
  origin,
  backend,
  redisDB,
  startedAt: new Date().toISOString(),
  commands: [],
  requests: [],
};
const tables = [
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
let apiProcess;
let ownsRedis = false;
let ownsSchema = false;
let product;
let server;
let template;
let token;
let audits;
let before;
let failed = false;
async function cleanupStep(name, action) {
  try {
    await action();
  } catch (error) {
    failed = true;
    (report.cleanupErrors ??= []).push({ name, message: error.message });
    console.error(`Cleanup ${name}: ${error.message}`);
  }
}
async function baseline() {
  const data = {};
  for (const table of tables)
    data[table] = await source.unsafe(
      `SELECT id,md5(to_jsonb(t)::text) AS hash FROM public.${table} t ORDER BY id`,
    );
  return data;
}
async function command(binary, args, name) {
  const child = spawn([binary, ...args], {
    cwd: backendRoot,
    env,
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [out, err, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  await writeFile(`${temporary}/${name}.txt`, out + err);
  if (name === 'audit-prune')
    await writeFile(`${output}/${name}.txt`, out + err);
  report.commands.push({ name, code });
  assert.equal(code, 0, `${name} failed; inspect the local runtime log`);
}
async function api(path, method = 'GET', input) {
  const response = await fetch(backend + '/api/v1' + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'FE-IDN-018 acceptance',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    ...(input === undefined ? {} : { body: JSON.stringify(input) }),
  });
  const body = response.status === 204 ? {} : await response.json();
  report.requests.push({ path, method, status: response.status });
  assert.ok(
    response.ok,
    `${method} ${path}: ${response.status} ${body.message}`,
  );
  return body.data;
}
async function ready(address) {
  for (let attempt = 0; attempt < 120; attempt++) {
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
  assert.equal(
    await Bun.file(`${temporary}/finish`).exists(),
    false,
    'Remove the prior completion signal before a new run',
  );
  before = await baseline();
  audits =
    await source`SELECT id,md5(to_jsonb(t)::text) AS hash FROM public.audit_log t ORDER BY id`;
  report.originalPublicRows = Object.fromEntries(
    Object.entries(before).map(([name, rows]) => [name, rows.length]),
  );
  report.originalAuditCount = audits.length;
  report.redisInitialKeys = await redis.send('DBSIZE', []);
  assert.equal(
    report.redisInitialKeys,
    0,
    'Redis DB13 must be empty before exclusive use',
  );
  ownsRedis = true;
  for (const binary of ['api', 'cli'])
    await command(
      'go',
      ['build', '-o', `${temporary}/${binary}.exe`, `./cmd/${binary}`],
      `build-${binary}`,
    );
  await source.unsafe(`CREATE SCHEMA ${schema}`);
  ownsSchema = true;
  await command(`${temporary}/cli.exe`, ['migrate', 'up'], 'migrate');
  await command(`${temporary}/cli.exe`, ['seed'], 'seed');
  const log = Bun.file(`${temporary}/api.txt`);
  apiProcess = spawn([`${temporary}/api.exe`], {
    cwd: backendRoot,
    env,
    stdout: log,
    stderr: log,
  });
  await ready(backend + '/healthz');
  server = await preview({
    configFile: `${root}/apps/admin/vite.config.ts`,
    root: `${root}/apps/admin`,
    preview: {
      host: '127.0.0.1',
      port: 5667,
      strictPort: true,
      proxy: { '/api': { target: backend, changeOrigin: true } },
    },
  });
  await ready(origin);
  token = (
    await api('/auth/login', 'POST', {
      tenant: 'default',
      account: 'admin',
      password: env.CH_SEED_ADMIN_PASSWORD,
    })
  ).access_token;
  const menus = await api('/auth/menus');
  const pages = [];
  function collect(nodes) {
    for (const node of nodes) {
      if (node.component)
        pages.push({
          path: node.path,
          component: node.component,
          visible: node.visible,
        });
      collect(node.children || []);
    }
  }
  collect(menus.menus);
  const fixture = JSON.parse(
    await readFile(
      `${root}/apps/admin/src/router/__tests__/fixtures/backend-seed-menus.json`,
      'utf8',
    ),
  );
  const expected = fixture.menus
    .filter((menu) => menu.component)
    .map(({ path, component, visible }) => ({ path, component, visible }));
  const sorted = (values) =>
    values.toSorted((a, b) => a.path.localeCompare(b.path));
  assert.deepEqual(sorted(pages), sorted(expected));
  report.backendMenuContract = {
    result: 'pass',
    source: fixture.source,
    pages: sorted(pages),
  };
  template = await api('/admin/tenant-templates', 'POST', {
    code: 'feidn018_' + Date.now(),
    name: 'FE-IDN-018 页面验收模板',
    description: '',
  });
  product = await api('/admin/products', 'POST', {
    title: 'FE-IDN-018 页面验收商品',
    status: 'draft',
    skus: [],
  });
  report.fixtures = { templateId: template.id, productId: product.product.id };
  await writeFile(
    `${output}/backend-menu-contract.json`,
    JSON.stringify(report.backendMenuContract, null, 2) + '\n',
  );
  await writeFile(
    `${temporary}/login.json`,
    JSON.stringify({
      account: 'admin',
      tenant: 'default',
      password: env.CH_SEED_ADMIN_PASSWORD,
    }),
  );
  await writeFile(
    `${temporary}/ready.json`,
    JSON.stringify({ origin, backend, ...report.fixtures }),
  );
  await writeFile(
    `${temporary}/baseline.json`,
    JSON.stringify({ before, audits }),
  );
  await writeFile(
    `${output}/runtime.json`,
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(
    'FE-IDN-018 runtime ready; 20 seed pages verified; waiting for browser checks',
  );
  while (!(await Bun.file(`${temporary}/finish`).exists())) {
    assert.equal(
      apiProcess.exitCode,
      null,
      'Owned API exited during browser checks',
    );
    await Bun.sleep(1000);
  }
} catch (error) {
  failed = true;
  report.failure = error.message;
  console.error(error.message);
} finally {
  await cleanupStep('api fixtures', async () => {
    if (!product && !template) return;
    // Manual browser checks can outlive the original access token.
    token = (
      await api('/auth/login', 'POST', {
        tenant: 'default',
        account: 'admin',
        password: env.CH_SEED_ADMIN_PASSWORD,
      })
    ).access_token;
    if (product)
      await api(
        `/admin/products/${product.product.id}?version=${product.product.version}`,
        'DELETE',
      );
    if (template) await api('/admin/tenant-templates/' + template.id, 'DELETE');
  });
  await cleanupStep('owned processes', async () => {
    if (server)
      await new Promise((resolve) => server.httpServer.close(resolve));
    if (apiProcess) {
      apiProcess.kill();
      report.apiExitCode = await apiProcess.exited;
    }
  });
  report.ownedProcessesStopped = true;
  if (ownsSchema) {
    await cleanupStep('audit-prune', () =>
      command(
        `${temporary}/cli.exe`,
        ['audit-prune', '--before', new Date().toISOString()],
        'audit-prune',
      ),
    );
    await cleanupStep('schema', async () => {
      report.ownedSchemaRowsBeforeDrop = {};
      const rows =
        await database`SELECT table_name FROM information_schema.tables WHERE table_schema=current_schema() AND table_type='BASE TABLE'`;
      for (const { table_name: table } of rows) {
        assert.match(table, /^[a-z_][a-z_0-9]*$/);
        report.ownedSchemaRowsBeforeDrop[table] = (
          await database.unsafe(`SELECT count(*)::int AS count FROM ${table}`)
        )[0].count;
      }
      report.schemaCleanupSQL = `DROP SCHEMA ${schema} CASCADE`;
      await source.unsafe(report.schemaCleanupSQL);
      report.remainingSchemas = (
        await source`SELECT count(*)::int AS count FROM information_schema.schemata WHERE schema_name=${schema}`
      )[0].count;
      assert.equal(report.remainingSchemas, 0);
    });
  }
  if (ownsRedis) {
    await cleanupStep('redis', async () => {
      report.redisKeysDeleted = await redis.send('DBSIZE', []);
      await redis.send('FLUSHDB', []);
      report.remainingRedisKeys = await redis.send('DBSIZE', []);
      assert.equal(report.remainingRedisKeys, 0);
    });
  }
  if (before) {
    await cleanupStep('original development data', async () => {
      assert.deepEqual(
        await baseline(),
        before,
        'Original public development data changed',
      );
      report.originalDevelopmentDataPreserved = true;
      assert.deepEqual(
        await source`SELECT id,md5(to_jsonb(t)::text) AS hash FROM public.audit_log t ORDER BY id`,
        audits,
      );
      report.originalAuditDataPreserved = true;
    });
  }
  await rm(`${temporary}/login.json`, { force: true });
  report.finishedAt = new Date().toISOString();
  report.status = failed ? 'failed' : 'passed';
  await writeFile(
    `${output}/runtime.json`,
    JSON.stringify(report, null, 2) + '\n',
  );
  await source.close();
  await database.close();
  redis.close();
}
process.exit(failed ? 1 : 0);
