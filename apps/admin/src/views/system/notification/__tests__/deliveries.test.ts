import type { NotificationDelivery } from '#/api/model/notification';

import { createApp, nextTick } from 'vue';

import { message } from 'ant-design-vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Deliveries from '../deliveries.vue';
import {
  deliveryRetryReason,
  isStalledDelivery,
  useDeliveryPage,
} from '../use-delivery-page';

const api = vi.hoisted(() => ({
  deliveries: vi.fn(),
  templates: vi.fn(),
  retry: vi.fn(),
  batch: vi.fn(),
}));
vi.mock('#/api/core/notifications', () => ({
  getNotificationDeliveriesApi: api.deliveries,
  getNotificationTemplatesApi: api.templates,
  retryNotificationDeliveryApi: api.retry,
  retryNotificationDeliveriesApi: api.batch,
}));
let app: ReturnType<typeof createApp>;
let container: HTMLDivElement;
const instant = Date.parse('2026-11-18T02:00:00Z');
function delivery(
  overrides: Partial<NotificationDelivery> = {},
): NotificationDelivery {
  return {
    id: 1,
    tenant_id: 1,
    channel: 'email',
    template_code: 'identity.verify',
    template_name: '身份验证',
    recipient_masked: 'a***@example.invalid',
    recipient_hash: 'opaque-fingerprint',
    recipient_domain: 'example.invalid',
    provider_id: null,
    status: 'failed',
    attempts: 1,
    last_error: 'message_unavailable',
    last_error_message: '消息内容已过期或模板已删除',
    created_at: new Date(instant - 6 * 60_000).toISOString(),
    sent_at: null,
    next_retry_at: null,
    ...overrides,
  };
}
function mountState() {
  let state!: ReturnType<typeof useDeliveryPage>;
  app = createApp({
    setup() {
      state = useDeliveryPage();
      return () => null;
    },
  });
  app.mount(container);
  return state;
}
function element(selector: string) {
  const value = container.querySelector(selector);
  if (!value) throw new Error(`Missing delivery element: ${selector}`);
  return value;
}
async function ready(state: ReturnType<typeof useDeliveryPage>) {
  await vi.waitFor(() => expect(state.busy.value).toBe(false));
}
beforeEach(() => {
  vi.resetAllMocks();
  container = document.createElement('div');
  document.body.append(container);
  api.deliveries.mockResolvedValue({ list: [], total: 0 });
  api.templates.mockResolvedValue({ list: [], total: 0 });
});
afterEach(async () => {
  app?.unmount();
  message.destroy();
  await nextTick();
  container.remove();
  vi.useRealTimers();
});

describe('delivery retry eligibility', () => {
  it('matches the strict five-minute boundary, attempts and scheduled retry guard', () => {
    const pending = delivery({ status: 'pending', attempts: 0 });
    expect(isStalledDelivery(pending, instant)).toBe(true);
    expect(deliveryRetryReason(pending, instant)).toBe('');
    expect(deliveryRetryReason(delivery(), instant)).toBe('');
    expect(deliveryRetryReason(delivery({ status: 'skipped' }), instant)).toBe(
      '',
    );
    expect(
      deliveryRetryReason(delivery({ status: 'sent' }), instant),
    ).toContain('已发送');
    expect(isStalledDelivery({ ...pending, attempts: 1 }, instant)).toBe(false);
    expect(deliveryRetryReason({ ...pending, attempts: 1 }, instant)).toContain(
      '处理中',
    );
    expect(
      deliveryRetryReason(
        { ...pending, created_at: new Date(instant - 300_000).toISOString() },
        instant,
      ),
    ).toContain('不足 5 分钟');
    expect(
      deliveryRetryReason(
        { ...pending, next_retry_at: new Date(instant + 1000).toISOString() },
        instant,
      ),
    ).toContain('计划时间');
    expect(
      deliveryRetryReason(
        { ...pending, next_retry_at: new Date(instant).toISOString() },
        instant,
      ),
    ).toBe('');
    expect(
      isStalledDelivery({ ...pending, created_at: 'invalid' }, instant),
    ).toBe(false);
  });
});

