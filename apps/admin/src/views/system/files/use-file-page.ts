import type { FileCategory, FileUsage, LibraryFile } from '#/api/model/storage';

import { computed, onMounted, onUnmounted, reactive, ref } from 'vue';

import { message, Modal } from 'ant-design-vue';

import {
  deleteFileApi,
  downloadFileApi,
  getFilesApi,
  getFileUrlApi,
  getFileUsageApi,
} from '#/api/core/files';
import { toApiError } from '#/api/errors';
import { hasPermission } from '#/auth/permission';

export function useFilePage() {
  const allowed = computed(() => hasPermission('system:file:manage'));
  const rows = ref<LibraryFile[]>([]);
  const loading = ref(false);
  const busy = ref(false);
  const error = ref('');
  const usage = ref<FileUsage>();
  const usageError = ref('');
  const usagePercent = computed(() =>
    usage.value && usage.value.quota_bytes > 0
      ? Math.min(100, (usage.value.used_bytes / usage.value.quota_bytes) * 100)
      : 0,
  );
  const previewFile = ref<LibraryFile>();
  const previewUrl = ref('');
  const previewLoading = ref(false);
  const previewError = ref('');
  const highlighted = ref<number>();
  const filters = reactive<{
    keyword: string;
    category?: FileCategory;
  }>({ keyword: '' });
  let applied: { category?: FileCategory; keyword?: string } = {};
  let sequence = 0;
  let usageSequence = 0;
  let previewSequence = 0;
  const pagination = reactive({
    current: 1,
    pageSize: 20,
    total: 0,
    showSizeChanger: true,
    pageSizeOptions: ['20', '50', '100'],
  });
  async function loadList() {
    if (!allowed.value) return;
    const current = ++sequence;
    loading.value = true;
    error.value = '';
    try {
      const data = await getFilesApi(pagination.current, pagination.pageSize, {
        ...applied,
      });
      if (current !== sequence) return;
      if (data.list.length === 0 && pagination.current > 1 && data.total > 0) {
        pagination.current = Math.max(
          1,
          Math.ceil(data.total / pagination.pageSize),
        );
        await loadList();
        return;
      }
      rows.value = data.list;
      pagination.total = data.total;
    } catch (error_) {
      if (current === sequence) error.value = toApiError(error_).message;
    } finally {
      if (current === sequence) loading.value = false;
    }
  }
  async function loadUsage() {
    if (!allowed.value) return;
    const current = ++usageSequence;
    usageError.value = '';
    try {
      const data = await getFileUsageApi();
      if (current === usageSequence) usage.value = data;
    } catch (error_) {
      if (current === usageSequence)
        usageError.value = toApiError(error_).message;
    }
  }
  async function load() {
    await Promise.all([loadList(), loadUsage()]);
  }
  onMounted(load);
  onUnmounted(() => {
    sequence++;
    usageSequence++;
    previewSequence++;
  });
  function query() {
    applied = {
      keyword: filters.keyword.trim() || undefined,
      category: filters.category,
    };
    pagination.current = 1;
    void loadList();
  }
  function reset() {
    filters.keyword = '';
    filters.category = undefined;
    query();
  }
  function changePage(page: { current?: number; pageSize?: number }) {
    pagination.current =
      page.pageSize === pagination.pageSize ? (page.current ?? 1) : 1;
    pagination.pageSize = page.pageSize ?? 20;
    void loadList();
  }
  function uploaded(file: LibraryFile) {
    highlighted.value = file.id;
    reset();
    void loadUsage();
  }
  function closePreview() {
    previewSequence++;
    previewFile.value = undefined;
    previewUrl.value = '';
    previewError.value = '';
    previewLoading.value = false;
  }
  async function preview(file: LibraryFile) {
    if (file.category !== 'image' || !allowed.value) return;
    closePreview();
    const current = ++previewSequence;
    previewFile.value = file;
    previewLoading.value = true;
    try {
      const data = await getFileUrlApi(file.id);
      if (current === previewSequence) previewUrl.value = data.url;
    } catch (error_) {
      if (current === previewSequence)
        previewError.value = toApiError(error_).message;
    } finally {
      if (current === previewSequence) previewLoading.value = false;
    }
  }
  async function download(file: LibraryFile) {
    if (busy.value) return;
    busy.value = true;
    error.value = '';
    try {
      const url = URL.createObjectURL(await downloadFileApi(file.id));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = file.original_name;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error_) {
      error.value = toApiError(error_).message;
    } finally {
      busy.value = false;
    }
  }
  async function copy(file: LibraryFile) {
    if (busy.value) return;
    busy.value = true;
    error.value = '';
    try {
      const signed = await getFileUrlApi(file.id);
      try {
        await navigator.clipboard.writeText(signed.url);
        message.success(
          `链接已复制，${signed.expires_in === 0 ? '长期有效' : '5 分钟内有效'}`,
        );
      } catch {
        error.value = '复制失败，请允许浏览器访问剪贴板后重试';
      }
    } catch (error_) {
      error.value = toApiError(error_).message;
    } finally {
      busy.value = false;
    }
  }
  function remove(file: LibraryFile) {
    if (busy.value || !allowed.value) return;
    Modal.confirm({
      title: '删除文件？',
      content: `确定删除「${file.original_name}」？此操作不可撤销。`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      async onOk() {
        if (busy.value || !allowed.value) return;
        busy.value = true;
        error.value = '';
        try {
          await deleteFileApi(file.id);
          message.success('文件已删除');
          await load();
        } catch (error_) {
          error.value = toApiError(error_).message;
        } finally {
          busy.value = false;
        }
      },
    });
  }
  return {
    allowed,
    rows,
    loading,
    busy,
    error,
    usage,
    usageError,
    usagePercent,
    previewFile,
    previewUrl,
    previewLoading,
    previewError,
    filters,
    highlighted,
    pagination,
    load,
    query,
    reset,
    changePage,
    uploaded,
    preview,
    closePreview,
    download,
    copy,
    remove,
  };
}
