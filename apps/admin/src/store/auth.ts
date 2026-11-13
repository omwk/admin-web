import type { Recordable, UserInfo } from '@vben/types';

import { ref } from 'vue';

import { LOGIN_PATH } from '@vben/constants';
import { preferences } from '@vben/preferences';
import { CanceledError, isCancel } from '@vben/request';
import { resetAllStores, useAccessStore, useUserStore } from '@vben/stores';

import { notification } from 'ant-design-vue';
import { defineStore } from 'pinia';

import { getUserInfoApi, loginApi, logoutApi } from '#/api';
import { refreshAccessToken } from '#/auth/refresh';
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  getSessionVersion,
  setTokens,
} from '#/auth/token';
import { $t } from '#/locales';
import { resetRoutes, router } from '#/router';

export const useAuthStore = defineStore('auth', () => {
  const accessStore = useAccessStore();
  const userStore = useUserStore();
  const loginLoading = ref(false);
  let expiration: Promise<void> | undefined;

  function clearSession() {
    clearTokens();
    resetAllStores();
    resetRoutes();
    accessStore.$persist?.();
  }

  async function authLogin(
    params: Recordable<unknown>,
    onSuccess?: () => Promise<void> | void,
  ) {
    if (loginLoading.value) return { userInfo: null };
    clearSession();
    const version = getSessionVersion();
    loginLoading.value = true;
    let userInfo: null | UserInfo = null;
    try {
      const credentials = params as {
        password?: string;
        username?: string;
        tenant_id?: number;
      };
      const pair = await loginApi({
        password: credentials.password ?? '',
        username: credentials.username ?? '',
        ...(credentials.tenant_id === undefined
          ? {}
          : { tenant_id: credentials.tenant_id }),
      });
      if (version !== getSessionVersion())
        throw new CanceledError('登录状态已变更');
      setTokens(pair);
      userInfo = await fetchUserInfo();
      if (onSuccess) {
        await onSuccess();
      } else {
        const redirect = router.currentRoute.value.query.redirect;
        let target = preferences.app.defaultHomePath;
        if (typeof redirect === 'string') {
          try {
            const decoded = decodeURIComponent(redirect);
            if (
              decoded.startsWith('/') &&
              !decoded.startsWith('//') &&
              !decoded.startsWith('/auth')
            ) {
              target = decoded;
            }
          } catch {
            // Ignore malformed redirects and use the authorized home page.
          }
        }
        await router.replace(target);
      }
      notification.success({
        description: `${$t('authentication.loginSuccessDesc')}:${userInfo.realName}`,
        duration: 3,
        message: $t('authentication.loginSuccess'),
      });
    } catch (error) {
      if (!isCancel(error) && version === getSessionVersion()) clearSession();
      // Request interceptors already render a local, code-mapped error.
    } finally {
      loginLoading.value = false;
    }
    return { userInfo };
  }

  function expireSession(redirect = true) {
    if (expiration) return expiration;
    const current = router.currentRoute.value;
    clearSession();
    expiration = router
      .replace({
        path: LOGIN_PATH,
        query:
          redirect && current.path !== LOGIN_PATH
            ? { redirect: encodeURIComponent(current.fullPath) }
            : {},
      })
      .then(() => undefined)
      .finally(() => {
        expiration = undefined;
      });
    return expiration;
  }

  async function logout(redirect = true) {
    const accessToken = getAccessToken();
    const navigation = expireSession(redirect);
    if (accessToken) {
      try {
        await logoutApi(accessToken);
      } catch {
        // Local credentials have already been cleared; remote revocation may fail.
      }
    }
    await navigation;
  }

  async function restoreSession() {
    if (getAccessToken()) return true;
    if (!getRefreshToken()) return false;
    try {
      await refreshAccessToken();
      return true;
    } catch {
      return false;
    }
  }

  async function fetchUserInfo() {
    const userInfo = await getUserInfoApi();
    userStore.setUserInfo(userInfo);
    return userInfo;
  }

  function $reset() {
    loginLoading.value = false;
  }

  return {
    $reset,
    authLogin,
    expireSession,
    fetchUserInfo,
    loginLoading,
    logout,
    restoreSession,
  };
});
