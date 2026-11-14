import type { ApiRequestConfig } from '#/api/client';

import { requestClient } from '#/api/request';

export interface RegistrationInput {
  account: string;
  email: string;
  password: string;
  tenant: string;
}
export interface RegistrationAccepted {
  accepted: true;
  dev_verify_url?: string;
}

const anonymous: ApiRequestConfig = {
  authenticated: false,
  silent: true,
  preserveBusinessMessage: true,
};

export const registerApi = (input: RegistrationInput) =>
  requestClient.post<RegistrationAccepted>('/auth/register', input, anonymous);

export const verifyRegistrationApi = (token: string) =>
  requestClient.post<undefined>('/auth/register/verify', { token }, anonymous);
