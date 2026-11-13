import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:net';
import process from 'node:process';

export const backend = process.env.SF2_BACKEND;
export const origin = process.env.SF2_ORIGIN || 'http://127.0.0.1:5666';
export const password = () => 'Sf2-' + randomBytes(20).toString('hex');
export const responses = [];
let token;
export function sql(statement, args = []) {
  assert.ok(
    process.env.SMOKE_SCHEMA?.match(/^s3_smoke_[a-f0-9]{32}$/),
    'Require isolated smoke schema',
  );
  const result = spawnSync(process.env.SF2_SMOKE_HELPER, ['sql'], {
    input: JSON.stringify({ sql: statement, args }),
    encoding: 'utf8',
    env: process.env,
  });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}
export async function api(
  path,
  method = 'GET',
  data,
  bearer = token,
  expected = method === 'PUT' && /\/(permissions|menus|roles)$/.test(path)
    ? 204
    : 200,
) {
  const response = await fetch(backend + '/api/v1' + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(bearer ? { Authorization: 'Bearer ' + bearer } : {}),
    },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  const body = response.status === 204 ? undefined : await response.json();
  responses.push({
    source: 'real-api',
    path,
    method,
    status: response.status,
    code: body?.code,
    trace_id: body?.trace_id,
  });
  assert.equal(
    response.status,
    expected,
    method + ' ' + path + ' status/code ' + response.status + '/' + body?.code,
  );
  return body?.data;
}
export async function bootstrap() {
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      token = (
        await api(
          '/auth/login',
          'POST',
          { username: 'admin', password: process.env.SF2_ADMIN_PASSWORD },
          null,
        )
      ).access_token;
      return;
    } catch (error) {
      if (attempt === 39) throw error;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
}
export async function relay(context) {
  await context.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const response = await route.fetch({
      url: backend + url.pathname + url.search,
    });
    await route.fulfill({ response });
  });
}
export async function login(
  page,
  username = 'admin',
  secret = process.env.SF2_ADMIN_PASSWORD,
) {
  await page.goto(origin + '/auth/login');
  await page.getByPlaceholder('请输入用户名').fill(username);
  await page.getByPlaceholder('密码', { exact: true }).fill(secret);
  await page.getByRole('button', { name: 'login', exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/auth/'));
}
export async function localSMTP() {
  const state = { reject: false, received: 0 };
  const sockets = new Set();
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.on('error', () => {});
    socket.setEncoding('utf8');
    socket.write('220 local\r\n');
    let buffer = '';
    let inData = false;
    socket.on('data', (data) => {
      buffer += data;
      for (let index; (index = buffer.indexOf('\r\n')) >= 0;) {
        const line = buffer.slice(0, index);
        buffer = buffer.slice(index + 2);
        if (inData) {
          if (line === '.') {
            inData = false;
            state.received++;
            socket.write('250 accepted\r\n');
          }
        } else if (/^(EHLO|HELO)/.test(line))
          socket.write('250-local\r\n250 AUTH PLAIN\r\n');
        else if (/^AUTH/.test(line)) socket.write('235 authenticated\r\n');
        else if (/^RCPT/.test(line) && state.reject)
          socket.write('550 rejected\r\n');
        else if (/^DATA/.test(line)) {
          inData = true;
          socket.write('354 send\r\n');
        } else if (/^QUIT/.test(line)) socket.end('221 bye\r\n');
        else socket.write('250 ok\r\n');
      }
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    state,
    address: '127.0.0.1:' + server.address().port,
    close: async () => {
      for (const socket of sockets) socket.destroy();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}
