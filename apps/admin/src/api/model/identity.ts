export interface LoginParams {
  password: string;
  username: string;
}

export interface TokenPair {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  token_type: 'Bearer';
}

export interface IdentityUser {
  avatar?: string;
  dept_id: number;
  id: number;
  is_super: boolean;
  nickname?: string;
  roles: { code: string; id: number; name: string }[];
  tenant_id: number;
  username: string;
}

export interface Overview {
  permissions: string[];
  user: IdentityUser;
}

export interface LoginData extends TokenPair {
  user: { id: number; nickname?: string; username: string };
}
