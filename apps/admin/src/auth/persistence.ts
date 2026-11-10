import { useAccessStore, useUserStore } from '@vben/stores';

/**
 * Framework access/refresh fields remain null: only auth/token.ts owns tokens.
 * Purge legacy mock credentials and permission codes immediately after hydration,
 * before installing the router. Persist the cleared state for both dev and prod.
 */
export function initializeAuthState() {
  const accessStore = useAccessStore();
  accessStore.$reset();
  accessStore.$persist?.();
  useUserStore().$reset();
}
