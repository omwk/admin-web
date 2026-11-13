import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

// eslint-disable-next-line n/no-extraneous-import -- Workspace browser test tooling.
import { chromium } from 'playwright';

const origin = process.env.SF4_ORIGIN || 'http://127.0.0.1:5666';
const backend = process.env.SF4_BACKEND || 'http://127.0.0.1:18080';
assert.ok(process.env.SF4_ADMIN_PASSWORD, 'Set SF4_ADMIN_PASSWORD');
const output = new URL('../../../docs/evidence/sf-4/', import.meta.url);
await mkdir(output, { recursive: true });
const prefix = `sf4_${Date.now()}`;
const password = `Sf4@${randomBytes(14).toString('hex')}`;
const checks = [];
const browserErrors = [];
const httpErrors = [];
const cleanup = [];
const dictionaries = new Set();
const items = new Set();
const restores = [];
let token;
let user;
let role;
let originalName;
let failure;
let page;
const browser = await chromium.launch({
  headless: true,
  channel: process.env.SF4_BROWSER_CHANNEL || 'msedge',
});
const context = await browser.newContext({
  viewport: { width: 1600, height: 1100 },
  locale: 'zh-CN',
  timezoneId: 'Asia/Shanghai',
});
function watch(target) {
  target.on('pageerror', (error) => browserErrors.push(error.message));
}
async function request(path, method = 'GET', body, bearer = token) {
  const response = await fetch(backend + '/api/v1' + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const envelope = response.status === 204 ? {} : await response.json();
  return { status: response.status, envelope, data: envelope.data };
}
async function api(path, method = 'GET', body, bearer = token) {
  const result = await request(path, method, body, bearer);
  assert.ok(
    result.status >= 200 && result.status < 300,
    `${method} ${path}: ${result.status}/${result.envelope.code}`,
  );
  return result.data;
}
function check(item, assertion, evidence = {}) {
  checks.push({
    item,
    result: 'pass',
    source: 'real-backend-and-browser',
    assertion,
    ...evidence,
  });
  process.stdout.write(`SF4 acceptance ${item}: passed\n`);
}
const button = (name, root = page) =>
  root.getByRole('button', { name: new RegExp(`^${[...name].join('\\s*')}$`) });
const modal = () => page.getByRole('dialog').filter({ visible: true });
const shot = (name, target = page) =>
  target.screenshot({
    path: fileURLToPath(new URL(`${name}.png`, output)),
    fullPage: true,
    animations: 'disabled',
  });
async function response(path, method, action) {
  const pending = page.waitForResponse(
    (result) =>
      new URL(result.url()).pathname === '/api/v1' + path &&
      result.request().method() === method,
  );
  await action();
  const result = await pending;
  const envelope = result.status() === 204 ? {} : await result.json();
  if (result.status() >= 400)
    httpErrors.push({
      path,
      method,
      status: result.status(),
      code: envelope.code,
      message: envelope.message,
      traceId: envelope.trace_id,
    });
  return {
    status: result.status(),
    envelope,
    data: envelope.data,
    body: result.request().postDataJSON(),
  };
}
async function login(target, username, secret) {
  await target.goto(origin + '/auth/login');
  await target.getByPlaceholder('请输入用户名').fill(username);
  await target.getByPlaceholder('密码', { exact: true }).fill(secret);
  const pending = target.waitForResponse(
    (result) =>
      new URL(result.url()).pathname === '/api/v1/auth/login' &&
      result.request().method() === 'POST',
  );
  await target.getByRole('button', { name: 'login', exact: true }).click();
  const result = await pending;
  assert.equal(result.status(), 200);
  await target.waitForURL((url) => !url.pathname.startsWith('/auth/'));
  return (await result.json()).data;
}
async function openDictionaries() {
  await page.goto(origin + '/system/dicts');
  await page
    .getByTestId('dictionary-groups')
    .locator('[data-dict-type="order_status"]')
    .waitFor();
  await page
    .getByTestId('dictionary-items')
    .locator('.ant-spin-spinning')
    .waitFor({ state: 'hidden' });
}
async function select(type) {
  const row = page.locator(`[data-dict-type="${type}"]`);
  await row.locator('button[aria-pressed]').click();
  await page
    .getByTestId('dictionary-items')
    .locator('.ant-spin-spinning')
    .waitFor({ state: 'hidden' });
  assert.equal(
    await row.locator('button[aria-pressed]').getAttribute('aria-pressed'),
    'true',
  );
}
async function openSettings() {
  await page.goto(origin + '/system/settings');
  await page.locator('[data-setting-group="security"]').waitFor();
}
async function tab(group) {
  await page
    .getByRole('tab')
    .filter({ hasText: new RegExp(` ${group}（`) })
    .click();
  await page.locator(`[data-setting-group="${group}"]`).waitFor();
}
async function confirmRemove(path, method, action) {
  await action();
  return response(path, method, () =>
    button('确认删除', page.getByRole('dialog')).click(),
  );
}
try {
  token = (
    await api(
      '/auth/login',
      'POST',
      {
        username: process.env.SF4_ADMIN_USERNAME || 'admin',
        password: process.env.SF4_ADMIN_PASSWORD,
      },
      null,
    )
  ).access_token;
  const system = await api('/admin/dicts?scope=system&page_size=100');
  const business = await api('/admin/dicts?scope=business&page_size=100');
  const settings = await api('/admin/settings');
  const current = settings.find((group) => group.group === 'system');
  originalName = current.items.find(
    (item) => item.schema.key === 'system_name',
  ).value;
  const countByType = {};
  for (const dictionary of [...system.list, ...business.list])
    countByType[dictionary.type] = (
      await api(`/admin/dicts/${dictionary.id}/items?page_size=1`)
    ).total;
  page = await context.newPage();
  watch(page);
  await login(
    page,
    process.env.SF4_ADMIN_USERNAME || 'admin',
    process.env.SF4_ADMIN_PASSWORD,
  );
  await openDictionaries();
  for (const dictionary of [...system.list, ...business.list]) {
    assert.match(
      await page.locator(`[data-dict-type="${dictionary.type}"]`).innerText(),
      new RegExp(`${countByType[dictionary.type]} 项`),
    );
  }
  const groupText = await page.getByTestId('dictionary-groups').innerText();
  assert.ok(
    groupText.includes(`系统字典（${system.total}）`) &&
      groupText.includes(`业务字典（${business.total}）`),
  );
  await shot('01-groups-real');
  check(1, '两组按 scope 分别加载，项数使用真实 item page.total', {
    scopes: { system: system.total, business: business.total },
    countByType,
    screenshot: '01-groups-real.png',
  });

  await select('user_status');
  const right = page.getByTestId('dictionary-items');
  assert.equal(await button('新增项', right).count(), 0);
  assert.equal(await button('删除', right).count(), 0);
  assert.equal(
    await button(
      '删除字典',
      page.locator('[data-dict-type="user_status"]'),
    ).count(),
    0,
  );
  const userDictionary = system.list.find(
    (dictionary) => dictionary.type === 'user_status',
  );
  const systemItems = (await api(`/admin/dicts/${userDictionary.id}/items`))
    .list;
  await button(
    '编辑',
    right.locator(`[data-row-key="${systemItems[0].id}"]`),
  ).click();
  assert.equal(await modal().getByLabel('字典项值').isDisabled(), true);
  assert.equal(await modal().getByLabel('字典项颜色').isDisabled(), true);
  assert.equal(await modal().getByLabel('字典项排序').isEnabled(), true);
  await button('取消', modal()).click();
  await modal().waitFor({ state: 'hidden' });
  const protectedDelete = await request(
    `/admin/dict-items/${systemItems[0].id}`,
    'DELETE',
  );
  const protectedCreate = await request(
    `/admin/dicts/${userDictionary.id}/items`,
    'POST',
    {
      label: 'SF4 system guard',
      value: prefix,
      sort: 0,
      status: 'active',
      color: '',
      extra: {},
    },
  );
  assert.equal(protectedDelete.status, 409);
  assert.equal(protectedCreate.status, 400);
  await shot('02-system-restrictions-real');
  check(
    2,
    'user_status 无新增/删除，仅标签与排序可编辑；直调后端创建400、删除409',
    {
      screenshot: '02-system-restrictions-real.png',
      backend: [
        { status: protectedCreate.status, code: protectedCreate.envelope.code },
        {
          status: protectedDelete.status,
          message: protectedDelete.envelope.message,
        },
      ],
    },
  );

  await select('order_status');
  const orderDictionary = business.list.find(
    (dictionary) => dictionary.type === 'order_status',
  );
  const nonempty = await confirmRemove(
    `/admin/dicts/${orderDictionary.id}`,
    'DELETE',
    () =>
      button(
        '删除字典',
        page.locator('[data-dict-type="order_status"]'),
      ).click(),
  );
  assert.equal(nonempty.status, 409);
  await page
    .getByRole('alert')
    .filter({ hasText: nonempty.envelope.message })
    .waitFor();
  await shot('04-nonempty-conflict-real');
  check(4, '有项时删除真实 order_status 返回409；页面完整显示后端 message', {
    status: nonempty.status,
    message: nonempty.envelope.message,
    traceId: nonempty.envelope.trace_id,
    screenshot: '04-nonempty-conflict-real.png',
  });

  await button('新增项', right).click();
  await modal().getByLabel('字典项标签').fill('SF4 重复值');
  const existing = (await api(`/admin/dicts/${orderDictionary.id}/items`))
    .list[0];
  await modal().getByLabel('字典项值').fill(existing.value);
  const duplicate = await response(
    `/admin/dicts/${orderDictionary.id}/items`,
    'POST',
    () => button('保存字典项', modal()).click(),
  );
  assert.equal(duplicate.status, 409);
  await modal()
    .getByRole('alert')
    .filter({ hasText: duplicate.envelope.message })
    .waitFor();
  await shot('05-duplicate-conflict-real');
  check(5, '重复value返回真实409，表单保留输入并原样显示后端 message', {
    status: duplicate.status,
    message: duplicate.envelope.message,
    traceId: duplicate.envelope.trace_id,
    screenshot: '05-duplicate-conflict-real.png',
  });

  await modal().getByLabel('字典项标签').fill('SF4 新增项');
  await modal().getByLabel('字典项值').fill(prefix);
  await modal().getByLabel('字典项颜色').fill('green');
  const created = await response(
    `/admin/dicts/${orderDictionary.id}/items`,
    'POST',
    () => button('保存字典项', modal()).click(),
  );
  assert.equal(created.status, 201);
  items.add(created.data.id);
  await modal().waitFor({ state: 'hidden' });
  const createdRow = right.locator(`[data-row-key="${created.data.id}"]`);
  await createdRow.waitFor();
  await button('编辑', createdRow).click();
  await modal().getByLabel('字典项标签').fill('SF4 编辑后');
  const edited = await response(
    `/admin/dict-items/${created.data.id}`,
    'PUT',
    () => button('保存字典项', modal()).click(),
  );
  assert.equal(edited.data.label, 'SF4 编辑后');
  await modal().waitFor({ state: 'hidden' });
  await createdRow.getByText('SF4 编辑后', { exact: true }).waitFor();
  await shot('03-business-item-edited-real');
  await button('删除', createdRow).click();
  await button('取消', page.getByRole('dialog')).click();
  assert.ok(
    (await api(`/admin/dicts/${orderDictionary.id}/items`)).list.some(
      (item) => item.id === created.data.id,
    ),
  );
  const deleted = await confirmRemove(
    `/admin/dict-items/${created.data.id}`,
    'DELETE',
    () => button('删除', createdRow).click(),
  );
  assert.equal(deleted.status, 204);
  items.delete(created.data.id);
  await createdRow.waitFor({ state: 'hidden' });
  await button('新增业务字典').click();
  await modal().getByLabel('字典类型').fill(prefix);
  await modal().getByLabel('字典名称').fill('SF4 专用业务字典');
  const createdType = await response('/admin/dicts', 'POST', () =>
    button('保存字典', modal()).click(),
  );
  assert.equal(createdType.status, 201);
  dictionaries.add(createdType.data.id);
  await modal().waitFor({ state: 'hidden' });
  const typeRow = page.locator(`[data-dict-type="${prefix}"]`);
  await typeRow.waitFor();
  await button('编辑字典', typeRow).click();
  await modal().getByLabel('字典名称').fill('SF4 业务字典已改名');
  const editedType = await response(
    `/admin/dicts/${createdType.data.id}`,
    'PUT',
    () => button('保存字典', modal()).click(),
  );
  assert.equal(editedType.data.name, 'SF4 业务字典已改名');
  await modal().waitFor({ state: 'hidden' });
  await typeRow.getByText('SF4 业务字典已改名', { exact: true }).waitFor();
  await shot('03-business-type-edited-real');
  const deletedType = await confirmRemove(
    `/admin/dicts/${createdType.data.id}`,
    'DELETE',
    () => button('删除字典', typeRow).click(),
  );
  assert.equal(deletedType.status, 204);
  dictionaries.delete(createdType.data.id);
  await typeRow.waitFor({ state: 'hidden' });
  check(
    3,
    'order_status 项新增、编辑、取消删除与确认删除；专用业务字典类型新增/编辑/删除均通过真实接口',
    {
      itemRequests: {
        create: created.status,
        update: edited.status,
        delete: deleted.status,
      },
      dictionary: {
        create: createdType.status,
        update: editedType.status,
        delete: deletedType.status,
      },
      screenshots: [
        '03-business-item-edited-real.png',
        '03-business-type-edited-real.png',
      ],
    },
  );

  const product = (await api('/admin/products?page=1&page_size=1')).list[0];
  assert.ok(product, 'Existing real product required');
  let productDictionary = (
    await api('/admin/dicts?scope=business&page_size=100')
  ).list.find((dictionary) => dictionary.type === 'product_status');
  if (!productDictionary) {
    productDictionary = await api('/admin/dicts', 'POST', {
      type: 'product_status',
      name: 'SF4 商品状态验证',
      status: 'active',
    });
    dictionaries.add(productDictionary.id);
  }
  let productItem = (
    await api(`/admin/dicts/${productDictionary.id}/items?page_size=100`)
  ).list.find((item) => item.value === product.status);
  if (!productItem) {
    productItem = await api(
      `/admin/dicts/${productDictionary.id}/items`,
      'POST',
      {
        value: product.status,
        label: 'SF4 修改前',
        sort: 0,
        status: 'active',
        color: 'blue',
        extra: {},
      },
    );
    items.add(productItem.id);
  } else {
    restores.push({
      id: productItem.id,
      input: {
        label: productItem.label,
        value: productItem.value,
        sort: productItem.sort,
        status: productItem.status,
        color: productItem.color,
        extra: productItem.extra,
      },
    });
  }
  await openDictionaries();
  await select('product_status');
  await button(
    '编辑',
    right.locator(`[data-row-key="${productItem.id}"]`),
  ).click();
  const newLabel = `SF4 商品状态已更新 ${prefix}`;
  await modal().getByLabel('字典项标签').fill(newLabel);
  await response(`/admin/dict-items/${productItem.id}`, 'PUT', () =>
    button('保存字典项', modal()).click(),
  );
  await modal().waitFor({ state: 'hidden' });
  const metaResponse = page.waitForResponse(
    (result) =>
      new URL(result.url()).pathname === '/api/v1/meta/dicts/product_status',
  );
  await page.goto(origin + '/catalog/products');
  assert.equal((await metaResponse).status(), 200);
  await page
    .locator(`[data-row-key="${product.id}"]`)
    .getByText(newLabel, { exact: true })
    .waitFor();
  await shot('06-product-metadata-real');
  const meta = await api('/meta/dicts/product_status');
  assert.equal(
    meta.find((item) => item.value === product.status).label,
    newLabel,
  );
  check(
    6,
    '界面修改label后，真实商品列表通过真实/meta/dicts/product_status显示新文案',
    {
      productId: product.id,
      value: product.status,
      label: newLabel,
      metadataStatus: 200,
      dedicatedDictionaryCreated: dictionaries.has(productDictionary.id),
      screenshot: '06-product-metadata-real.png',
    },
  );

  await openSettings();
  const expected = { security: 6, system: 3, notification: 2, sync: 3 };
  assert.deepEqual(
    Object.fromEntries(
      settings.map((group) => [group.group, group.items.length]),
    ),
    { notification: 2, security: 6, sync: 3, system: 3 },
  );
  const values = {};
  for (const [group, count] of Object.entries(expected)) {
    await tab(group);
    const root = page.locator(`[data-setting-group="${group}"]`);
    assert.equal(await root.locator('[data-setting-key]').count(), count);
    const data = settings.find((entry) => entry.group === group);
    values[group] = Object.fromEntries(
      data.items.map((item) => [item.schema.key, item.value]),
    );
    for (const item of data.items) {
      const control = root.getByLabel(item.schema.desc, { exact: true });
      if (item.schema.type === 'boolean')
        assert.equal(
          await control.getAttribute('aria-checked'),
          String(item.value),
        );
      else if (item.schema.enum)
        assert.ok(
          (
            await root
              .locator(`[data-setting-key="${item.schema.key}"]`)
              .innerText()
          ).includes(String(item.value)),
        );
      else assert.equal(await control.inputValue(), String(item.value));
    }
    await shot(`07-settings-${group}-real`);
  }
  check(
    7,
    '按更新口径四组14项，逐项核对真实schema描述、默认值、当前值与表单控件',
    {
      counts: expected,
      values,
      screenshots: Object.keys(expected).map(
        (group) => `07-settings-${group}-real.png`,
      ),
    },
  );
  await tab('security');
  let securityWrites = 0;
  const watchSecurity = (request_) => {
    if (
      request_.method() === 'PUT' &&
      new URL(request_.url()).pathname === '/api/v1/admin/settings/security'
    )
      securityWrites++;
  };
  page.on('request', watchSecurity);
  await page.getByLabel('密码最小字符数', { exact: true }).fill('3');
  await button(
    '保存配置',
    page.locator('[data-setting-group="security"]'),
  ).click();
  await page
    .locator(
      '[data-setting-key="password_min_length"] .ant-form-item-explain-error',
    )
    .waitFor();
  assert.equal(securityWrites, 0);
  await shot('08-range-validation-real');
  page.off('request', watchSecurity);
  check(8, '密码最小长度填3，schema范围8–64触发前端错误，没有PUT请求', {
    submitted: 3,
    schemaMin: 8,
    schemaMax: 64,
    writes: securityWrites,
    screenshot: '08-range-validation-real.png',
  });

  await tab('system');
  const changedName = `SF4 持久化 ${prefix}`;
  await page.getByLabel('系统名称', { exact: true }).fill(changedName);
  const savedName = await response('/admin/settings/system', 'PUT', () =>
    button('保存配置', page.locator('[data-setting-group="system"]')).click(),
  );
  assert.equal(savedName.status, 200);
  assert.deepEqual(savedName.body, { system_name: changedName });
  await page
    .getByText('已保存，部分配置对新会话生效', { exact: true })
    .waitFor();
  await openSettings();
  await tab('system');
  assert.equal(
    await page.getByLabel('系统名称', { exact: true }).inputValue(),
    changedName,
  );
  assert.equal(
    (await api('/admin/settings/system')).items.find(
      (item) => item.schema.key === 'system_name',
    ).value,
    changedName,
  );
  await shot('10-saved-after-refresh-real');
  check(
    10,
    '系统名称真实PUT保存，页面刷新与GET均保留新值，成功提示含新会话说明',
    {
      status: savedName.status,
      changedKeys: Object.keys(savedName.body),
      persistedValue: changedName,
      screenshot: '10-saved-after-refresh-real.png',
    },
  );

  const fixtureSettings = structuredClone(await api('/admin/settings'));
  const readOnlyField = fixtureSettings
    .find((group) => group.group === 'system')
    .items.find((item) => item.schema.key === 'timezone');
  readOnlyField.schema.read_only = true;
  await page.route('**/api/v1/admin/settings', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 0,
        message: 'ok',
        trace_id: 'sf4-readonly-schema-fixture',
        data: fixtureSettings,
      }),
    }),
  );
  await openSettings();
  await tab('system');
  assert.equal(
    await page.getByLabel('IANA 时区名称', { exact: true }).isDisabled(),
    true,
  );
  await page
    .locator('[data-setting-key="timezone"]')
    .getByText('不可修改', { exact: true })
    .waitFor();
  await shot('09-readonly-schema-fixture');
  await page
    .getByLabel('系统名称', { exact: true })
    .fill(changedName + ' fixture');
  const readOnlySave = await response('/admin/settings/system', 'PUT', () =>
    button('保存配置', page.locator('[data-setting-group="system"]')).click(),
  );
  assert.equal(readOnlySave.status, 200);
  assert.deepEqual(readOnlySave.body, {
    system_name: changedName + ' fixture',
  });
  await page.unroute('**/api/v1/admin/settings');
  check(9, 'read_only=true时输入禁用、有不可修改标注，真实保存请求省略该key', {
    source: 'schema-fixture-with-real-save',
    reason:
      '真实14项schema全部read_only=false；仅GET响应timezone.read_only改为true',
    changedKeys: Object.keys(readOnlySave.body),
    screenshot: '09-readonly-schema-fixture.png',
  });

  const permissions = Object.values(await api('/admin/permissions')).flat();
  const readonlyCodes = ['system:dict:list', 'system:setting:list'];
  role = await api('/admin/roles', 'POST', {
    code: prefix,
    name: 'SF4 只读验收',
    data_scope: 'all',
    remark: null,
    status: 'active',
  });
  await api(`/admin/roles/${role.id}/permissions`, 'PUT', {
    permission_ids: permissions
      .filter((permission) => readonlyCodes.includes(permission.code))
      .map((permission) => permission.id),
  });
  user = await api('/admin/users', 'POST', {
    username: prefix,
    nickname: 'SF4 只读账号',
    password: password + '0',
    dept_id: 1,
    status: 'active',
  });
  await api(`/admin/users/${user.id}/roles`, 'PUT', { role_ids: [role.id] });
  const initial = await api(
    '/auth/login',
    'POST',
    { username: user.username, password: password + '0' },
    null,
  );
  await api(
    '/auth/password',
    'PUT',
    { oldPassword: password + '0', newPassword: password },
    initial.access_token,
  );
  const limitedContext = await browser.newContext({
    viewport: { width: 1600, height: 1100 },
    locale: 'zh-CN',
  });
  const limitedPage = await limitedContext.newPage();
  watch(limitedPage);
  const limitedAuth = await login(limitedPage, user.username, password);
  await limitedPage.goto(origin + '/system/settings');
  await limitedPage.locator('[data-setting-group="security"]').waitFor();
  assert.equal(await button('保存配置', limitedPage).count(), 0);
  assert.equal(
    await limitedPage
      .getByLabel('密码最小字符数', { exact: true })
      .isDisabled(),
    true,
  );
  await shot('11-settings-readonly-real', limitedPage);
  const deniedSave = await request(
    '/admin/settings/system',
    'PUT',
    { system_name: originalName },
    limitedAuth.access_token,
  );
  assert.equal(deniedSave.status, 403);
  assert.equal(deniedSave.envelope.code, 20_107);
  await limitedPage.goto(origin + '/system/dicts');
  await limitedPage
    .getByTestId('dictionary-groups')
    .locator('[data-dict-type="order_status"]')
    .waitFor();
  assert.equal(await button('新增业务字典', limitedPage).count(), 0);
  assert.equal(await button('编辑字典', limitedPage).count(), 0);
  assert.equal(await button('删除字典', limitedPage).count(), 0);
  assert.equal(await button('编辑', limitedPage).count(), 0);
  await shot('11-dictionaries-readonly-real', limitedPage);
  await api(`/admin/roles/${role.id}/permissions`, 'PUT', {
    permission_ids: [],
  });
  const deniedList = [];
  for (const path of ['/admin/settings', '/admin/dicts']) {
    const result = await request(
      path,
      'GET',
      undefined,
      limitedAuth.access_token,
    );
    assert.equal(result.status, 403);
    deniedList.push({
      path,
      status: result.status,
      code: result.envelope.code,
    });
  }
  await limitedContext.close();
  const forbiddenContext = await browser.newContext({
    viewport: { width: 1600, height: 1100 },
    locale: 'zh-CN',
  });
  const forbiddenPage = await forbiddenContext.newPage();
  watch(forbiddenPage);
  await login(forbiddenPage, user.username, password);
  for (const path of ['/system/dicts', '/system/settings']) {
    await forbiddenPage.goto(origin + path);
    await forbiddenPage.locator('p.text-2xl').waitFor();
    assert.equal(
      await forbiddenPage
        .getByRole('menuitem')
        .filter({ hasText: /数据字典|系统配置/ })
        .count(),
      0,
    );
  }
  await shot('11-no-list-forbidden-real', forbiddenPage);
  await forbiddenContext.close();
  check(
    11,
    '真实只读账号没有保存/CRUD按钮；直接PUT配置403。移除list权限后菜单隐藏、页面403、两GET接口403',
    {
      permissions: readonlyCodes,
      deniedSave: {
        status: deniedSave.status,
        code: deniedSave.envelope.code,
        traceId: deniedSave.envelope.trace_id,
      },
      deniedList,
      screenshots: [
        '11-settings-readonly-real.png',
        '11-dictionaries-readonly-real.png',
        '11-no-list-forbidden-real.png',
      ],
    },
  );
  assert.deepEqual(browserErrors, []);
} catch (error) {
  failure = { message: error.message, stack: error.stack };
  if (page) await shot('failure').catch(() => {});
} finally {
  await browser.close();
  async function clean(resource, action) {
    try {
      await action();
      cleanup.push({ resource, result: 'restored-or-removed' });
    } catch (error) {
      cleanup.push({ resource, result: 'failed', message: error.message });
    }
  }
  if (originalName !== undefined)
    await clean('system_name', () =>
      api('/admin/settings/system', 'PUT', { system_name: originalName }),
    );
  for (const item of restores)
    await clean('existing dictionary label', () =>
      api(`/admin/dict-items/${item.id}`, 'PUT', item.input),
    );
  for (const id of items)
    await clean(`temporary item ${id}`, () =>
      api(`/admin/dict-items/${id}`, 'DELETE'),
    );
  for (const id of dictionaries)
    await clean(`temporary dictionary ${id}`, () =>
      api(`/admin/dicts/${id}`, 'DELETE'),
    );
  if (user)
    await clean('temporary user', async () => {
      await api(`/admin/users/${user.id}/roles`, 'PUT', { role_ids: [] });
      await api(`/admin/users/${user.id}`, 'DELETE');
    });
  if (role)
    await clean('temporary role', async () => {
      await api(`/admin/roles/${role.id}/permissions`, 'PUT', {
        permission_ids: [],
      });
      await api(`/admin/roles/${role.id}`, 'DELETE');
    });
  await writeFile(
    new URL('real-ui.json', output),
    JSON.stringify(
      {
        source: 'real-18080',
        date: new Date().toISOString(),
        checks: checks.sort((a, b) => a.item - b.item),
        browserErrors,
        httpErrors,
        cleanup,
        ...(failure ? { failure } : {}),
      },
      null,
      2,
    ),
  );
}
assert.ok(!failure, failure?.message);
assert.ok(
  cleanup.every((entry) => entry.result === 'restored-or-removed'),
  'Cleanup succeeded',
);
assert.equal(checks.length, 11);
assert.deepEqual(
  checks.map((check) => check.item),
  Array.from({ length: 11 }, (_, index) => index + 1),
);
process.stdout.write(
  JSON.stringify({
    passed: checks.length,
    browserErrors: browserErrors.length,
    cleanup: cleanup.length,
  }) + '\n',
);
