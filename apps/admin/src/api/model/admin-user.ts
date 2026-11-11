export type UserStatus = 'active' | 'disabled' | 'locked';

export interface AdminUser {
  avatar: null | string;
  created_at: string;
  dept_id: number;
  email: null | string;
  id: number;
  is_super: boolean;
  nickname: null | string;
  status: UserStatus;
  tenant_id: number;
  updated_at: string;
  username: string;
}

export interface UserListQuery {
  keyword?: string;
  page?: number;
  page_size?: number;
  status?: '' | UserStatus;
}

export interface UserInput {
  avatar: null | string;
  dept_id: number;
  email: null | string;
  nickname: null | string;
  status: UserStatus;
}

export interface CreateUserInput extends UserInput {
  password: string;
  username: string;
}
