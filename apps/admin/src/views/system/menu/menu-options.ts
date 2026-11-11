import type { TreeOption } from '../shared/tree';

import type { AdminMenu } from '#/api/model/system';

interface MenuNode {
  children?: MenuNode[];
  id: number;
  name: string;
  type: AdminMenu['type'];
}

export const menuTypes = [
  { label: '目录', value: 'dir' },
  { label: '菜单', value: 'menu' },
  { label: '按钮', value: 'button' },
  { label: '外链', value: 'link' },
];
export const menuTypeLabels: Record<AdminMenu['type'], string> = {
  button: '按钮',
  dir: '目录',
  link: '外链',
  menu: '菜单',
};

/** Removing the edited subtree also excludes every descendant as a parent. */
export function menuParentOptions(
  nodes: MenuNode[],
  editingId?: number,
): TreeOption[] {
  return nodes
    .filter((node) => node.id !== editingId)
    .map((node) => ({
      key: node.id,
      value: node.id,
      title: node.name,
      disabled: node.type === 'button' || node.type === 'link',
      children: node.children?.length
        ? menuParentOptions(node.children, editingId)
        : undefined,
    }));
}

export function menuBranchIds(nodes: AdminMenu[]): number[] {
  return nodes.flatMap((node) =>
    node.children?.length ? [node.id, ...menuBranchIds(node.children)] : [],
  );
}
