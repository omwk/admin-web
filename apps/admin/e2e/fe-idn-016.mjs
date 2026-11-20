import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createHash, randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import process from 'node:process';

import {
  api,
  authenticate,
  button,
  database,
  login,
  output,
  pageURL,
  persist,
  record,
  report,
  response,
  setup,
  shot,
  waitUntil,
} from './fe-idn-016-support.mjs';

const prefix = 'feidn016_' + Date.now();
const password = 'Acceptance@' + randomBytes(16).toString('hex');
const payload = Buffer.from(`FE-IDN-016 original bytes\n${prefix}\n`);
let browser, context, failure, page, reader, source;
const menus = [];
const objects = [];
const created = [];
const providerName = (index) => `验收 MinIO ${index} ${prefix}`;
function row(name) {
  return page.locator('tbody tr').filter({ hasText: name });
}
async function storagePage() {
  await page.goto(pageURL('/system/storage'));
  await page.getByTestId('storage-page').waitFor();
  await page.locator('.ant-spin-spinning').first().waitFor({ state: 'hidden' });
}
async function filesPage() {
  await page.goto(pageURL('/system/files'));
  await page.getByTestId('files-page').waitFor();
  await page.locator('.ant-spin-spinning').first().waitFor({ state: 'hidden' });
}
async function formFill(name) {
  const dialog = page.getByRole('dialog');
  for (const [label, value] of [
    ['名称', name],
    ['服务地址', source.endpoint],
    ['桶名', source.bucket],
    ['Region', source.region],
    ['Access Key', source.access_key],
    ['Secret Key', source.secret_key],
    ['公开访问前缀（可选）', source.public_base_url],
  ])
    await dialog.getByLabel(label, { exact: true }).fill(value);
  await dialog.getByLabel('端口', { exact: true }).fill(String(source.port));
  for (const [label, checked] of [
    ['使用 HTTPS', source.use_ssl],
    ['路径风格访问', source.path_style],
  ]) {
    const control = dialog.getByRole('switch', { name: label, exact: true });
    if ((await control.getAttribute('aria-checked')) !== String(checked))
      await control.click();
  }
}
async function saveProvider(index) {
  await button(page, '新建配置').first().click();
  await formFill(providerName(index));
  const pending = response(page, '/admin/storage-providers', 'POST');
  await button(page, '保存', page.getByRole('dialog')).click();
  const result = await pending;
  assert.equal(result.status, 201);
  created.push(result.body.data.id);
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await row(providerName(index)).waitFor();
  return result.body.data.id;
}
async function editSecret(index, value) {
  await button(page, '编辑', row(providerName(index))).click();
  await page
    .getByRole('dialog')
    .getByLabel('Secret Key', { exact: true })
    .fill(value);
  const pending = response(
    page,
    '/admin/storage-providers/' + created[index - 1],
    'PUT',
  );
  await button(page, '保存', page.getByRole('dialog')).click();
  assert.equal((await pending).status, 200);
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
}
async function testProvider(index, status, label) {
  const pending = response(
    page,
    `/admin/storage-providers/${created[index - 1]}/test`,
    'POST',
  );
  await button(page, '测试', row(providerName(index))).click();
  const result = await pending;
  assert.equal(result.status, 200);
  assert.equal(result.body.data.status, status);
  await page.getByRole('alert').filter({ hasText: label }).waitFor();
}
async function setDefault(index) {
  const pending = response(
    page,
    `/admin/storage-providers/${created[index - 1]}/default`,
    'POST',
  );
  await button(page, '设为默认', row(providerName(index))).click();
  assert.equal((await pending).status, 200);
  await row(providerName(index)).locator('.ant-tag-blue').waitFor();
}
async function drop(name, data, type = 'text/plain', size) {
  await page
    .getByRole('button', { name: '点击或拖拽上传文件', exact: true })
    .evaluate(
      (element, input) => {
        const transfer = new DataTransfer();
        transfer.items.add(
          new File(
            [
              input.size
                ? new Uint8Array(input.size)
                : new Uint8Array(input.data),
            ],
            input.name,
            { type: input.type },
          ),
        );
        element.dispatchEvent(
          new DragEvent('drop', {
            bubbles: true,
            cancelable: true,
            dataTransfer: transfer,
          }),
        );
      },
      { name, data: [...data], type, size },
    );
}
async function createMenus() {
  const flatten = (items) =>
    items.flatMap((item) => [item, ...flatten(item.children || [])]);
  const system = flatten(await api('/admin/menus')).find(
    (menu) => menu.path === '/system',
  );
  assert.ok(system);
  for (const [path, name, component, permission] of [
    ['storage', '存储配置', 'system/storage/index', 'system:storage:manage'],
    ['files', '文件管理', 'system/files/index', null],
  ]) {
    const menu = await api('/admin/menus', 'POST', {
      parent_id: system.id,
      name,
      type: 'menu',
      path: '/system/' + path,
      component,
      permission_code: permission,
      icon: null,
      redirect: null,
      sort: 90,
      status: 'active',
      visible: true,
      keep_alive: false,
      is_external: false,
      meta: {},
    });
    menus.push(menu.id);
  }
  reader = await database('reader', { password, menus: [system.id, ...menus] });
  report.fixture = { menus, reader: reader.user.id, role: reader.role.id };
}
async function cleanup() {
  await authenticate();
  for (const file of (await api('/admin/files')).list)
    await api('/admin/files/' + file.id, 'DELETE', undefined, undefined, 204);
  await waitUntil(
    async () => (await database('objects')).pending === 0,
    'Worker did not complete object cleanup',
    60_000,
  );
  report.objectCleanup = [];
  for (const file of objects) {
    const response = await fetch(file.url);
    assert.equal(
      response.status,
      404,
      'Deleted MinIO object remains available',
    );
    report.objectCleanup.push({
      id: file.id,
      statusAfterCleanup: response.status,
    });
  }
  for (const provider of await api('/admin/storage-providers')) {
    const { id, created_at, updated_at, ...input } = provider;
    if (provider.is_default)
      await api('/admin/storage-providers/' + provider.id, 'PUT', {
        ...input,
        is_default: false,
      });
    await api(
      '/admin/storage-providers/' + provider.id,
      'DELETE',
      undefined,
      undefined,
      204,
    );
  }
  if (reader) {
    await api(`/admin/users/${reader.user.id}/roles`, 'PUT', { role_ids: [] });
    await api(
      `/admin/users/${reader.user.id}`,
      'DELETE',
      undefined,
      undefined,
      204,
    );
    await api(`/admin/roles/${reader.role.id}/menus`, 'PUT', { menu_ids: [] });
    await api(
      `/admin/roles/${reader.role.id}`,
      'DELETE',
      undefined,
      undefined,
      204,
    );
  }
  for (const id of menus.toReversed())
    await api('/admin/menus/' + id, 'DELETE', undefined, undefined, 204);
  const sql = await database('cleanup', {
    user: reader?.user.id,
    role: reader?.role.id,
  });
  await writeFile(
    new URL('cleanup.json', output),
    JSON.stringify(sql, null, 2) + '\n',
  );
  report.cleanupPassed = true;
}
try {
  await persist();
  await authenticate();
  [source] = await api('/admin/storage-providers');
  assert.ok(source?.secret_key, 'Real source credentials are required');
  await api(
    '/admin/storage-providers/' + source.id,
    'DELETE',
    undefined,
    undefined,
    204,
  );
  await createMenus();
  ({ browser, page, context } = await setup());
  await login(page);
  await storagePage();
  await page.getByText('还没有对象存储配置', { exact: true }).waitFor();
  const storageEmptyShot = await shot('12-storage-empty', page);
  await filesPage();
  await page.getByText('暂无文件', { exact: true }).waitFor();
  const fileEmptyShot = await shot('12-files-empty', page);
  await record(12, {
    storage: '还没有对象存储配置 / 未配置时上传功能不可用 / 新建配置',
    files: '暂无文件 / 上传与配置引导',
    screenshots: [storageEmptyShot, fileEmptyShot],
  });
  await storagePage();
  await saveProvider(1);
  await testProvider(1, 'ok', '连接正常');
  await record(2, {
    createStatus: 201,
    testStatus: 'ok',
    screenshot: await shot('02-create-test-real', page),
  });
  await setDefault(1);
  assert.equal(await row(providerName(1)).locator('.ant-tag-blue').count(), 1);
  await record(1, {
    providers: 1,
    defaultMarks: 1,
    screenshot: await shot('01-list-real', page),
  });
  await button(page, '编辑', row(providerName(1))).click();
  const secret = page
    .getByRole('dialog')
    .getByLabel('Secret Key', { exact: true });
  assert.equal(await secret.getAttribute('type'), 'text');
  assert.ok(
    (await secret.inputValue()) === source.secret_key,
    'The API plaintext secret must appear in the editor',
  );
  await page
    .getByRole('button', { name: '复制 Secret Key', exact: true })
    .click();
  assert.ok(
    (await page.evaluate(() => navigator.clipboard.readText())) ===
      source.secret_key,
    'Secret clipboard must match without logging credentials',
  );
  const secretShot = await shot('03-secret-visible-copy-real', page);
  await page
    .getByRole('button', { name: '隐藏 Secret Key', exact: true })
    .click();
  assert.equal(await secret.getAttribute('type'), 'password');
  await page
    .getByRole('button', { name: '显示 Secret Key', exact: true })
    .click();
  assert.equal(await secret.getAttribute('type'), 'text');
  await record(3, {
    plaintextMatchesAPI: true,
    copiedMatchesAPI: true,
    types: ['text', 'password', 'text'],
    screenshot: secretShot,
    credentialPixelsMasked: true,
  });
  await button(page, '取消', page.getByRole('dialog')).click();
  await editSecret(1, randomBytes(32).toString('hex'));
  await testProvider(1, 'access_denied', '认证失败');
  await record(4, {
    status: 'access_denied',
    displayed: '认证失败',
    screenshot: await shot('04-auth-failed-real', page),
  });
  await editSecret(1, source.secret_key);
  await saveProvider(2);
  await setDefault(2);
  assert.equal(await row(providerName(1)).locator('.ant-tag-blue').count(), 0);
  assert.equal(await row(providerName(2)).locator('.ant-tag-blue').count(), 1);
  await record(5, {
    providers: 2,
    oldDefaultMarks: 0,
    newDefaultMarks: 1,
    screenshot: await shot('05-switch-default-real', page),
  });
  const deletion = button(page, '删除', row(providerName(2)));
  assert.equal(await deletion.isDisabled(), true);
  await deletion.locator('..').hover();
  await page
    .getByRole('tooltip')
    .filter({ hasText: '请先切换默认配置' })
    .waitFor();
  await record(6, {
    defaultDeleteDisabled: true,
    explanation: '请先切换默认配置',
    screenshot: await shot('06-default-protection-real', page),
  });
  await filesPage();
  const filename = prefix + '.txt';
  const pendingUpload = response(page, '/admin/files', 'POST');
  await drop(filename, payload);
  const upload = await pendingUpload;
  assert.equal(upload.status, 201);
  assert.equal(
    upload.body.data.sha256,
    createHash('sha256').update(payload).digest('hex'),
  );
  const file = upload.body.data;
  const signed = await api('/admin/files/' + file.id + '/url');
  objects.push({ id: file.id, url: signed.url });
  await row(filename).getByText('新上传', { exact: true }).waitFor();
  await page.locator('[data-upload-status="success"] .ant-progress').waitFor();
  await record(7, {
    uploadStatus: 201,
    dragAndDrop: true,
    progressComplete: true,
    sha256: file.sha256,
    rowHighlighted: await row(filename).getAttribute('class'),
    screenshot: await shot('07-drag-upload-real', page),
  });
  const uploadCount = () =>
    report.requests.filter(
      (request) =>
        request.path === '/api/v1/admin/files' && request.method === 'POST',
    ).length;
  const before = uploadCount();
  await drop('large.txt', Buffer.alloc(0), 'text/plain', 20 * 1024 * 1024 + 1);
  await page
    .getByRole('alert')
    .filter({ hasText: '文件超过 20 MB 上限' })
    .waitFor();
  await drop('invalid.html', Buffer.from('<html>invalid</html>'), 'text/html');
  await page
    .getByRole('alert')
    .filter({ hasText: '不支持的文件扩展名：html' })
    .waitFor();
  assert.equal(uploadCount(), before);
  const rejected = response(page, '/admin/files', 'POST');
  await drop(
    'disguised.txt',
    Buffer.from('<!DOCTYPE html><html><body>invalid</body></html>'),
    'text/plain',
  );
  const invalid = await rejected;
  assert.equal(invalid.status, 400);
  assert.equal(invalid.body.message, '不支持的文件类型：text/html');
  await page
    .getByRole('alert')
    .filter({ hasText: invalid.body.message })
    .waitFor();
  assert.ok(invalid.body.details.allowed.includes('text/plain'));
  const rejectionShot = await shot('08-upload-rejection-real', page);
  const windowsCSV = response(page, '/admin/files', 'POST');
  await drop(
    prefix + '-windows.csv',
    Buffer.from('name,value\nexample,1\n'),
    'application/vnd.ms-excel',
  );
  const csv = await windowsCSV;
  assert.equal(csv.status, 201);
  assert.equal(csv.body.data.mime, 'text/csv');
  const csvSigned = await api('/admin/files/' + csv.body.data.id + '/url');
  objects.push({ id: csv.body.data.id, url: csvSigned.url });
  await row(prefix + '-windows.csv').waitFor();
  await record(8, {
    oversizedAndTypeBlockedBeforeRequest: true,
    requestsSent: 0,
    disguisedHTMLStatus: 400,
    backendMessage: invalid.body.message,
    allowed: invalid.body.details.allowed,
    windowsCSVAliasUploadStatus: csv.status,
    windowsCSVMIME: csv.body.data.mime,
    screenshot: rejectionShot,
  });
  const downloaded = page.waitForEvent('download');
  await button(page, '下载', row(filename)).click();
  const download = await downloaded;
  assert.equal(download.suggestedFilename(), filename);
  assert.deepEqual(await readFile(await download.path()), payload);
  await record(9, {
    originalFilename: true,
    bytesMatch: true,
    size: payload.length,
  });
  await button(page, '复制链接', row(filename)).click();
  await page.getByText('链接已复制，有效期 5 分钟', { exact: true }).waitFor();
  const link = await page.evaluate(() => navigator.clipboard.readText());
  const tab = await context.newPage();
  const linkDownload = tab.waitForEvent('download');
  const opened = tab.waitForResponse((result) => result.url() === link);
  await tab.goto(link).catch((error) => {
    if (!error.message.includes('Download is starting')) throw error;
  });
  assert.equal((await opened).status(), 200);
  assert.deepEqual(await readFile(await (await linkDownload).path()), payload);
  await tab.close();
  await record(10, {
    freshPresign: true,
    expiresInSeconds: 300,
    clipboardReadable: true,
    newTabStatus: 200,
    bytesMatch: true,
    urlOmitted: true,
  });
  await page.getByLabel('文件关键字', { exact: true }).fill('not-present');
  await button(page, '查询').click();
  await row(filename).waitFor({ state: 'hidden' });
  await button(page, '重置').click();
  await row(filename).waitFor();
  await button(page, '删除', row(filename)).click();
  await page.getByText('删除文件？', { exact: true }).waitFor();
  const confirmed = response(page, '/admin/files/' + file.id, 'DELETE');
  await button(page, '删除', page.locator('.ant-modal-confirm')).click();
  assert.equal((await confirmed).status, 204);
  await row(filename).waitFor({ state: 'hidden' });
  await record(11, {
    confirmationShown: true,
    deleteStatus: 204,
    rowDisappeared: true,
    keywordFilterAndReset: true,
    screenshot: await shot('11-delete-real', page),
  });
  await browser.close();
  ({ browser, context, page } = await setup());
  await login(page, reader.user.username, password);
  await page.goto(pageURL('/system/storage'));
  await page.getByText('404 · 页面不存在', { exact: true }).waitFor();
  const hidden = await shot('13-storage-404-real', page);
  await filesPage();
  assert.equal(await button(page, '上传文件').count(), 0);
  assert.equal(await button(page, '删除').count(), 0);
  const readerToken = await authenticate(reader.user.username, password, false);
  await api('/admin/storage-providers', 'GET', undefined, readerToken, 404);
  await api('/admin/files', 'GET', undefined, readerToken, 403);
  await record(13, {
    storage404: true,
    uploadHidden: true,
    deleteHidden: true,
    noPermissionFileAPI: 403,
    screenshots: [hidden, await shot('13-files-permission-real', page)],
  });
  assert.deepEqual(report.browserErrors, []);
  report.passed = true;
} catch (error) {
  failure = error;
  report.failure = error.message.replace(
    /https?:\/\/[^\s"<>]*X-Amz-[^\s"<>]*/g,
    '[presigned URL omitted]',
  );
  await persist();
  if (page) await shot('failure', page).catch(() => {});
} finally {
  try {
    await cleanup();
  } catch (error) {
    failure ||= error;
    report.cleanupFailure = error.message.replace(
      /https?:\/\/[^\s"<>]*X-Amz-[^\s"<>]*/g,
      '[presigned URL omitted]',
    );
  }
  if (browser) await browser.close();
  report.finishedAt = new Date().toISOString();
  await persist();
}
if (failure) {
  console.error(report.failure || report.cleanupFailure);
  process.exitCode = 1;
}
