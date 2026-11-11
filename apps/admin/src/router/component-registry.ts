import type { ComponentRecordType } from '@vben/types';

const placeholder = () => import('#/views/pending/index.vue');
export const NOT_FOUND_COMPONENT = '/_core/fallback/not-found.vue';

/** Explicitly match the backend seed catalogue; never import arbitrary paths. */
export const componentRegistry: ComponentRecordType = {
  [NOT_FOUND_COMPONENT]: () => import('#/views/_core/fallback/not-found.vue'),
  '/_core/fallback/no-menu.vue': () =>
    import('#/views/_core/fallback/no-menu.vue'),
  '/pending/index.vue': placeholder,
  '/_core/fallback/forbidden.vue': () =>
    import('#/views/_core/fallback/forbidden.vue'),
  '/catalog/product/index.vue': () =>
    import('#/views/catalog/product/index.vue'),
  '/catalog/product/detail.vue': () =>
    import('#/views/catalog/product/detail.vue'),
  '/system/user/index.vue': () => import('#/views/system/user/index.vue'),
  '/system/menu/index.vue': placeholder,
  '/system/role/index.vue': placeholder,
  '/trade/order/index.vue': placeholder,
  '/crm/customer/index.vue': placeholder,
  '/crm/inquiry/index.vue': placeholder,
};

export function resolveMenuComponent(component?: null | string) {
  const normalized = (component ?? '')
    .replace(/^(?:\.\.?\/)+/, '')
    .replace(/^\/?(?:src\/)?views\//, '')
    .replace(/^\//, '')
    .replace(/\.vue$/, '');
  const key = `/${normalized}.vue`;
  return Object.hasOwn(componentRegistry, key) ? key : NOT_FOUND_COMPONENT;
}
