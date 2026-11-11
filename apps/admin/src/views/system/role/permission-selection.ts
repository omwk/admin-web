import type { Permission, PermissionGroups } from '#/api/model/system';

interface MenuNode {
  children?: MenuNode[];
  id: number;
}

export function togglePermissionGroup(
  selected: number[],
  permissions: Permission[],
  checked: boolean,
) {
  const ids = new Set(permissions.map((permission) => permission.id));
  return checked
    ? [...new Set([...selected, ...ids])]
    : selected.filter((id) => !ids.has(id));
}
export function filteredPermissionGroups(
  groups: PermissionGroups,
  search: string,
) {
  const keyword = search.trim().toLowerCase();
  return Object.entries(groups)
    .map(([module, permissions]) => ({
      module,
      permissions,
      matches: permissions.filter((permission) =>
        `${permission.code} ${permission.name} ${module}`
          .toLowerCase()
          .includes(keyword),
      ),
    }))
    .filter((group) => group.matches.length > 0);
}
/** Persist ancestor IDs, but do not feed partially checked parents back as fully
 * checked keys: Ant's cascade would then silently select all sibling routes. */
export function menuLeafKeys(nodes: MenuNode[], assigned: number[]): number[] {
  const selected = new Set(assigned);
  return nodes.flatMap((node) => {
    if (node.children?.length) return menuLeafKeys(node.children, assigned);
    return selected.has(node.id) ? [node.id] : [];
  });
}

export function menuGrantIds(nodes: MenuNode[], checked: number[]) {
  const selected = new Set(checked);
  function visit(node: MenuNode): boolean {
    const descendants =
      node.children?.map((child) => visit(child)).some(Boolean) ?? false;
    if (descendants) selected.add(node.id);
    return selected.has(node.id);
  }
  nodes.forEach((node) => visit(node));
  return [...selected].toSorted((a, b) => a - b);
}
