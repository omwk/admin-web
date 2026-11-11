import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

// eslint-disable-next-line n/no-extraneous-import -- Workspace browser test tooling.
import { chromium } from 'playwright';

const origin = process.env.FE2_ORIGIN || 'http://127.0.0.1:5666';
const phase =
  process.argv
    .find((argument) => argument.startsWith('--phase='))
    ?.split('=')[1] || 'list';
assert.ok(process.env.FE2_ADMIN_PASSWORD, 'Set FE2_ADMIN_PASSWORD');
if (phase === 'full')
  assert.ok(process.env.FE2_SALES_PASSWORD, 'Set FE2_SALES_PASSWORD');
const output = new URL('../docs/evidence/fe-2/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  channel: process.platform === 'win32' ? 'chrome' : undefined,
  headless: true,
});
const context = await browser.newContext({
  locale: 'zh-CN',
  timezoneId: 'Asia/Shanghai',
  viewport: { width: 1600, height: 1100 },
});
const page = await context.newPage();
const checks = [];
const requests = [];
const errors = [];
const responses = [];
let temporaryProduct;
let failure;
page.on('pageerror', (error) => errors.push(error.message));
page.on('response', async (response) => {
  const path = new URL(response.url()).pathname;
  if (!path.startsWith('/api/')) return;
  const body = await response.json().catch(() => undefined);
  responses.push({ path, status: response.status(), code: body?.code });
});
page.on('request', (request) => {
  const url = new URL(request.url());
  if (url.pathname.startsWith('/api/v1/admin/'))
    requests.push({
      method: request.method(),
      path: url.pathname,
      query: Object.fromEntries(url.searchParams),
    });
});
const screenshot = (name) =>
  page.screenshot({
    animations: 'disabled',
    fullPage: true,
    path: fileURLToPath(new URL(`${name}.png`, output)),
  });
const table = () => page.locator('.ant-table-wrapper').first();
const rows = () => table().locator('tbody tr.ant-table-row');
const productResponse = () => {
  const response = page.waitForResponse(
    (candidate) =>
      new URL(candidate.url()).pathname === '/api/v1/admin/products',
  );
  void response.catch(() => {});
  return response;
};
const waitRows = async (data) => {
  await page.waitForFunction(
    (count) =>
      document.querySelectorAll(
        '[data-testid="product-table"] tbody tr.ant-table-row',
      ).length === count,
    data.list.length,
  );
  assert.deepEqual(
    await rows().evaluateAll((elements) =>
      elements.map((element) => element.getAttribute('data-row-key')),
    ),
    data.list.map(({ id }) => String(id)),
  );
  await table().getByText(`共 ${data.total} 条`, { exact: true }).waitFor();
};
const recordPage = (data) => ({
  page: data.page,
  total: data.total,
  page_size: data.page_size,
  ids: data.list.map(({ id }) => id),
});
const selectSort = async (label) => {
  const response = productResponse();
  await page.getByLabel('排序', { exact: true }).press('ArrowDown');
  await page
    .locator('.ant-select-dropdown:visible')
    .getByText(label, { exact: true })
    .click();
  const result = await response;
  assert.equal(result.status(), 200);
  const body = await result.json();
  await waitRows(body.data);
  return {
    sort: new URL(result.url()).searchParams.get('sort'),
    ...recordPage(body.data),
  };
};
const jump = async (target) => {
  const response = productResponse();
  const input = table().locator('.ant-pagination-options-quick-jumper input');
  await input.fill(String(target));
  await input.press('Enter');
  let result = await response;
  let data = (await result.json()).data;
  if (data.page !== target) {
    result = await page.waitForResponse(
      async (candidate) =>
        new URL(candidate.url()).pathname === '/api/v1/admin/products' &&
        (await candidate.json()).data?.page === target,
    );
    data = (await result.json()).data;
  }
  assert.equal(data.page, target);
  await waitRows(data);
  return {
    query: Object.fromEntries(new URL(result.url()).searchParams),
    ...recordPage(data),
  };
};

