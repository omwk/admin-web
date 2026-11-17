import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { access, readFile, writeFile } from 'node:fs/promises';

import {
  agents,
  api,
  context,
  database,
  expect404,
  flatten,
  login,
  openDirectory,
  origin,
  output,
  persist,
  record,
  report,
  request,
  setup,
  shot,
  sidebar,
} from './fe-idn-009-support.mjs';

const prefix = 'feidn009_' + Date.now();
const password = 'Menu@' + randomBytes(16).toString('hex');
const before = await database('baseline');
const browser = await setup();
const adminContext = await context(browser);
const page = await adminContext.newPage();
let dictionary;
let restoreDictionary = false;
let failure;
function menuInput(menu) {
  return Object.fromEntries(
    [
      'parent_id',
      'name',
      'type',
      'path',
      'component',
      'redirect',
      'icon',
      'sort',
      'visible',
      'keep_alive',
      'is_external',
      'permission_code',
      'meta',
      'status',
    ].map((key) => [key, menu[key]]),
  );
}
try {
  for (const file of [
    'catalog.ts',
    'configuration-menus.ts',
    'tenant-menus.ts',
  ]) {
    await assert.rejects(
      access(new URL('../src/router/' + file, import.meta.url)),
      { code: 'ENOENT' },
    );
  }
  const source = await readFile(
    new URL('../src/router/access.ts', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(
    source,
    /catalogRoutes|configurationRoutes|tenantFallbackRoutes|auditFallbackRoutes|extraRoutes/,
  );
  await record(1, '三个合成路由文件已删除，access.ts 无组装或导入', {
    source: 'filesystem',
  });
  await login(page);
  const navigation = await api('/auth/menus');
  report.backendMenus = navigation.menus;
  const nodes = flatten(navigation.menus);
  assert.deepEqual(
    navigation.menus.map((menu) => menu.name),
    ['系统', '交易', '商品', '客户'],
  );
  const system = navigation.menus.find((menu) => menu.path === '/system');
  const catalog = navigation.menus.find((menu) => menu.path === '/catalog');
  for (const path of ['/system/dicts', '/system/settings', '/system/tenants'])
    assert.ok(system.children.some((menu) => menu.path === path));
  assert.ok(catalog.children.some((menu) => menu.path === '/catalog/products'));
  await page.goto(origin + '/catalog/products');
  await page.getByTestId('product-table').waitFor();
  await sidebar(page).getByText('商品管理', { exact: true }).waitFor();
  await shot('02-catalog-sidebar-real', page);
  await openDirectory(page, '系统');
  for (const name of ['数据字典', '系统配置'])
    await sidebar(page).getByText(name, { exact: true }).waitFor();
  await shot('03-system-sidebar-real', page);
  await record(
    2,
    '真实后端驱动商品目录下商品管理、系统目录下数据字典与系统配置',
    {
      screenshots: [
        '02-catalog-sidebar-real.png',
        '03-system-sidebar-real.png',
      ],
    },
  );
  await record(3, '目录顺序系统/交易/商品/客户；子页面归属正确', {
    roots: navigation.menus.map(({ name, path, sort }) => ({
      name,
      path,
      sort,
    })),
    screenshots: ['02-catalog-sidebar-real.png', '03-system-sidebar-real.png'],
  });
  const hiddenPaths = [
    '/catalog/products/:id',
    '/system/tenants/templates',
    '/system/tenants/templates/:id',
  ];
  for (const path of hiddenPaths)
    assert.equal(
      nodes.find((menu) => menu.path === path)?.visible,
      false,
      path,
    );
  for (const name of ['商品详情', '租户模板', '模板编辑'])
    assert.equal(
      await sidebar(page).getByText(name, { exact: true }).count(),
      0,
    );
  await record(
    4,
    '三个隐藏行来自真实 /auth/menus，visible=false，侧边栏无入口',
    { paths: hiddenPaths, screenshot: '03-system-sidebar-real.png' },
  );
  const registry = await readFile(
    new URL('../src/router/component-registry.ts', import.meta.url),
    'utf8',
  );
  report.components = [];
  for (const node of nodes) {
    if (!node.component) continue;
    const key =
      '/' +
      node.component
        .replace(/^\/?(?:src\/)?views\//, '')
        .replace(/^\//, '')
        .replace(/\.vue$/, '') +
      '.vue';
    assert.ok(registry.includes("'" + key + "':"), key);
    report.components.push({
      menuId: node.id,
      path: node.path,
      component: node.component,
      resolved: key,
    });
  }
  await record(
    8,
    '真实投影的每个 component 均可在显式注册表解析；允许未引用注册项',
    { count: report.components.length, source: 'real-backend-and-registry' },
  );
  const products = await api('/admin/products?page_size=20');
  let product = products.list?.[0];
  if (!product) {
    const created = await api('/admin/products', 'POST', {
      title: 'FE-IDN-009 ' + prefix,
      status: 'draft',
      skus: [],
    });
    product = created.product;
    report.resources.products.push({
      id: product.id,
      title: product.title,
      version: product.version,
    });
    await persist();
  }
  const productURL = '/catalog/products/' + product.id;
  await page.goto(origin + productURL);
  await page.getByTestId('sku-table').waitFor();
  await page.reload();
  await page.getByTestId('sku-table').waitFor();
  await shot('05-product-direct-refresh-real', page);
  let templates = (await api('/admin/tenant-templates?page_size=100')).list;
  if (!templates.length) {
    const created = await api('/admin/tenant-templates', 'POST', {
      code: prefix,
      name: 'FE-IDN-009 模板验收',
      description: '',
    });
    templates = [created];
    report.resources.templates.push({ id: created.id, code: prefix });
    await persist();
  }
  const editorURL = '/system/tenants/templates/' + templates[0].id;
  await page.goto(origin + editorURL);
  await page.getByTestId('template-editor').waitFor();
  await page.reload();
  await page.getByTestId('template-editor').waitFor();
  await shot('05-template-direct-refresh-real', page);
  await record(
    5,
    '粘贴真实商品详情和模板编辑 URL，整页刷新仍正常加载；未替换业务响应',
    {
      productURL,
      editorURL,
      screenshots: [
        '05-product-direct-refresh-real.png',
        '05-template-direct-refresh-real.png',
      ],
    },
  );
  dictionary = flatten(await api('/admin/menus')).find(
    (menu) => menu.path === '/system/dicts',
  );
  assert.ok(dictionary);
  restoreDictionary = true;
  await api('/admin/menus/' + dictionary.id, 'PUT', {
    ...menuInput(dictionary),
    status: 'disabled',
  });
  assert.equal(
    flatten((await api('/auth/menus')).menus).some(
      (menu) => menu.path === '/system/dicts',
    ),
    false,
  );
  await page.goto(origin + '/system/dicts');
  await expect404(page);
  await page.reload();
  await expect404(page);
  await shot('06-dictionary-removed-404-real', page);
  await record(
    6,
    '通过真实菜单 API 临时停用数据字典，后端投影无此行；保留权限的管理员直访/刷新均 404',
    {
      menuId: dictionary.id,
      mutation: 'PUT status=disabled (remove from active menu projection)',
      path: '/system/dicts',
      screenshot: '06-dictionary-removed-404-real.png',
    },
  );
  await api('/admin/menus/' + dictionary.id, 'PUT', menuInput(dictionary));
  restoreDictionary = false;
  await page.goto(origin + '/system/dicts');
  await page.getByTestId('dictionary-groups').waitFor();
  const role = await api('/admin/roles', 'POST', {
    code: prefix,
    name: 'FE-IDN-009 受限角色',
    data_scope: 'all',
    status: 'active',
    remark: null,
  });
  report.resources.roles.push({ id: role.id, code: prefix });
  await persist();
  const permissions = Object.values(await api('/admin/permissions')).flat();
  const granted = permissions.filter((permission) =>
    ['system:tenant:list', 'system:tenant:manage', 'system:user:list'].includes(
      permission.code,
    ),
  );
  await api('/admin/roles/' + role.id + '/permissions', 'PUT', {
    permission_ids: granted.map((permission) => permission.id),
  });
  await api('/admin/roles/' + role.id + '/menus', 'PUT', {
    menu_ids: nodes.map((node) => node.id),
  });
  const departments = await api('/admin/depts');
  const user = await api('/admin/users', 'POST', {
    username: prefix,
    nickname: 'FE-IDN-009 受限验收',
    password: password + '0',
    dept_id: departments[0].id,
    status: 'active',
  });
  report.resources.users.push({ id: user.id, username: prefix });
  await persist();
  await api('/admin/users/' + user.id + '/roles', 'PUT', {
    role_ids: [role.id],
  });
  const initial = await api(
    '/auth/login',
    'POST',
    { tenant_code: 'default', username: prefix, password: password + '0' },
    null,
  );
  await api(
    '/auth/password',
    'PUT',
    { oldPassword: password + '0', newPassword: password },
    initial.access_token,
  );
  const restricted = await context(browser);
  const limited = await restricted.newPage();
  const limitedAuth = await login(limited, prefix, password);
  const limitedMenus = await api(
    '/auth/menus',
    'GET',
    undefined,
    limitedAuth.access_token,
  );
  assert.equal(limitedMenus.permissions.includes('product:spu:list'), false);
  assert.equal(limitedMenus.permissions.includes('system:tenant:list'), true);
  assert.equal(limitedMenus.user.is_super, false);
  assert.equal(
    await sidebar(limited).getByText('商品管理', { exact: true }).count(),
    0,
  );
  assert.equal(
    await sidebar(limited).getByText('租户管理', { exact: true }).count(),
    0,
  );
  await limited.goto(origin + '/catalog/products');
  await expect404(limited);
  await shot('07-no-product-permission-real', limited);
  await record(
    7,
    '真实受限账号无 product:spu:list，虽保留菜单授权也无商品入口；直访 404',
    {
      userId: user.id,
      roleId: role.id,
      screenshot: '07-no-product-permission-real.png',
      source: 'real-account-and-backend',
    },
  );
  await limited.goto(origin + '/system/tenants');
  await expect404(limited);
  await shot('09-non-platform-tenant-real', limited);
  await page.goto(origin + '/system/tenants');
  await page.getByTestId('tenant-table').waitFor();
  await page.goto(origin + '/system/tenants/templates');
  await page.getByText('租户模板', { exact: true }).first().waitFor();
  await shot('09-platform-template-menu-real', page);
  await record(
    9,
    '平台管理员的租户/模板页均来自后端；非平台管理员即使有 tenant 权限仍无入口，前端直访 404',
    {
      restrictedUser: {
        isSuper: limitedMenus.user.is_super,
        tenantId: limitedMenus.user.tenant_id,
      },
      screenshots: [
        '09-non-platform-tenant-real.png',
        '09-platform-template-menu-real.png',
      ],
    },
  );
  assert.deepEqual(report.browserErrors, []);
} catch (error) {
  failure = error;
  report.failure = { message: error.message, stack: error.stack };
  await shot('failure', page).catch(() => {});
} finally {
  await browser.close();
  try {
    if (restoreDictionary)
      await api('/admin/menus/' + dictionary.id, 'PUT', menuInput(dictionary));
    report.cleanupAPI = [];
    for (const user of report.resources.users) {
      await api('/admin/users/' + user.id + '/roles', 'PUT', { role_ids: [] });
      report.cleanupAPI.push({
        path: '/admin/users/' + user.id,
        status: (await request('/admin/users/' + user.id, 'DELETE')).status,
      });
    }
    for (const role of report.resources.roles) {
      await api('/admin/roles/' + role.id + '/menus', 'PUT', { menu_ids: [] });
      await api('/admin/roles/' + role.id + '/permissions', 'PUT', {
        permission_ids: [],
      });
      await api('/admin/roles/' + role.id, 'DELETE');
      report.cleanupAPI.push({ path: '/admin/roles/' + role.id, status: 204 });
    }
    for (const template of report.resources.templates)
      await api('/admin/tenant-templates/' + template.id, 'DELETE');
    for (const product of report.resources.products)
      await api(
        '/admin/products/' + product.id + '?version=' + product.version,
        'DELETE',
      );
    await request('/auth/logout', 'POST');
    report.cleanup = await database('cleanup', {
      agents,
      startedAt: report.startedAt,
      resources: report.resources,
      before,
    });
    await writeFile(
      new URL('cleanup.json', output),
      JSON.stringify(report.cleanup, null, 2) + '\n',
    );
  } catch (cleanupError) {
    report.cleanupError = cleanupError.message;
    failure ||= cleanupError;
  }
  report.finishedAt = new Date().toISOString();
  report.passed = !failure;
  await persist();
}
if (failure) throw failure;
