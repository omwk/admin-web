import type { TreeOption } from '../shared/tree';

import type { Department } from '#/api/model/system';

interface DepartmentTreeNode extends Omit<Department, 'children'> {
  children?: DepartmentTreeNode[];
  key: number;
}

export function departmentTreeNodes(nodes: Department[]): DepartmentTreeNode[] {
  return nodes.map((node) => ({
    ...node,
    key: node.id,
    children: node.children?.length
      ? departmentTreeNodes(node.children)
      : undefined,
  }));
}

/** Use the full tree, independently of the visible search results. */
export function departmentParentOptions(
  nodes: Department[],
  editingId?: number,
  blockedAncestor = false,
): TreeOption[] {
  return nodes.map((node) => {
    const disabled = blockedAncestor || node.id === editingId;
    return {
      key: node.id,
      value: node.id,
      title: node.name,
      disabled,
      children: node.children?.length
        ? departmentParentOptions(node.children, editingId, disabled)
        : undefined,
    };
  });
}

export function filterDepartments(
  nodes: Department[],
  keyword: string,
): Department[] {
  const query = keyword.trim().toLocaleLowerCase();
  if (!query) return nodes;
  return nodes.flatMap((node) => {
    if (node.name.toLocaleLowerCase().includes(query)) return [node];
    const children = filterDepartments(node.children ?? [], query);
    return children.length > 0 ? [{ ...node, children }] : [];
  });
}

export function flattenDepartments(nodes: Department[]): Department[] {
  return nodes.flatMap((node) => [
    node,
    ...flattenDepartments(node.children ?? []),
  ]);
}
