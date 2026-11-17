import type { PermissionGroups } from '#/api/model/system';
import type { TenantTemplate, TenantTemplateUpdate } from '#/api/model/tenant';

import { dataScopeOptions } from '../role/role-options';

export function templateDraft(template: TenantTemplate): TenantTemplateUpdate {
  return {
    name: template.name,
    description: template.description,
    roles: template.roles.map((role) => ({
      ...role,
      remark: role.remark ?? null,
      permissions: [...role.permissions],
      menus: [...role.menus],
    })),
  };
}

export function templatePermissionCount(template: TenantTemplate) {
  return new Set(template.roles.flatMap((role) => role.permissions)).size;
}

const codePointLength = (value: string) => value.match(/./gsu)?.length ?? 0;

export function validateTemplateRole(
  code: string,
  name: string,
  codes: string[],
) {
  if (!/^[a-z][a-z0-9_]{0,63}$/.test(code)) {
    return '角色 Code 须以小写字母开头，仅含小写字母、数字或下划线，最多 64 字符';
  }
  if (codes.includes(code)) return `角色 Code「${code}」重复`;
  if (!name.trim() || codePointLength(name) > 128)
    return '角色名须为 1–128 字符';
  return '';
}

export function validateTemplateDraft(draft: TenantTemplateUpdate) {
  if (!draft.name.trim() || codePointLength(draft.name) > 128)
    return { message: '模板名称须为 1–128 字符' };
  if (codePointLength(draft.description) > 1000)
    return { message: '模板描述最多 1000 字符' };
  if (draft.roles.length > 50) return { message: '每个模板最多 50 个角色' };
  const codes: string[] = [];
  for (const [index, role] of draft.roles.entries()) {
    const message = validateTemplateRole(role.code, role.name, codes);
    if (message) return { message, index };
    if (!dataScopeOptions.some((option) => option.value === role.data_scope))
      return { message: '请选择有效的数据范围', index };
    codes.push(role.code);
  }
  return undefined;
}

export function templatePermissionIds(
  codes: string[],
  groups: PermissionGroups,
) {
  return Object.values(groups)
    .flat()
    .filter((permission) => codes.includes(permission.code))
    .map((permission) => permission.id);
}

export function templatePermissionCodes(
  previous: string[],
  ids: number[],
  groups: PermissionGroups,
) {
  const permissions = Object.values(groups).flat();
  const known = new Set(permissions.map((permission) => permission.code));
  return [
    ...new Set([
      ...previous.filter((code) => !known.has(code)),
      ...permissions
        .filter((permission) => ids.includes(permission.id))
        .map((permission) => permission.code),
    ]),
  ];
}

export interface TemplateMenuNode {
  key: string;
  title: string;
  children: TemplateMenuNode[];
}

export function templateMenuTree(menus: TenantTemplate['menus']) {
  const nodes = new Map(
    menus.map((menu) => [
      menu.key,
      {
        key: menu.key,
        title: menu.path ? `${menu.name}（${menu.path}）` : menu.name,
        children: [] as TemplateMenuNode[],
      },
    ]),
  );
  const roots: TemplateMenuNode[] = [];
  for (const menu of menus) {
    const node = nodes.get(menu.key);
    if (!node) continue;
    const parent = menu.parent_key ? nodes.get(menu.parent_key) : undefined;
    if (parent && parent !== node) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}
