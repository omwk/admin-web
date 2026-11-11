export interface NamedNode {
  children?: NamedNode[];
  id: number;
  name: string;
  status?: string;
}
export interface TreeOption {
  children?: TreeOption[];
  disabled?: boolean;
  key: number;
  title: string;
  value: number;
}
export function treeOptions(
  nodes: NamedNode[],
  disableInactive = true,
): TreeOption[] {
  return nodes.map((node) => ({
    children: node.children?.length
      ? treeOptions(node.children, disableInactive)
      : undefined,
    disabled: disableInactive && node.status === 'disabled',
    key: node.id,
    title: node.name,
    value: node.id,
  }));
}
export function nodeLabel(nodes: NamedNode[], id: number): string {
  for (const node of nodes) {
    if (node.id === id) return node.name;
    const nested = nodeLabel(node.children ?? [], id);
    if (nested) return nested;
  }
  return '';
}
