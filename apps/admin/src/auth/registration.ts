import type { RegistrationInput } from '#/api/core/registration';

import { toApiError } from '#/api/errors';

import { passwordError } from './account-link';
import { LOGIN_CREDENTIAL_ERROR } from './login-tenant';

export const REGISTRATION_ACCEPTED_MESSAGE =
  '如果信息有效，我们已向你的邮箱发送验证邮件，请查收。';

export function registrationErrors(
  input: RegistrationInput & { confirmation: string },
): Record<string, string> {
  const errors: Record<string, string> = {};
  const size = (value: string) => value.match(/./gsu)?.length ?? 0;
  if (!input.tenant.trim() || size(input.tenant.trim()) > 64)
    errors.tenant = '请输入企业代码（不超过 64 个字符）';
  if (!input.account.trim() || size(input.account.trim()) > 256)
    errors.account = '请输入账号（不超过 256 个字符）';
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(input.email.trim()) ||
    size(input.email.trim()) > 256
  )
    errors.email = '请输入有效的邮箱地址（不超过 256 个字符）';
  const weak = passwordError(input.password);
  if (weak) errors.password = weak;
  if (!input.confirmation || input.password !== input.confirmation)
    errors.confirmation = '两次密码输入不一致';
  return errors;
}

export function registrationFailureMessage(failure: unknown) {
  const error = toApiError(failure);
  if (error.status === 403) return '该企业未开放自助注册';
  if (error.status === 429 || error.code === 10_005)
    return '注册过于频繁，请稍后再试';
  if (error.status === 401 || error.code === 20_101)
    return LOGIN_CREDENTIAL_ERROR;
  return error.message;
}
