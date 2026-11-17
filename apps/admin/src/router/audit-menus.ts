import type { IdentityMenu } from '#/api/model/menu';

const paths = new Set(['/system/audit-logs', '/system/login-logs']);

/** A retained menu grant must not expose pages without the audit permission. */
export function auditMenus(
  menus: IdentityMenu[],
  codes: string[],
  parent = '',
): IdentityMenu[] {
  return menus.flatMap((menu) => {
    const path = menu.path?.startsWith('/')
      ? menu.path
      : `${parent}/${menu.path ?? ''}`;
    if (
      paths.has(path.replace(/\/$/, '')) &&
      !codes.includes('system:audit:list')
    )
      return [];
    return [
      { ...menu, children: auditMenus(menu.children ?? [], codes, path) },
    ];
  });
}
