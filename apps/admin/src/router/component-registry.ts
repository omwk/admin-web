import type { ComponentRecordType } from '@vben/types';

const placeholder = () => import('#/views/pending/index.vue');
export const NOT_FOUND_COMPONENT = '_core/fallback/not-found';
export const FORBIDDEN_COMPONENT = '_core/fallback/forbidden';

/** Explicitly match the backend seed catalogue; never import arbitrary paths. */
export const componentRegistry: ComponentRecordType = {
  'home/index': () => import('#/views/home/index.vue'),
  '_core/profile/index': () => import('#/views/_core/profile/index.vue'),
  '_core/profile/notifications': () =>
    import('#/views/_core/profile/notifications.vue'),
  'system/notification/preferences-page': () =>
    import('#/views/system/notification/preferences-page.vue'),
  '_core/profile/sessions': () => import('#/views/_core/profile/sessions.vue'),
  [NOT_FOUND_COMPONENT]: () => import('#/views/_core/fallback/not-found.vue'),
  '_core/fallback/no-menu': () => import('#/views/_core/fallback/no-menu.vue'),
  'pending/index': placeholder,
  [FORBIDDEN_COMPONENT]: () => import('#/views/_core/fallback/forbidden.vue'),
  'catalog/product/index': () => import('#/views/catalog/product/index.vue'),
  'catalog/product/detail': () => import('#/views/catalog/product/detail.vue'),
  'system/user/index': () => import('#/views/system/user/index.vue'),
  'system/menu/index': () => import('#/views/system/menu/index.vue'),
  'system/role/index': () => import('#/views/system/role/index.vue'),
  'system/dept/index': () => import('#/views/system/dept/index.vue'),
  'system/tenant/index': () => import('#/views/system/tenant/index.vue'),
  'system/tenant/template-editor': () =>
    import('#/views/system/tenant/template-editor.vue'),
  'system/tenants/index': () => import('#/views/system/tenant/index.vue'),
  'system/dict/index': () => import('#/views/system/dict/index.vue'),
  'system/dicts/index': () => import('#/views/system/dict/index.vue'),
  'system/setting/index': () => import('#/views/system/setting/index.vue'),
  'system/storage/index': () => import('#/views/system/storage/index.vue'),
  'system/files/index': () => import('#/views/system/files/index.vue'),
  'system/settings/index': () => import('#/views/system/setting/index.vue'),
  'system/notification/index': () =>
    import('#/views/system/notification/index.vue'),
  'system/notification/channels': () =>
    import('#/views/system/notification/channels.vue'),
  'system/notification/broadcasts': () =>
    import('#/views/system/notification/broadcasts.vue'),
  'system/audit-log/index': () => import('#/views/system/audit-log/index.vue'),
  'system/login-log/index': () => import('#/views/system/login-log/index.vue'),
  'trade/order/index': placeholder,
  'crm/customer/index': placeholder,
  'crm/inquiry/index': placeholder,
};

export function resolveMenuComponent(component?: null | string) {
  const key = (component ?? '')
    .replace(/^\/+/, '')
    // TODO(FE-IDN-018): remove legacy views prefixes after 2027-02-28.
    .replace(/^(?:src\/)?views\//, '')
    .replace(/\.vue$/, '');
  if (Object.hasOwn(componentRegistry, key)) return key;
  console.warn('[router] Unknown menu component:', component);
  return FORBIDDEN_COMPONENT;
}
