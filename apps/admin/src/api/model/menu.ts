import type { Overview } from './identity';

export interface IdentityMenu {
  children?: IdentityMenu[];
  component?: null | string;
  icon?: null | string;
  id: number;
  is_external: boolean;
  keep_alive: boolean;
  meta: Record<string, unknown>;
  name: string;
  parent_id: number;
  path?: null | string;
  permission_code?: null | string;
  redirect?: null | string;
  sort: number;
  status?: 'active' | 'disabled';
  type: 'button' | 'dir' | 'link' | 'menu';
  visible?: boolean;
}

export interface MenusData extends Overview {
  menus: IdentityMenu[];
}
