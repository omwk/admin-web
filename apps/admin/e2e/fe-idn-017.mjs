import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
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
} from './fe-idn-017-support.mjs';

const prefix = 'feidn017_' + Date.now();
const samples = [];
const menus = [];
let browser, context, failure, originalProvider, page, provider;
const row = (name) => page.locator('tbody tr').filter({ hasText: name });
const hash = (data) => createHash('sha256').update(data).digest('hex');
async function filesPage() {
  await page.goto(pageURL('/system/files'));
  await page.getByTestId('files-page').waitFor();
  await page.locator('.ant-spin-spinning').first().waitFor({ state: 'hidden' });
}
async function profilePage() {
  await page.goto(pageURL('/profile'));
  await page
    .getByLabel('选择新头像', { exact: true })
    .waitFor({ state: 'attached' });
  await page.locator('.ant-spin-spinning').first().waitFor({ state: 'hidden' });
}
async function upload(name, buffer, mimeType, expected = 201) {
  const pending = response(page, '/admin/files', 'POST');
  await page
    .getByLabel('选择上传文件', { exact: true })
    .setInputFiles({ name, buffer, mimeType });
  const result = await pending;
  assert.equal(result.status, expected);
  if (expected === 201) {
    await row(name).waitFor();
    samples.push({ name, buffer, ...result.body.data });
  }
  return result.body;
}
async function configure(changes) {
  provider = { ...provider, ...changes };
  const { id, created_at, updated_at, ...input } = provider;
  await api('/admin/storage-providers/' + id, 'PUT', input);
}
async function canvas(color) {
  return Buffer.from(
    await page.evaluate((fill) => {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 360;
      const draw = canvas.getContext('2d');
      draw.fillStyle = fill;
      draw.fillRect(0, 0, 640, 360);
      draw.fillStyle = '#fff';
      draw.font = 'bold 48px sans-serif';
      draw.fillText('FE-IDN-017', 60, 130);
      draw.font = '24px sans-serif';
      draw.fillText('Original image 640 x 360', 60, 190);
      return [
        ...Uint8Array.from(
          atob(canvas.toDataURL('image/png').split(',')[1]),
          (c) => c.charCodeAt(0),
        ),
      ];
    }, color),
  );
}
function zip() {
  const name = Buffer.from('notes.txt');
  const body = Buffer.from('FE-IDN-017 archive');
  let crc = 0xffff_ffff;
  for (const byte of body) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++)
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb8_8320 : 0);
  }
  crc = (crc ^ 0xffff_ffff) >>> 0;
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x0403_4b50);
  local.writeUInt16LE(20, 4);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(body.length, 18);
  local.writeUInt32LE(body.length, 22);
  local.writeUInt16LE(name.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x0201_4b50);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(body.length, 20);
  central.writeUInt32LE(body.length, 24);
  central.writeUInt16LE(name.length, 28);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x0605_4b50);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length + name.length, 12);
  end.writeUInt32LE(local.length + name.length + body.length, 16);
  return Buffer.concat([local, name, body, central, name, end]);
}
async function fixture() {
  provider = await api('/admin/storage-providers', 'POST', {
    ...JSON.parse(process.env.FE_IDN_017_STORAGE_INPUT),
    name: 'FE-IDN-017 独立 MinIO',
    enabled: true,
    is_default: true,
    access_mode: 'public',
    quota_per_user_mb: 1,
  });
  assert.ok(provider?.secret_key);
  originalProvider = { ...provider };
  await configure({
    is_default: true,
    access_mode: 'public',
    quota_per_user_mb: 1,
  });
  const flatten = (items) =>
    items.flatMap((item) => [item, ...flatten(item.children || [])]);
  const menuTree = flatten(await api('/admin/menus'));
  const system = menuTree.find((menu) => menu.path === '/system');
  const existingMenu = menuTree.find((item) => item.path === '/system/files');
  const menu =
    existingMenu ||
    (await api('/admin/menus', 'POST', {
      parent_id: system.id,
      name: '文件管理',
      type: 'menu',
      path: '/system/files',
      component: 'system/files/index',
      permission_code: 'system:file:manage',
      icon: null,
      redirect: null,
      sort: 90,
      status: 'active',
      visible: true,
      keep_alive: false,
      is_external: false,
      meta: {},
    }));
  if (!existingMenu) menus.push(menu.id);
  // FE-IDN-018 owns shorthand component resolution; this fixture uses FE-IDN-017's existing full-path registry.
  report.menuFixture = await database('menu', { id: menu.id });
  report.fixture = { menuIDs: menus, providerID: provider.id, prefix };
}
async function cleanup() {
  await authenticate();
  const files = (await api('/admin/files?include_avatar=true&page_size=100'))
    .list;
  const links = [];
  for (const file of files) {
    links.push({
      id: file.id,
      ...(await api('/admin/files/' + file.id + '/url')),
    });
    await api('/admin/files/' + file.id, 'DELETE', undefined, undefined, 204);
  }
  await waitUntil(
    async () => (await database('objects')).pending === 0,
    'Worker did not finish file cleanup',
    60_000,
  );
  report.objectCleanup = [];
  for (const link of links) {
    const result = await fetch(link.url);
    assert.equal(result.status, 404);
    report.objectCleanup.push({
      id: link.id,
      statusAfterCleanup: result.status,
    });
  }
  if (originalProvider) {
    await configure({ ...originalProvider, is_default: false });
    report.configurationRestored = {
      accessMode: originalProvider.access_mode,
      quotaPerUserMB: originalProvider.quota_per_user_mb,
      isolatedProviderDeleted: true,
    };
    await api(
      '/admin/storage-providers/' + provider.id,
      'DELETE',
      undefined,
      undefined,
      204,
    );
  }
  for (const id of menus.toReversed())
    await api('/admin/menus/' + id, 'DELETE', undefined, undefined, 204);
  if (report.menuFixture && !menus.includes(report.menuFixture.id))
    report.menuRestored = await database('restore-menu', report.menuFixture);
  const result = await database('cleanup');
  await writeFile(
    new URL('cleanup.json', output),
    JSON.stringify(result, null, 2) + '\n',
  );
  report.cleanupPassed = true;
}
try {
  await persist();
  await authenticate();
  await fixture();
  ({ browser, page, context } = await setup());
  await login(page);
  await filesPage();
  assert.equal(await page.getByText(/用途/).count(), 0);
  assert.equal(
    await page.locator('select[name="source"],input[name="source"]').count(),
    0,
  );
  await record(2, {
    uploadPurposeAbsent: true,
    sourceAbsent: true,
    multipartOnlyFile: true,
  });
  const original = await canvas('#176b87');
  const replacement = await canvas('#ac3471');
  for (const [suffix, buffer, mime] of [
    ['image.png', original, 'image/png'],
    [
      'document.pdf',
      Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF'),
      'application/pdf',
    ],
    ['sheet.csv', Buffer.from('name,value\nexample,1\n'), 'text/csv'],
    ['archive.zip', zip(), 'application/zip'],
    ['notes.txt', Buffer.from('FE-IDN-017 original text\n'), 'text/plain'],
  ])
    await upload(prefix + '-' + suffix, buffer, mime);
  const labels = {
    image: '图片',
    document: '文档',
    sheet: '表格',
    archive: '压缩包',
    text: '文本',
  };
  const filters = [];
  for (const [category, label] of Object.entries(labels)) {
    await page.getByLabel('筛选分类', { exact: true }).click();
    await page
      .locator('.ant-select-dropdown:visible .ant-select-item-option')
      .filter({ hasText: label })
      .click();
    const pending = response(page, '/admin/files');
    await button(page, '查询').click();
    const result = await pending;
    assert.ok(
      result.body.data.list.every((file) => file.category === category),
    );
    await row(
      samples.find((file) => file.category === category).name,
    ).waitFor();
    assert.equal(await page.locator('tbody tr[data-row-key]').count(), 1);
    filters.push({ category, count: result.body.data.list.length });
  }
  await button(page, '重置').click();
  await waitUntil(
    async () => (await page.locator('tbody tr[data-row-key]').count()) === 5,
    'All filter did not restore five files',
  );
  await record(1, { all: 5, filters, noAvatarFiles: true });
  const image = samples.find((file) => file.category === 'image');
  const thumbnail = row(image.name).locator('img');
  await thumbnail.evaluate((image) => image.decode());
  const thumbnailSize = await thumbnail.boundingBox();
  assert.equal(thumbnailSize.width, 48);
  assert.equal(thumbnailSize.height, 48);
  for (const file of samples.filter((file) => file.category !== 'image')) {
    assert.equal(await row(file.name).locator('img').count(), 0);
    assert.equal(
      await row(file.name)
        .getByRole('img', { name: labels[file.category] + '文件' })
        .count(),
      1,
    );
  }
  await page.locator('.ant-message-notice').last().waitFor({ state: 'hidden' });
  await record(3, {
    thumbnail: { width: 48, height: 48, loaded: true },
    otherTypeIcons: 4,
    screenshot: await shot('03-thumbnails', page),
  });
  for (const file of samples)
    assert.ok((await row(file.name).innerText()).includes('admin'));
  await record(5, { uploadedByName: 'admin', rows: 5 });
  await row(image.name)
    .getByRole('button', { name: '预览 ' + image.name, exact: true })
    .click();
  const dialog = page.getByRole('dialog');
  const preview = dialog.getByRole('img', { name: image.name, exact: true });
  await preview.waitFor();
  await preview.evaluate((image) => image.decode());
  assert.deepEqual(
    await preview.evaluate((image) => [
      image.naturalWidth,
      image.naturalHeight,
    ]),
    [640, 360],
  );
  assert.notEqual(await preview.getAttribute('src'), image.thumb_url);
  assert.ok((await dialog.innerText()).includes('原图'));
  const previewShot = await shot('04-original-preview', page);
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  await button(page, '预览', row(image.name)).click();
  await dialog.waitFor();
  await dialog.getByRole('button', { name: 'Close', exact: true }).focus();
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden' });
  await record(4, {
    originalDimensions: [640, 360],
    thumbnailAndActionOpen: true,
    closeAndEscape: true,
    screenshot: previewShot,
  });
  await button(page, '复制链接', row(image.name)).click();
  await page.getByText('链接已复制，长期有效', { exact: true }).waitFor();
  const publicLink = await page.evaluate(() => navigator.clipboard.readText());
  assert.equal((await api('/admin/files/' + image.id + '/url')).expires_in, 0);
  const tab = await context.newPage();
  assert.equal((await tab.goto(publicLink)).status(), 200);
  await tab.close();
  assert.equal(
    hash(Buffer.from(await (await fetch(publicLink)).arrayBuffer())),
    hash(original),
  );
  await configure({ access_mode: 'private' });
  await button(page, '复制链接', row(image.name)).click();
  await page.getByText('链接已复制，5 分钟内有效', { exact: true }).waitFor();
  const privateLink = await page.evaluate(() => navigator.clipboard.readText());
  assert.equal(
    (await api('/admin/files/' + image.id + '/url')).expires_in,
    300,
  );
  assert.equal((await fetch(privateLink)).status, 200);
  await configure({ access_mode: 'public' });
  await record(7, {
    publicExpiresIn: 0,
    publicNewTab: 200,
    privateExpiresIn: 300,
    privateURL: 200,
    bothToastsCorrect: true,
  });
  const downloadEvent = page.waitForEvent('download');
  await button(page, '下载', row(image.name)).click();
  const download = await downloadEvent;
  assert.equal(download.suggestedFilename(), image.name);
  assert.deepEqual(await readFile(await download.path()), original);
  await record(8, {
    filename: image.name,
    bytes: original.length,
    sha256: hash(original),
    matchesPreviewAndOriginal: true,
  });
  const lowColor = await page
    .getByTestId('file-usage')
    .locator('.ant-progress-bg')
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  assert.notEqual(lowColor, 'rgb(250, 140, 22)');
  await upload(
    prefix + '-quota.txt',
    Buffer.alloc(950 * 1024, 'q'),
    'text/plain',
  );
  const usage = await api('/admin/files/usage');
  assert.ok(usage.used_bytes / usage.quota_bytes > 0.9);
  await waitUntil(
    async () =>
      (await page
        .getByTestId('file-usage')
        .locator('.ant-progress-bg')
        .evaluate((el) => getComputedStyle(el).backgroundColor)) ===
      'rgb(250, 140, 22)',
    'Quota did not turn orange',
  );
  const quotaShot = await shot('06-quota-orange', page);
  const rejection = await upload(
    prefix + '-over-quota.txt',
    Buffer.alloc(100 * 1024, 'q'),
    'text/plain',
    413,
  );
  await page
    .getByRole('alert')
    .filter({ hasText: rejection.message })
    .waitFor();
  await record(6, {
    usage,
    orangeAbove90: true,
    lowUsageNotOrange: true,
    rejectedStatus: 413,
    backendMessage: rejection.message,
    screenshot: quotaShot,
  });
  await profilePage();
  const picker = page.getByLabel('选择新头像', { exact: true });
  const uploadCount = () =>
    report.requests.filter(
      (item) =>
        item.path === '/api/v1/auth/profile/avatar' && item.method === 'POST',
    ).length;
  const count = uploadCount();
  await picker.setInputFiles({
    name: 'not-image.txt',
    buffer: Buffer.from('text'),
    mimeType: 'text/plain',
  });
  await page.getByRole('alert').filter({ hasText: '头像仅支持' }).waitFor();
  await picker.setInputFiles({
    name: 'too-large.png',
    buffer: Buffer.alloc(2 * 1024 * 1024 + 1),
    mimeType: 'image/png',
  });
  await page
    .getByRole('alert')
    .filter({ hasText: '头像超过 2 MB 上限' })
    .waitFor();
  assert.equal(uploadCount(), count);
  const invalid = response(page, '/auth/profile/avatar', 'POST');
  await picker.setInputFiles({
    name: 'invalid.png',
    buffer: Buffer.from('not an image'),
    mimeType: 'image/png',
  });
  const invalidResult = await invalid;
  assert.equal(invalidResult.status, 400);
  await page
    .getByRole('alert')
    .filter({ hasText: invalidResult.body.message })
    .waitFor();
  await record(10, {
    nonImageAndOver2MiBBlockedBeforeRequest: true,
    backendDecodeStatus: 400,
    backendMessage: invalidResult.body.message,
  });
  const me = await api('/auth/me');
  const canonical = '/api/v1/avatars/' + me.user.id;
  const avatar = page.getByRole('img', { name: '头像预览', exact: true });
  let firstAvatar;
  for (const [index, buffer] of [original, replacement].entries()) {
    const pending = response(page, '/auth/profile/avatar', 'POST');
    await picker.setInputFiles({
      name: `avatar-${index}.png`,
      buffer,
      mimeType: 'image/png',
    });
    const saved = await pending;
    assert.equal(saved.status, 201);
    assert.equal(saved.body.data.avatar, canonical);
    await avatar.waitFor();
    await waitUntil(
      async () =>
        (await avatar.getAttribute('src')).includes(
          'v=' + saved.body.data.file_id,
        ),
      'Avatar preview did not refresh',
    );
    await avatar.evaluate((image) => image.decode());
    assert.deepEqual(
      await avatar.evaluate((image) => [
        image.naturalWidth,
        image.naturalHeight,
      ]),
      [256, 256],
    );
    const src = await avatar.getAttribute('src');
    await waitUntil(
      async () => (await page.locator(`img[src*="${canonical}"]`).count()) >= 2,
      'Global avatar did not update',
    );
    const body = Buffer.from(
      await (
        await fetch(new URL(src, process.env.FE_IDN_017_BACKEND))
      ).arrayBuffer(),
    );
    if (index === 0) firstAvatar = { src, hash: hash(body) };
    else {
      assert.notEqual(src, firstAvatar.src);
      assert.notEqual(hash(body), firstAvatar.hash);
    }
  }
  await page.reload();
  await avatar.waitFor();
  await avatar.evaluate((image) => image.decode());
  assert.ok((await avatar.getAttribute('src')).startsWith('/api/v1/avatars/'));
  assert.equal((await api('/auth/me')).user.avatar, canonical);
  const proxy = await fetch(
    new URL(await avatar.getAttribute('src'), process.env.FE_IDN_017_BACKEND),
  );
  assert.equal(proxy.status, 200);
  assert.equal(proxy.headers.get('cache-control'), 'public, max-age=3600');
  assert.equal((await api('/admin/files?category=image')).total, 1);
  await record(9, {
    uploadStatuses: [201, 201],
    proxyOnly: true,
    globalAndPreviewImmediate: true,
    replacementCacheRefreshed: true,
    persistsAfterReload: true,
    dimensions: [256, 256],
    avatarsHiddenFromLibrary: true,
    screenshot: await shot('09-avatar-upload', page),
  });
  const deleting = response(page, '/auth/profile', 'PUT');
  await button(
    page,
    '删除',
    page.locator('.ant-form-item').filter({ has: picker }),
  ).click();
  assert.equal((await deleting).status, 200);
  await avatar.waitFor({ state: 'hidden' });
  assert.ok(!(await api('/auth/me')).user.avatar);
  await page.reload();
  await picker.waitFor({ state: 'attached' });
  assert.equal(await page.locator(`img[src*="${canonical}"]`).count(), 0);
  await record(11, {
    clearProfileStatus: 200,
    previewAndGlobalDefault: true,
    persistsAfterReload: true,
  });
  assert.deepEqual(report.browserErrors, []);
  report.passed = true;
} catch (error) {
  failure = error;
  report.failure = error.message.replace(
    /https?:\/\/[^\s"<>]*X-Amz-[^\s"<>]*/g,
    '[presigned URL omitted]',
  );
  report.failureStack = error.stack?.replace(
    /https?:\/\/[^\s"<>]*X-Amz-[^\s"<>]*/g,
    '[presigned URL omitted]',
  );
  if (page) await shot('failure', page).catch(() => {});
} finally {
  try {
    await cleanup();
  } catch (error) {
    failure ||= error;
    report.cleanupFailure = error.message;
  }
  if (browser) await browser.close();
  report.finishedAt = new Date().toISOString();
  await persist();
}
if (failure) {
  console.error(report.failure || report.cleanupFailure);
  process.exitCode = 1;
}
