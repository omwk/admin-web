import type { AdminUser, UserStatus } from '#/api/model/admin-user';

import { ref } from 'vue';

import { isCancel } from '@vben/request';

import { getUsersApi, normalizeUserQuery } from '#/api/core/admin-users';
import { toApiError } from '#/api/errors';

export function useUserList() {
  const keyword = ref('');
  const status = ref<undefined | UserStatus>();
  const page = ref(1);
  const pageSize = ref(20);
  const total = ref(0);
  const users = ref<AdminUser[]>([]);
  const loading = ref(false);
  const error = ref('');
  let appliedFilters: { keyword: string; status?: UserStatus } = {
    keyword: '',
  };
  let sequence = 0;

  async function load() {
    const request = ++sequence;
    loading.value = true;
    error.value = '';
    try {
      const data = await getUsersApi({
        ...appliedFilters,
        page: page.value,
        page_size: pageSize.value,
      });
      if (request !== sequence) return;
      users.value = data.list;
      total.value = data.total;
      page.value = data.page;
      pageSize.value = data.page_size;
    } catch (error_) {
      if (request !== sequence || isCancel(error_)) return;
      users.value = [];
      total.value = 0;
      error.value = toApiError(error_).message;
    } finally {
      if (request === sequence) loading.value = false;
    }
  }

  async function search() {
    appliedFilters = { keyword: keyword.value.trim(), status: status.value };
    page.value = 1;
    await load();
  }

  async function reset() {
    keyword.value = '';
    status.value = undefined;
    await search();
  }

  async function changePage(current: number, size: number) {
    const normalized = normalizeUserQuery({ page: current, page_size: size });
    page.value = normalized.page_size === pageSize.value ? normalized.page : 1;
    pageSize.value = normalized.page_size;
    await load();
  }

  // Invalidate late responses when the view is destroyed after logout/navigation.
  function dispose() {
    sequence++;
  }

  return {
    changePage,
    dispose,
    error,
    keyword,
    load,
    loading,
    page,
    pageSize,
    reset,
    search,
    status,
    total,
    users,
  };
}
