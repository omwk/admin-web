import type { UserStatus } from './admin-user';

export interface Tenant {
  id: number;
  code: string;
  name: string;
  status: 'active' | 'suspended';
  admin_active_count: number;
  member_count: number;
  provisioned_from: null | number;
  created_at: string;
  updated_at: string;
}

export interface TenantMember {
  id: number;
  account: string;
  nickname: null | string;
  status: UserStatus;
  is_super: boolean;
  created_at: string;
}

export interface TenantAdminInviteResult {
  invite_url: string;
  expires_at: string;
}

export interface TenantProvision {
  code: string;
  name: string;
  template_id: number;
  admin_username: string;
  admin_email?: string;
}

export interface TenantProvisionResult {
  tenant_id: number;
  invite_url: string;
}

export interface TenantTemplate {
  id: number;
  code: string;
  name: string;
  description: string;
  roles: {
    code: string;
    name: string;
    data_scope: string;
    status: string;
    menus: string[];
    permissions: string[];
  }[];
  menus: {
    key: string;
    name: string;
    path: null | string;
    type: string;
    permission_code: null | string;
  }[];
  permissions: { code: string; name: string; module: string }[];
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface TenantTemplateInput {
  source_tenant_id: number;
  code: string;
  name: string;
  description: string;
}