describe('delivery page state', () => {
  it('applies filters on query, resets pagination and clears selections on page changes', async () => {
    api.deliveries.mockResolvedValue({ list: [delivery()], total: 50 });
    const state = mountState();
    await ready(state);
    state.filters.status = 'failed';
    state.filters.channel = 'email';
    state.filters.template_code = 'identity.verify';
    state.selectedIds.value = [1];
    await state.changePage({ current: 2, pageSize: 20 });
    expect(api.deliveries).toHaveBeenCalledWith(2, 20, {});
    expect(state.selectedIds.value).toEqual([]);
    await state.query();
    expect(state.pagination.value.current).toBe(1);
    expect(api.deliveries).toHaveBeenCalledWith(1, 20, {
      status: 'failed',
      channel: 'email',
      template_code: 'identity.verify',
    });
    await state.reset();
    expect(state.filters.status).toBeUndefined();
    expect(state.filters.channel).toBeUndefined();
    expect(state.filters.template_code).toBeUndefined();
  });

  it('refreshes a retried failed row and reports a rejected retry without a success toast', async () => {
    let record = delivery();
    api.deliveries.mockImplementation(async (_page, _size, filters) => ({
      list: filters.status === 'pending' ? [] : [record],
      total: filters.status === 'pending' ? 0 : 1,
    }));
    const success = vi.spyOn(message, 'success');
    const state = mountState();
    await ready(state);
    api.retry.mockImplementation(async () => {
      record = { ...record, status: 'pending' };
    });
    await state.retry(record);
    expect(api.retry).toHaveBeenCalledWith(1);
    expect(state.rows.value[0]?.status).toBe('pending');
    expect(success).toHaveBeenCalledOnce();
    success.mockClear();
    api.retry.mockRejectedValue(new Error('重试请求失败'));
    await state.retry(delivery());
    expect(state.error.value).toContain('重试请求失败');
    expect(success).not.toHaveBeenCalled();
    expect(state.busy.value).toBe(false);
  });

  it('submits mixed selections without hiding backend skip counts', async () => {
    const success = vi.spyOn(message, 'success');
    const state = mountState();
    await ready(state);
    state.rowSelection.value.onChange([1, 2, 3]);
    api.batch.mockResolvedValue({ retried: 2, skipped: 1 });
    await state.retryBatch('selected');
    expect(api.batch).toHaveBeenCalledWith([1, 2, 3]);
    expect(success).toHaveBeenCalledWith('成功 2 条，跳过 1 条');
    expect(state.selectedIds.value).toEqual([]);
  });

  it('finds stalls beyond the first page and chunks all requeues into at most 100 IDs', async () => {
    const records = Array.from({ length: 101 }, (_, index) =>
      delivery({ id: index + 1, status: 'pending', attempts: 0 }),
    );
    api.deliveries.mockImplementation(async (page, size, filters) => ({
      list:
        filters.status === 'pending'
          ? records.slice((page - 1) * size, page * size)
          : [],
      total: filters.status === 'pending' ? records.length : 0,
    }));
    api.batch.mockImplementation(async (ids: number[]) => ({
      retried: ids.length,
      skipped: 0,
    }));
    const state = mountState();
    await ready(state);
    expect(state.stalled.value).toHaveLength(101);
    expect(api.deliveries).toHaveBeenCalledWith(2, 100, { status: 'pending' });
    await state.retryBatch('stalled');
    expect(api.batch.mock.calls.map(([ids]) => ids.length)).toEqual([100, 1]);
    expect(api.batch.mock.calls[1]?.[0]).toEqual([101]);
  });

  it('retains partial batch counts and refreshes after a later chunk fails', async () => {
    const state = mountState();
    await ready(state);
    state.selectedIds.value = Array.from({ length: 101 }, (_, i) => i + 1);
    api.batch
      .mockResolvedValueOnce({ retried: 99, skipped: 1 })
      .mockRejectedValueOnce(new Error('服务暂不可用'));
    await state.retryBatch('selected');
    expect(state.error.value).toContain('成功 99 条，跳过 1 条，未完成 1 条');
    expect(state.error.value).toContain('服务暂不可用');
    expect(state.busy.value).toBe(false);
  });

  it('loads and deduplicates template options across pages using the Chinese subject', async () => {
    api.templates
      .mockResolvedValueOnce({
        list: [{ code: 'identity.verify', subject: 'Verify', locale: 'en-US' }],
        total: 101,
      })
      .mockResolvedValueOnce({
        list: [
          { code: 'identity.verify', subject: '身份验证', locale: 'zh-CN' },
          { code: 'order.created', subject: '订单创建', locale: 'zh-CN' },
        ],
        total: 101,
      });
    const state = mountState();
    await vi.waitFor(() => expect(state.templateOptions.value).toHaveLength(2));
    expect(api.templates).toHaveBeenCalledWith(2, 100);
    expect(state.templateOptions.value[0]?.label).toBe(
      'identity.verify - 身份验证',
    );
  });

  it('shows pending scan failures and never presents a stale global count', async () => {
    api.deliveries.mockImplementation(async (_page, _size, filters) => {
      if (filters.status === 'pending') throw new Error('读取失败');
      return { list: [delivery()], total: 1 };
    });
    const state = mountState();
    await ready(state);
    expect(state.rows.value).toHaveLength(1);
    expect(state.error.value).toContain('卡住投递检查失败');
    expect(state.stalled.value).toEqual([]);
  });

  it('updates the warning and row eligibility as a mounted pending record ages', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(instant);
    const record = delivery({
      status: 'pending',
      attempts: 0,
      created_at: new Date(instant - 299_000).toISOString(),
    });
    api.deliveries.mockResolvedValue({ list: [record], total: 1 });
    const state = mountState();
    await ready(state);
    expect(state.stalled.value).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(state.stalled.value).toHaveLength(1);
    expect(deliveryRetryReason(record, state.now.value)).toBe('');
  });
});

