import type { IdentityMenu } from './menu';

export type DataScope = 'all' | 'custom' | 'dept' | 'dept_and_child' | 'self';
export interface Department {
  children?: Department[];
  id: number;
  name: string;
  parent_id: number;
  status: 'active' | 'disabled';
}
export interface RoleInput {
  code: string;
  data_scope: DataScope;
  name: string;
  remark: null | string;
  status: 'active' | 'disabled';
}
export interface AdminRole extends RoleInput {
  id: number;
  tenant_id: number;
}
export interface Permission {
  code: string;
  id: number;
  module: string;
  name: string;
  type: 'api' | 'button' | 'data';
}
export type PermissionGroups = Record<string, Permission[]>;
export interface MenuInput {
  component: null | string;
  icon: null | string;
  is_external: boolean;
  keep_alive: boolean;
  meta: Record<string, unknown>;
  name: string;
  parent_id: number;
  path: null | string;
  permission_code: null | string;
  redirect: null | string;
  sort: number;
  status: 'active' | 'disabled';
  type: IdentityMenu['type'];
  visible: boolean;
}
export interface AdminMenu extends MenuInput {
  children?: AdminMenu[];
  id: number;
  tenant_id: number;
}
