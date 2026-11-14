export interface LoginParams {
  account: string;
  password: string;
  tenant: string;
}

export interface TokenPair {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  token_type: 'Bearer';
}

export interface IdentityUser {
  avatar?: string;
  email?: null | string;
  phone?: null | string;
  dept_name?: null | string;
  dept_id: number;
  id: number;
  is_super: boolean;
  nickname?: string;
  roles: { code: string; id: number; name: string }[];
  tenant_id: number;
  tenant_code?: string;
  username: string;
}

export interface Overview {
  permissions: string[];
  tenant_code?: string;
  user: IdentityUser;
}

export interface ProfileInput {
  nickname: string;
  email?: string;
  avatar: string;
}

export interface IdentitySession {
  sid: string;
  user_id: number;
  created_at: string;
  expires_at: string;
  ip?: string;
  user_agent?: string;
  current?: boolean;
}

export interface LoginData extends TokenPair {
  user: { id: number; nickname?: string; username: string };
}
