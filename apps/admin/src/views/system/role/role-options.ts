import type { DataScope } from '#/api/model/system';

export const dataScopeLabels: Record<DataScope, string> = {
  all: '全部',
  custom: '自定义',
  dept: '本部门',
  dept_and_child: '本部门及下级',
  self: '仅本人',
};
export const dataScopeOptions = Object.entries(dataScopeLabels).map(
  ([value, label]) => ({ label, value }),
);