try {
  await page.goto(`${origin}/auth/login`);
  await page
    .getByPlaceholder('请输入用户名')
    .fill(process.env.FE2_ADMIN_USERNAME || 'admin');
  await page
    .getByPlaceholder('密码', { exact: true })
    .fill(process.env.FE2_ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'login', exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/auth'));
  const firstResponse = productResponse();
  await page.goto(`${origin}/catalog/products`);
  const initial = (await (await firstResponse).json()).data;
  await waitRows(initial);
  assert.ok(initial.list.length >= 10);
  for (const heading of [
    '主图',
    '标题',
    '类目',
    '价格区间',
    'SKU 数',
    '状态',
    '更新时间',
  ])
    await table()
      .getByRole('columnheader', { name: heading, exact: true })
      .waitFor();
  checks.push({
    name: 'list-render',
    ...recordPage(initial),
    missingCategory: initial.list.every(
      (item) => !Object.hasOwn(item, 'category_id'),
    ),
  });
  await screenshot('list');
  checks.push({ name: 'page-2', ...(await jump(2)) });
  const sorting = [];
  for (const label of [
    '更新时间：由旧到新',
    '价格：由高到低',
    '价格：由低到高',
    '更新时间：由新到旧',
  ])
    sorting.push(await selectSort(label));
  assert.ok(
    sorting.every(
      (item, index) => index === 0 || item.ids[0] !== sorting[index - 1].ids[0],
    ),
  );
  checks.push({ name: 'four-sorts', sorting });

  const statusResponse = productResponse();
  await page.getByLabel('状态', { exact: true }).press('ArrowDown');
  await page
    .locator('.ant-select-dropdown:visible')
    .getByText('草稿', { exact: true })
    .click();
  await page.getByLabel('状态', { exact: true }).press('Escape');
  const statusResult = await statusResponse;
  const statusData = (await statusResult.json()).data;
  assert.ok(statusData.list.every(({ status }) => status === 'draft'));
  assert.equal(statusData.page, 1);
  await waitRows(statusData);
  checks.push({ name: 'status-draft', ...recordPage(statusData) });
  const beforeMultiple = requests.length;
  await page.getByLabel('状态', { exact: true }).press('ArrowDown');
  await page
    .locator('.ant-select-dropdown:visible')
    .getByText('上架', { exact: true })
    .click();
  await page.getByLabel('状态', { exact: true }).press('Escape');
  await page
    .getByText('当前接口仅支持单个状态，请保留一个状态或清空后查询。', {
      exact: true,
    })
    .waitFor();
  assert.equal(requests.length, beforeMultiple);
  checks.push({ name: 'unsupported-multiple-status-is-explicit', apiCalls: 0 });
  const resetResponse = productResponse();
  await page.getByRole('button', { name: /重\s*置/ }).click();
  await waitRows((await (await resetResponse).json()).data);

  const categoryResponse = productResponse();
  await page.getByLabel('类目', { exact: true }).click();
  await page
    .locator('.ant-cascader-dropdown:visible')
    .getByText('电子产品', { exact: true })
    .click();
  await page.getByLabel('类目', { exact: true }).press('Escape');
  const categoryResult = await categoryResponse;
  const categoryData = (await categoryResult.json()).data;
  assert.equal(
    new URL(categoryResult.url()).searchParams.get('category_id'),
    '1',
  );
  await waitRows(categoryData);
  await page
    .getByText('当前接口按所选类目精确筛选，尚不包含子类目商品。', {
      exact: true,
    })
    .waitFor();
  checks.push({
    name: 'parent-category-contract-gap',
    ...recordPage(categoryData),
  });
  await screenshot('parent-category');
  const resetAgain = productResponse();
  await page.getByRole('button', { name: /重\s*置/ }).click();
  await waitRows((await (await resetAgain).json()).data);

  const sizeResponse = productResponse();
  await table().locator('.ant-pagination-options-size-changer').click();
  await page
    .locator('.ant-select-dropdown:visible')
    .getByText(/^1\s*条\/页$/, { exact: true })
    .click();
  const sizeData = (await (await sizeResponse).json()).data;
  assert.equal(sizeData.page_size, 1);
  await waitRows(sizeData);
  const boundary = await jump(100);
  const deep = [];
  for (let current = 101; current <= 120; current++)
    deep.push(await jump(current));
  assert.ok(deep.every(({ query }) => query.cursor && !query.page));
  assert.deepEqual(
    [boundary.ids[0], ...deep.map(({ ids }) => ids[0])],
    Array.from({ length: 21 }, (_, index) => 21 - index),
  );
  checks.push({ name: 'offset-100-cursor-101-through-120', boundary, deep });
  await screenshot('cursor-page-101-plus');
  checks.push({ name: 'cursor-backward-cache', ...(await jump(101)) });
  if (phase === 'full') {
    const resetCursor = productResponse();
    await page.getByRole('button', { name: /重\s*置/ }).click();
    await waitRows((await (await resetCursor).json()).data);
    checks.push({ name: 'cursor-direct-jump-bridge', ...(await jump(105)) });
    await selectSort('更新时间：由旧到新');
    const beforeUnsupported = requests.length;
    const deepInput = table().locator(
      '.ant-pagination-options-quick-jumper input',
    );
    await deepInput.fill('101');
    await deepInput.press('Enter');
    await page
      .getByText('当前接口的深分页仅支持更新时间由新到旧，请切换排序后重试。', {
        exact: true,
      })
      .waitFor();
    assert.equal(requests.length, beforeUnsupported);
    checks.push({
      name: 'unsupported-cursor-sort-prevents-corrupt-results',
      apiCalls: 0,
    });
    await selectSort('更新时间：由新到旧');
    await jump(101);
  }

  const amounts = await page.evaluate(async () => {
    const { formatCents } = await import('/src/utils/money.ts');
    return [
      formatCents(12345),
      formatCents(0),
      formatCents('9223372036854775807'),
    ];
  });
  assert.deepEqual(amounts, ['123.45', '0.00', '92233720368547758.07']);
  checks.push({ name: 'browser-integer-cents', amounts });
  const concurrency = await page.evaluate(async () => {
    const { useProductList } =
      await import('/src/views/catalog/product/use-product-list.ts');
    const list = useProductList();
    const previous = list.load();
    list.statuses.value = ['draft'];
    await list.search();
    await previous;
    const result = {
      page: list.page.value,
      total: list.total.value,
      statuses: [...new Set(list.products.value.map((item) => item.status))],
      error: list.error.value,
      loading: list.loading.value,
    };
    list.dispose();
    return result;
  });
  assert.deepEqual(concurrency, {
    page: 1,
    total: 40,
    statuses: ['draft'],
    error: '',
    loading: false,
  });
  checks.push({
    name: 'live-filter-race-cancels-old-response',
    ...concurrency,
  });
  if (phase !== 'list') {
    const detailResponse = page.waitForResponse((response) =>
      /\/api\/v1\/admin\/products\/\d+$/.test(new URL(response.url()).pathname),
    );
    await rows().first().getByRole('link').click();
    const result = await detailResponse;
    const data = (await result.json()).data;
    await writeFile(
      new URL('rendered-detail-response.json', output),
      JSON.stringify(data, null, 2),
    );
    const skuTable = page.getByTestId('sku-table');
    const listingTable = page.getByTestId('listing-table');
    await skuTable.waitFor();
    assert.equal(
      await skuTable.locator('tbody tr.ant-table-row').count(),
      data.skus.length,
    );
    assert.equal(
      await listingTable.locator('tbody tr.ant-table-row').count(),
      data.listings.length,
    );
    await page
      .getByRole('heading', { name: data.product.title, exact: true })
      .waitFor();
    for (const sku of data.skus) {
      const row = skuTable.locator(`tbody tr[data-row-key="${sku.id}"]`);
      await row.getByText(sku.code, { exact: true }).waitFor();
      assert.equal(await row.locator('td').last().textContent(), '—');
    }
    if (data.listings.length === 0)
      await listingTable.getByText('—', { exact: true }).waitFor();
    checks.push({
      name: 'nested-detail',
      id: data.product.id,
      skuCount: data.skus.length,
      listingCount: data.listings.length,
      missingSKUStock: data.skus.every((sku) => !Object.hasOwn(sku, 'stock')),
      emptyListingsDash: data.listings.length === 0,
    });
    await screenshot('detail');
    await page.reload();
    await page
      .getByRole('heading', { name: data.product.title, exact: true })
      .waitFor();
    checks.push({ name: 'detail-direct-reload', id: data.product.id });
  }
  if (phase === 'full') {
    const emptyCreation = await page.evaluate(async () => {
      const { requestClient } = await import('/src/api/request.ts');
      try {
        const data = await requestClient.post(
          '/admin/products',
          {
            title: `FE-2 empty verification ${Date.now()}`,
            status: 'draft',
            skus: [],
          },
          { silent: true },
        );
        return {
          id: data.product.id,
          version: data.product.version,
          skuCount: data.skus.length,
          listingCount: data.listings.length,
        };
      } catch (error) {
        return {
          blocked: true,
          status: error.status,
          code: error.code,
          traceId: error.traceId,
        };
      }
    });
    if (emptyCreation.id) {
      temporaryProduct = emptyCreation;
      await page.goto(`${origin}/catalog/products/${emptyCreation.id}`);
      await page
        .getByTestId('sku-table')
        .getByText('—', { exact: true })
        .waitFor();
      await page
        .getByTestId('listing-table')
        .getByText('—', { exact: true })
        .waitFor();
      assert.equal(
        await page
          .getByTestId('sku-table')
          .locator('tbody tr.ant-table-row')
          .count(),
        0,
      );
      assert.equal(
        await page
          .getByTestId('listing-table')
          .locator('tbody tr.ant-table-row')
          .count(),
        0,
      );
      await screenshot('empty-detail');
      await page.evaluate(async ({ id, version }) => {
        const { requestClient } = await import('/src/api/request.ts');
        await requestClient.delete(`/admin/products/${id}`, {
          params: { version },
          silent: true,
        });
      }, temporaryProduct);
      temporaryProduct = undefined;
      checks.push({
        name: 'real-empty-product-detail',
        ...emptyCreation,
        cleanedUp: true,
      });
    } else
      checks.push({ name: 'empty-product-data-blocked', ...emptyCreation });

    const exportList = productResponse();
    await page.goto(`${origin}/catalog/products`);
    await waitRows((await (await exportList).json()).data);
    const exportResponse = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/v1/admin/products/export',
    );
    await page.getByRole('button', { name: '导出商品', exact: true }).click();
    const exported = await exportResponse;
    const exportData = await exported.json();
    const exportRequest = exported.request();
    const idempotency = exportRequest.headers()['idempotency-key'];
    assert.ok(idempotency);
    assert.deepEqual(exportRequest.postDataJSON(), {
      filters: {},
      sort: '-updated_at',
    });
    assert.equal(exported.status(), 201);
    assert.equal(exportData.code, 0);
    await page
      .getByText(
        new RegExp(`导出任务已创建，编号 ${exportData.data.export_id}`),
      )
      .waitFor();
    checks.push({
      name: 'real-export-trigger',
      request: exportRequest.postDataJSON(),
      idempotencyKeyPresent: Boolean(idempotency),
      response: exportData.data,
    });
    await screenshot('export');

    await page.evaluate(async () => {
      const { useAuthStore } = await import('/src/store/auth.ts');
      await useAuthStore().logout(false);
    });
    await page
      .getByPlaceholder('请输入用户名')
      .fill(process.env.FE2_SALES_USERNAME || 'sales01');
    await page
      .getByPlaceholder('密码', { exact: true })
      .fill(process.env.FE2_SALES_PASSWORD);
    await page.getByRole('button', { name: 'login', exact: true }).click();
    await page.getByText('暂无可用菜单', { exact: true }).waitFor();
    const salesPermissions = await page.evaluate(async () => {
      const { requestClient } = await import('/src/api/request.ts');
      return (await requestClient.get('/auth/menus')).permissions;
    });
    assert.equal(salesPermissions.length, 0);
    assert.equal(await page.locator('a[href="/catalog/products"]').count(), 0);
    const beforeDenied = requests.length;
    for (const path of ['/catalog/products', '/catalog/products/120']) {
      await page.goto(`${origin}${path}`);
      await page.waitForURL((url) => url.pathname === '/403');
      await page.getByText('哎呀！访问被拒绝', { exact: true }).waitFor();
      assert.equal(
        await page
          .getByRole('button', { name: '导出商品', exact: true })
          .count(),
        0,
      );
      checks.push({
        name: 'sales-direct-route-403',
        requestedPath: path,
        renderedPath: new URL(page.url()).pathname,
        permissionCount: salesPermissions.length,
      });
    }
    assert.equal(requests.length, beforeDenied);
    await screenshot('sales-403');
    checks.push({ name: 'sales-guard-before-api', adminAPICalls: 0 });
  }
  assert.deepEqual(errors, []);
} catch (error) {
  failure = { message: error.message, stack: error.stack, url: page.url() };
  console.error(failure);
  await screenshot(`failure-${phase}`).catch(() => {});
  process.exitCode = 1;
} finally {
  if (temporaryProduct) {
    await page
      .evaluate(async ({ id, version }) => {
        const { requestClient } = await import('/src/api/request.ts');
        await requestClient.delete(`/admin/products/${id}`, {
          params: { version },
          silent: true,
        });
      }, temporaryProduct)
      .catch((error) =>
        errors.push(`Temporary product cleanup failed: ${error.message}`),
      );
  }
  await writeFile(
    new URL(`browser-${phase}.json`, output),
    JSON.stringify(
      {
        source: 'real local backend, no response interception',
        phase,
        checks,
        requests,
        responses,
        errors,
        failure,
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify(
      {
        phase,
        checks: checks.map(({ name }) => name),
        apiResponses: responses.length,
        errors,
        failure,
      },
      null,
      2,
    ),
  );
  await browser.close();
}
