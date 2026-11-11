export interface InviteInput {
  dept_id: number;
  expires_at: string;
  max_uses: number;
  role_ids: number[];
}
export interface Invite extends InviteInput {
  created_at: string;
  created_by: number;
  id: number;
  link?: string;
  status: 'active' | 'expired' | 'revoked' | 'used';
  used_count: number;
  username?: string;
}
export interface AcceptInviteInput {
  password: string;
  tenant_id: number;
  token: string;
  username: string;
}
