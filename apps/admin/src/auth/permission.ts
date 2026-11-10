import { useAccessStore } from '@vben/stores';

/** UI visibility only; every API request is independently authorized by backend. */
export function hasPermission(code: string): boolean {
  return useAccessStore().accessCodes.includes(code);
}
