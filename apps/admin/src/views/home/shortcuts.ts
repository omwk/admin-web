import type { MenuRecordRaw } from '@vben/types';

export function homeShortcuts(menus: MenuRecordRaw[]): MenuRecordRaw[] {
  const result: MenuRecordRaw[] = [];
  const seen = new Set(['/403', '/home', '/profile', '/profile/sessions']);
  function visit(items: MenuRecordRaw[]) {
    for (const item of items) {
      if (result.length >= 6) return;
      if (item.show === false || item.disabled) continue;
      if (item.children?.length) {
        visit(item.children);
      } else if (
        item.path.startsWith('/') &&
        !item.path.startsWith('//') &&
        !item.path.startsWith('/__external/') &&
        !seen.has(item.path)
      ) {
        seen.add(item.path);
        result.push(item);
      }
    }
  }
  visit(menus);
  return result;
}
