import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

// eslint-disable-next-line n/no-extraneous-import -- Workspace browser test tooling.
import { chromium } from 'playwright';

const origin = process.env.FE_IDN_ORIGIN || 'http://127.0.0.1:5666';
const backend = process.env.FE_IDN_BACKEND || 'http://127.0.0.1:18080';
const output = new URL('../../../docs/reports/fe-idn-004/', import.meta.url);
assert.ok(process.env.FE_IDN_ADMIN_PASSWORD, 'Set FE_IDN_ADMIN_PASSWORD');
await mkdir(output, { recursive: true });
let token;
async function api(path, method = 'GET', body) {
  const response = await fetch(backend + '/api/v1' + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const envelope = response.status === 204 ? {} : await response.json();
  assert.ok(
    response.ok,
    method + ' ' + path + ': ' + response.status + '/' + envelope.code,
  );
  return envelope.data;
}
const auth = await api('/auth/login', 'POST', {
  tenant: 'default',
  account: 'admin',
  password: process.env.FE_IDN_ADMIN_PASSWORD,
});
token = auth.access_token;
const browser = await chromium.launch({
  headless: true,
  channel: process.env.FE_IDN_BROWSER_CHANNEL || 'msedge',
});
const context = await browser.newContext({
  viewport: { width: 1600, height: 1100 },
  locale: 'zh-CN',
});
const page = await context.newPage();
page.setDefaultTimeout(20_000);
const browserErrors = [];
const network = [];
page.on('pageerror', (error) => browserErrors.push(error.message));
page.on('response', (response) => {
  const path = new URL(response.url()).pathname;
  if (path.includes('/meta/dicts/'))
    network.push({
      path,
      status: response.status(),
      method: response.request().method(),
    });
});
const checks = [];
const cleanup = [];
let failure;
const button = (label, root = page) =>
  root.getByRole('button', {
    name: new RegExp('^' + [...label].join('\\s*') + '$'),
  });
const dialog = () => page.getByRole('dialog').filter({ visible: true });
const shot = (name) =>
  page.screenshot({
    path: fileURLToPath(new URL(name + '.png', output)),
    fullPage: true,
    animations: 'disabled',
  });
const check = (item, assertion, evidence) => {
  checks.push({ item, assertion, ...evidence });
  process.stdout.write('FE-IDN-004 check ' + item + ' passed\n');
};
async function open(path) {
  await page.goto(origin + path);
  await page.locator('.ant-spin-spinning').waitFor({ state: 'hidden' });
}
async function dictionaries() {
  await open('/system/dicts');
  await page.locator('[data-dict-type="product_status"]').waitFor();
  await button(
    '编辑字典',
    page.locator('[data-dict-type="product_status"]'),
  ).waitFor();
  await page
    .getByTestId('dictionary-items')
    .locator('.ant-spin-spinning')
    .waitFor({ state: 'hidden' });
}
async function save(path, label) {
  const pending = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/v1' + path &&
      response.request().method() === 'PUT',
  );
  await button(label, dialog()).click();
  const response = await pending;
  assert.equal(response.status(), 200);
  const data = (await response.json()).data;
  await dialog().waitFor({ state: 'hidden' });
  return {
    data,
    body: response.request().postDataJSON(),
    status: response.status(),
  };
}
async function selectStatus(label, option) {
  await page.getByLabel(label, { exact: true }).click();
  await page
    .locator('.ant-select-dropdown:visible')
    .getByText(option, { exact: true })
    .click();
}
const restores = [];
try {
  await page.goto(origin + '/auth/login');
  await page.getByLabel('企业代码', { exact: true }).fill('default');
  await page.getByLabel('账号', { exact: true }).fill('admin');
  await page
    .getByPlaceholder('密码', { exact: true })
    .fill(process.env.FE_IDN_ADMIN_PASSWORD);
  await button('login').click();
  await page.waitForURL((url) => !url.pathname.startsWith('/auth'));

  const all = (await api('/admin/dicts?scope=system&page_size=100')).list;
  assert.equal(all.length, 9);
  const productType = all.find((entry) => entry.type === 'product_status');
  const userType = all.find((entry) => entry.type === 'user_status');
  const products = await api('/admin/products?page=1&page_size=20');
  const product = products.list[0];
  assert.ok(products.list.length >= 20, 'Twenty real product rows required');
  const productItems = (
    await api('/admin/dicts/' + productType.id + '/items?page_size=100')
  ).list;
  const productItem = productItems.find(
    (entry) => entry.value === product.status,
  );
  assert.ok(productItem);
  const itemInput = ({ value, label, sort, color, status, extra }) => ({
    value,
    label,
    sort,
    color,
    status,
    extra,
  });
  restores.push({
    resource: 'product item',
    path: '/admin/dict-items/' + productItem.id,
    input: itemInput(productItem),
  });
  restores.push({
    resource: 'product dictionary',
    path: '/admin/dicts/' + productType.id,
    input: {
      type: productType.type,
      name: productType.name,
      status: productType.status,
    },
  });
  restores.push({
    resource: 'user dictionary',
    path: '/admin/dicts/' + userType.id,
    input: {
      type: userType.type,
      name: userType.name,
      status: userType.status,
    },
  });

  await open('/catalog/products');
  const firstRow = page
    .getByTestId('product-table')
    .locator('[data-row-key="' + product.id + '"]');
  await firstRow.getByText(productItem.label, { exact: true }).waitFor();
  await shot('01-label-color');
  check(1, 'Real metadata label/color rendered by DictTag', {
    value: product.status,
    label: productItem.label,
    color: productItem.color,
    screenshot: '01-label-color.png',
  });

  network.length = 0;
  await page.reload();
  await firstRow.getByText(productItem.label, { exact: true }).waitFor();
  const initialReads = network.filter((entry) =>
    entry.path.endsWith('/product_status'),
  );
  assert.equal(initialReads.length, 1);
  const rowCount = await page
    .getByTestId('product-table')
    .locator('tbody tr[data-row-key]')
    .count();
  assert.equal(rowCount, 20);
  await button('查询').click();
  await page
    .getByTestId('product-table')
    .locator('.ant-spin-spinning')
    .waitFor({ state: 'hidden' });
  assert.equal(
    network.filter((entry) => entry.path.endsWith('/product_status')).length,
    1,
  );
  check(
    10,
    'Twenty rows and repeated search share one product_status metadata request',
    {
      rows: rowCount,
      requests: [...initialReads],
      screenshot: '10-network-panel.png',
      unitEvidence:
        '5-minute expiry, cross-page reuse and pending request deduplication unit tests',
    },
  );
  await writeFile(
    new URL('10-page-requests.json', output),
    JSON.stringify(
      { page: '/catalog/products', rows: rowCount, requests: initialReads },
      null,
      2,
    ),
  );

  await page.route('**/api/v1/meta/dicts/product_status', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ code: 0, data: [] }),
    }),
  );
  await page.reload();
  await firstRow.getByText(product.status, { exact: true }).waitFor();
  await shot('02-missing-raw-code');
  check(2, 'Missing dictionary entry renders raw product code', {
    source: 'metadata-empty-response-fixture; real product list',
    value: product.status,
    screenshot: '02-missing-raw-code.png',
  });
  await page.unroute('**/api/v1/meta/dicts/product_status');

  await page.route('**/api/v1/meta/dicts/product_status', (route) =>
    route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ code: 50_000, message: 'test metadata failure' }),
    }),
  );
  await page.reload();
  await firstRow.getByText(product.status, { exact: true }).waitFor();
  await shot('03-metadata-500');
  check(
    3,
    'Metadata HTTP 500 preserves the real product table and raw status',
    {
      source: 'metadata-500-fixture; real product list',
      rows: await page
        .getByTestId('product-table')
        .locator('tbody tr[data-row-key]')
        .count(),
      screenshot: '03-metadata-500.png',
    },
  );
  await page.unroute('**/api/v1/meta/dicts/product_status');

  await dictionaries();
  const typeRow = page.locator('[data-dict-type="product_status"]');
  await button('编辑字典', typeRow).click();
  assert.equal(
    await dialog().getByLabel('字典类型', { exact: true }).isDisabled(),
    true,
  );
  assert.equal(
    await dialog().getByLabel('字典名称', { exact: true }).isEnabled(),
    true,
  );
  const newName = '商品状态（字典消费验收）';
  await dialog().getByLabel('字典名称', { exact: true }).fill(newName);
  const renamed = await save('/admin/dicts/' + productType.id, '保存字典');
  await typeRow.getByText(newName, { exact: true }).waitFor();
  await shot('09-system-dictionary-renamed');
  assert.equal(renamed.body.type, productType.type);
  await typeRow.locator('button[aria-pressed]').click();
  const itemsRoot = page.getByTestId('dictionary-items');
  const itemRow = itemsRoot.locator('[data-row-key="' + productItem.id + '"]');
  await button('编辑', itemRow).click();
  assert.equal(
    await dialog().getByLabel('字典项值', { exact: true }).isDisabled(),
    true,
  );
  assert.equal(
    await dialog().getByLabel('字典项颜色', { exact: true }).isEnabled(),
    true,
  );
  const changedLabel = '商品字典实时文案';
  await dialog().getByLabel('字典项标签', { exact: true }).fill(changedLabel);
  await dialog().getByLabel('字典项颜色', { exact: true }).fill('#722ed1');
  await dialog()
    .getByLabel('字典项排序', { exact: true })
    .fill(String(productItem.sort + 10));
  const edited = await save(
    '/admin/dict-items/' + productItem.id,
    '保存字典项',
  );
  assert.equal(edited.body.value, productItem.value);
  assert.equal(edited.body.color, '#722ed1');
  await itemRow.getByText(changedLabel, { exact: true }).waitFor();
  await button('编辑', itemRow).click();
  await shot('09-system-item-editable');
  await selectStatus('字典项状态', '停用');
  const disabledItem = await save(
    '/admin/dict-items/' + productItem.id,
    '保存字典项',
  );
  assert.equal(disabledItem.data.status, 'disabled');
  assert.equal(
    (await api('/meta/dicts/product_status')).some(
      (entry) => entry.value === productItem.value,
    ),
    false,
  );
  await itemRow.getByText('停用', { exact: true }).waitFor();
  await shot('09-system-item-disabled');
  await button('编辑', itemRow).click();
  await selectStatus('字典项状态', '启用');
  const reenabledItem = await save(
    '/admin/dict-items/' + productItem.id,
    '保存字典项',
  );
  assert.equal(reenabledItem.data.status, 'active');
  await button('编辑', itemRow).click();
  await button('取消', dialog()).click();
  assert.equal(await button('新增项', itemsRoot).count(), 0);
  assert.equal(await button('删除', itemsRoot).count(), 0);
  assert.equal(await button('删除字典', typeRow).count(), 0);

  await open('/catalog/products');
  await firstRow.getByText(changedLabel, { exact: true }).waitFor();
  await page.reload();
  await firstRow.getByText(changedLabel, { exact: true }).waitFor();
  assert.equal(
    await firstRow
      .locator('.ant-tag')
      .getByText(changedLabel, { exact: true })
      .count(),
    1,
  );
  await shot('04-product-updated-label');
  check(
    4,
    'Editing system product_status label updates the real product list after refresh',
    {
      status: edited.status,
      value: product.status,
      label: changedLabel,
      color: edited.body.color,
      screenshot: '04-product-updated-label.png',
    },
  );
  await firstRow.getByRole('link').click();
  await page.waitForURL('**/catalog/products/' + product.id);
  await page.getByText('商品概览', { exact: true }).waitFor();
  await page
    .locator('.ant-card')
    .filter({ has: page.getByText('商品概览', { exact: true }) })
    .locator('.ant-tag')
    .getByText(changedLabel, { exact: true })
    .waitFor();
  await shot('04-product-detail');

  await open('/system/tenants');
  await page
    .getByTestId('tenant-table')
    .getByText('已停用', { exact: true })
    .first()
    .waitFor();
  assert.equal(
    await page
      .getByTestId('tenant-table')
      .getByText('suspended', { exact: true })
      .count(),
    0,
  );
  await shot('05-tenant-status');
  check(5, 'Suspended tenants render 已停用 from tenant_status', {
    screenshot: '05-tenant-status.png',
  });

  const auditMeta = await api('/meta/dicts/audit_result');
  const resultPages = [];
  for (const path of ['/system/audit-logs', '/system/login-logs']) {
    await open(path);
    await page
      .locator('tbody tr[data-row-key] .ant-tag:visible')
      .getByText(auditMeta.find((entry) => entry.value === 'success').label, {
        exact: true,
      })
      .first()
      .waitFor();
    const name = path.endsWith('/audit-logs')
      ? '06-audit-results'
      : '06-login-results';
    await shot(name);
    resultPages.push({ path, screenshot: name + '.png' });
  }
  check(6, 'Audit and login log result tags consume audit_result metadata', {
    metadata: auditMeta.map(({ value, label, color }) => ({
      value,
      label,
      color,
    })),
    pages: resultPages,
  });

  const enableType = all.find((entry) => entry.type === 'enable_status');
  const enableItem = (
    await api('/admin/dicts/' + enableType.id + '/items?page_size=100')
  ).list.find((entry) => entry.value === 'active');
  restores.push({
    resource: 'enable item',
    path: '/admin/dict-items/' + enableItem.id,
    input: itemInput(enableItem),
  });
  const formLabel = '字典驱动启用选项';
  await api('/admin/dict-items/' + enableItem.id, 'PUT', {
    ...itemInput(enableItem),
    label: formLabel,
  });
  await open('/system/roles');
  await page
    .locator('tbody .ant-tag')
    .getByText(formLabel, { exact: true })
    .first()
    .waitFor();
  await button('新建角色').click();
  await page.getByLabel('角色状态', { exact: true }).click();
  await page
    .locator('.ant-select-dropdown:visible')
    .getByText(formLabel, { exact: true })
    .waitFor();
  await shot('07-dictionary-options');
  await dialog().getByText('角色编码', { exact: true }).click();
  await button('取消', dialog()).click();
  await page.route('**/api/v1/meta/dicts/enable_status', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ code: 0, data: [] }),
    }),
  );
  await page.reload();
  await button('新建角色').click();
  await page.getByLabel('角色状态', { exact: true }).click();
  await page
    .locator('.ant-select-dropdown:visible')
    .getByText('启用', { exact: true })
    .waitFor();
  await shot('07-empty-dictionary-options');
  await dialog().getByText('角色编码', { exact: true }).click();
  await button('取消', dialog()).click();
  await page.unroute('**/api/v1/meta/dicts/enable_status');
  check(
    7,
    'Role form uses a real edited dictionary label and falls back to local options for empty metadata',
    {
      editedLabel: formLabel,
      screenshots: [
        '07-dictionary-options.png',
        '07-empty-dictionary-options.png',
      ],
    },
  );

  await api('/admin/dicts/' + userType.id, 'PUT', {
    type: userType.type,
    name: userType.name,
    status: 'disabled',
  });
  assert.deepEqual(await api('/meta/dicts/user_status'), []);
  const bootstrapReadsStart = network.length;
  await dictionaries();
  const userRow = page.locator('[data-dict-type="user_status"]');
  await button('编辑字典', userRow).click();
  await page.getByLabel('字典状态', { exact: true }).click();
  for (const label of ['启用', '停用'])
    await page
      .locator('.ant-select-dropdown:visible')
      .getByText(label, { exact: true })
      .waitFor();
  await page
    .locator('.ant-select-dropdown:visible')
    .getByText('启用', { exact: true })
    .click();
  await shot('09-bootstrap-disabled-user-dictionary');
  const enabled = await save('/admin/dicts/' + userType.id, '保存字典');
  assert.equal(enabled.data.status, 'active');
  assert.equal(
    network.slice(bootstrapReadsStart).length,
    0,
    'Maintenance must not request metadata',
  );
  check(
    9,
    'System name edit succeeds; immutable fields/actions protected; maintenance re-enables disabled user_status without metadata',
    {
      renamed: { status: renamed.status, name: renamed.data.name },
      itemEdit: {
        status: edited.status,
        changedKeys: ['label', 'color', 'sort', 'status'],
        statusUpdates: [disabledItem.data.status, reenabledItem.data.status],
      },
      bootstrapMetadataRequests: 0,
      screenshots: [
        '09-system-dictionary-renamed.png',
        '09-system-item-editable.png',
        '09-bootstrap-disabled-user-dictionary.png',
      ],
    },
  );

  assert.deepEqual(browserErrors, []);
} catch (error) {
  failure = { message: error.message, stack: error.stack };
  await shot('failure').catch(() => {});
} finally {
  await browser.close();
  for (const restore of restores.reverse()) {
    try {
      await api(restore.path, 'PUT', restore.input);
      cleanup.push({ resource: restore.resource, restored: true });
    } catch (error) {
      cleanup.push({
        resource: restore.resource,
        restored: false,
        message: error.message,
      });
    }
  }
  await writeFile(
    new URL('ui.json', output),
    JSON.stringify(
      {
        source: 'real-18080',
        date: new Date().toISOString(),
        checks: checks.sort((a, b) => a.item - b.item),
        browserErrors,
        cleanup,
        failure,
      },
      null,
      2,
    ),
  );
}
assert.ok(!failure, failure?.message);
assert.ok(
  cleanup.every((entry) => entry.restored),
  'All temporary display edits restored',
);
assert.equal(checks.length, 9);
process.stdout.write(
  JSON.stringify({
    uiChecks: checks.length,
    browserErrors: browserErrors.length,
    restored: cleanup.length,
  }) + '\n',
);
