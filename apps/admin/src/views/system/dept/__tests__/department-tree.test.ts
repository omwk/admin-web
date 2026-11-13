import type { Department } from '#/api/model/system';

import { describe, expect, it } from 'vitest';

import {
  departmentParentOptions,
  filterDepartments,
  flattenDepartments,
} from '../department-tree';

function department(
  id: number,
  name: string,
  children: Department[] = [],
): Department {
  return {
    id,
    name,
    parent_id: 0,
    path: String(id),
    sort: 0,
    status: 'active',
    member_count: 0,
    children,
  };
}
const tree = [
  department(1, '总部', [
    department(2, '电商', [
      department(3, '商品组', [department(5, '商品小组')]),
    ]),
    department(4, '客服'),
  ]),
];

describe('department hierarchy', () => {
  it('disables the edited node and every descendant, retaining other parents', () => {
    const options = departmentParentOptions(tree, 2);
    const children = options[0]?.children;
    expect(options[0]?.disabled).toBe(false);
    expect(children?.[0]?.disabled).toBe(true);
    expect(children?.[0]?.children?.[0]?.disabled).toBe(true);
    expect(children?.[0]?.children?.[0]?.children?.[0]?.disabled).toBe(true);
    expect(children?.[1]?.disabled).toBe(false);
    expect(
      departmentParentOptions(tree, 1)[0]?.children?.every(
        (node) => node.disabled,
      ),
    ).toBe(true);
    expect(
      departmentParentOptions(tree)[0]?.children?.every(
        (node) => !node.disabled,
      ),
    ).toBe(true);
  });

  it('keeps matching ancestry and excludes unrelated branches without changing source data', () => {
    const filtered = filterDepartments(tree, ' 商品小组 ');
    expect(flattenDepartments(filtered).map((node) => node.id)).toEqual([
      1, 2, 3, 5,
    ]);
    expect(flattenDepartments(tree).map((node) => node.id)).toEqual([
      1, 2, 3, 5, 4,
    ]);
    expect(filterDepartments(tree, '不存在')).toEqual([]);
    expect(filterDepartments(tree, '  ')).toEqual(tree);
    expect(filterDepartments([department(6, 'QA Team')], 'qa')).toHaveLength(1);
  });
});
