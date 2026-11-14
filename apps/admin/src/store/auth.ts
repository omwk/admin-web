import type { Recordable, UserInfo } from '@vben/types';

import { ref } from 'vue';

import { LOGIN_PATH } from '@vben/constants';
import { preferences } from '@vben/preferences';
import { CanceledError, isCancel } from '@vben/request';
import { resetAllStores, useAccessStore, useUserStore } from '@vben/stores';

import { message, notification } from 'ant-design-vue';
import { defineStore } from 'pinia';

import { getUserInfoApi, loginApi, logoutApi } from '#/api';
import { logoutAllApi } from '#/api/core/self-service';
import {
  getLastTenantCode,
  loginFailureMessage,
  rememberTenantCode,
} from '#/auth/login-tenant';
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

  function clearSessionAndRedirect() {
    try {
      clearSession();
    } finally {
      try {
        sessionStorage.clear();
      } catch {
        // In-memory credentials have already been discarded.
      }
      window.location.replace(router.resolve(LOGIN_PATH).href);
    }
  }

  async function logoutAll() {
    await logoutAllApi();
    clearSessionAndRedirect();
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
    let hasSession = false;
    try {
      const credentials = params as {
        account?: string;
        password?: string;
        tenant?: string;
      };
      const tenant = credentials.tenant?.trim() || getLastTenantCode();
      rememberTenantCode(tenant);
      const pair = await loginApi({
        account: credentials.account?.trim() ?? '',
        password: credentials.password ?? '',
        tenant,
      });
      if (version !== getSessionVersion())
        throw new CanceledError('登录状态已变更');
      setTokens(pair);
      hasSession = true;
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
      if (!isCancel(error) && version === getSessionVersion()) {
        clearSession();
        if (!hasSession) message.error(loginFailureMessage(error));
      }
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

  async function logout(_redirect = true) {
    const accessToken = getAccessToken();
    try {
      clearSession();
      if (accessToken) {
        await logoutApi(accessToken);
      }
    } catch {
      // A remote or local cleanup failure must still leave the authenticated page.
    } finally {
      clearSessionAndRedirect();
    }
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
    clearSessionAndRedirect,
    expireSession,
    fetchUserInfo,
    loginLoading,
    logout,
    logoutAll,
    restoreSession,
  };
});
