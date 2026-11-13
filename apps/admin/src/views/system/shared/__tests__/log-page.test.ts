import type { PageResult } from '#/api/model/response';

import { createApp } from 'vue';

import dayjs from 'dayjs';
import { describe, expect, it, vi } from 'vitest';

import { ApiError } from '#/api/errors';

import { auditQuery, loginQuery } from '../log-filters';
import { useLogPage } from '../use-log-page';

const result = { list: ['row'], page: 1, page_size: 20, total: 42 };
function setup(fetchPage = vi.fn().mockResolvedValue(result)) {
  let state!: ReturnType<typeof useLogPage<string>>;
  const app = createApp({
    setup() {
      state = useLogPage<string>(fetchPage);
      return () => null;
    },
  });
  app.mount(document.createElement('div'));
  return { state, fetchPage, app };
}

describe('read-only log query state', () => {
  it('uses RFC3339 bounds and exact server filter names', () => {
    const filters = {
      identity: 7,
      action: ' identity.login ',
      resourceType: ' user ',
      result: 'failure' as const,
      range: [
        dayjs('2026-11-13T10:00:00+08:00'),
        dayjs('2026-11-13T11:00:00+08:00'),
      ] as [dayjs.Dayjs, dayjs.Dayjs],
    };
    expect(auditQuery(filters)).toEqual({
      actor_id: 7,
      action: 'identity.login',
      resource_type: 'user',
      result: 'failure',
      from: '2026-11-13T02:00:00.000Z',
      to: '2026-11-13T03:00:00.000Z',
    });
    expect(loginQuery(filters)).toEqual({
      user_id: 7,
      result: 'failure',
      from: '2026-11-13T02:00:00.000Z',
      to: '2026-11-13T03:00:00.000Z',
    });
  });

  it('retains submitted filters across pages, resets on search/size changes, and clears filters', async () => {
    const { state, fetchPage, app } = setup();
    state.filters.action = 'identity.login';
    await state.search();
    state.filters.action = 'draft';
    await state.changePage({ current: 2, pageSize: 20 });
    expect(fetchPage).toHaveBeenLastCalledWith(
      { action: 'identity.login' },
      2,
      20,
    );
    await state.changePage({ current: 2, pageSize: 50 });
    expect(fetchPage).toHaveBeenLastCalledWith(
      { action: 'identity.login' },
      1,
      50,
    );
    await state.reset();
    expect(fetchPage).toHaveBeenLastCalledWith({}, 1, 50);
    expect(state.filters.action).toBeUndefined();
    app.unmount();
  });

  it('rejects reversed time ranges and ignores stale responses and unmounted requests', async () => {
    const { state, fetchPage, app } = setup();
    state.filters.range = [dayjs('2026-11-14'), dayjs('2026-11-13')];
    await state.search();
    expect(fetchPage).not.toHaveBeenCalled();
    expect(state.error.value).toContain('开始时间');
    state.filters.range = null;
    let finish!: (data: PageResult<string>) => void;
    fetchPage.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const old = state.search();
    await state.search();
    finish({ ...result, list: ['stale'] });
    await old;
    expect(state.rows.value).toEqual(['row']);
    fetchPage.mockRejectedValueOnce(
      new ApiError({ status: 403, code: 20_107 }),
    );
    await state.load();
    expect(state.error.value).toBe('没有权限执行此操作');
    expect(state.rows.value).toEqual([]);
    fetchPage.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const pending = state.load();
    app.unmount();
    finish(result);
    await pending;
    expect(state.rows.value).toEqual([]);
  });
});