describe('delivery page presentation', () => {
  it('renders masked recipients, old null, Chinese metadata, four colors and disabled sent retry', async () => {
    const rows = [
      delivery(),
      delivery({
        id: 2,
        status: 'skipped',
        channel: 'sms',
        recipient_masked: '138****8000',
      }),
      delivery({ id: 3, status: 'sent', recipient_masked: null }),
      delivery({
        id: 4,
        status: 'pending',
        attempts: 0,
        created_at: new Date().toISOString(),
      }),
    ];
    api.deliveries.mockImplementation(async (_page, _size, filters) => ({
      list: filters.status === 'pending' ? [] : rows,
      total: filters.status === 'pending' ? 0 : rows.length,
    }));
    app = createApp(Deliveries);
    app.mount(container);
    await vi.waitFor(() =>
      expect(container.textContent).toContain('a***@example.invalid'),
    );
    expect(container.textContent).toContain('138****8000');
    expect(container.textContent).toContain('身份验证');
    expect(container.textContent).toContain('消息内容已过期或模板已删除');
    expect(container.textContent).not.toContain('opaque-fingerprint');
    const old = element('[data-delivery-id="3"]');
    expect(old.children[4]?.textContent).toBe('—');
    expect(old.querySelector('button')?.disabled).toBe(true);
    const recent = element('[data-delivery-id="4"]');
    expect(recent.querySelector('button')?.disabled).toBe(true);
    for (const [status, color] of [
      ['待发送', 'orange'],
      ['已发送', 'green'],
      ['失败', 'red'],
      ['已跳过', 'default'],
    ]) {
      expect(
        container.querySelector(`.ant-tag-${color}`)?.textContent?.trim(),
      ).toBe(status);
    }
    const name = element('[data-delivery-id="1"] td:nth-child(3) span');
    name.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    await vi.waitFor(() =>
      expect(document.body.textContent).toContain('identity.verify'),
    );
  });

  it('provides the two-line empty state and all three labeled filter controls', async () => {
    app = createApp(Deliveries);
    app.mount(container);
    await vi.waitFor(() =>
      expect(container.textContent).toContain('通知触发后会出现在这里'),
    );
    expect(container.textContent).toContain('暂无投递记录');
    for (const label of ['投递状态', '投递渠道', '投递模板'])
      expect(container.querySelector(`[aria-label="${label}"]`)).not.toBeNull();
  });
});
