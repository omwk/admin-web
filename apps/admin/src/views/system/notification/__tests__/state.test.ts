import type { NotificationPreferenceView } from '#/api/model/notification';

import { createApp } from 'vue';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { notificationSummary, payloadEntries } from '../options';
import { changedPreferences } from '../preference-state';
import { useNotificationPage } from '../use-notification-page';

let app: ReturnType<typeof createApp> | undefined;
afterEach(() => {
  app?.unmount();
  app = undefined;
});
describe('notification preferences', () => {
  const original: NotificationPreferenceView[] = [
    {
      template: 'notification.default',
      channel: 'email',
      enabled: true,
      inherited: true,
    },
    {
      template: 'notification.default',
      channel: 'sms',
      enabled: false,
      inherited: false,
    },
  ];
  it('does not turn tenant inheritance into personal overrides on an unchanged save', () => {
    expect(
      changedPreferences(
        original,
        original.map((value) => ({ ...value })),
      ),
    ).toEqual([]);
  });
  it('saves only the customized pair, preserving explicit false', () => {
    const draft = original.map((value) => ({ ...value }));
    const email = draft[0];
    if (!email) throw new Error('Missing email preference');
    draft[0] = { ...email, enabled: false, inherited: false };
    expect(changedPreferences(original, draft)).toEqual([
      { template: 'notification.default', channel: 'email', enabled: false },
    ]);
  });
  it('does not submit an existing override toggled back to its original value', () => {
    const sms = original[1];
    if (!sms) throw new Error('Missing SMS preference');
    expect(changedPreferences(original, [{ ...sms }])).toEqual([]);
  });
});
describe('notification payload text', () => {
  it('retains literal text for escaped Vue rendering and recursively removes credentials', () => {
    const secret = crypto.randomUUID();
    const payload = {
      message: '<img src=x onerror=alert(1)>',
      nested: { api_key: secret, count: 3 },
    };
    expect(notificationSummary(payload)).toBe(payload.message);
    expect(JSON.stringify(payloadEntries(payload))).not.toContain(secret);
    expect(payloadEntries(payload)[1]?.value).toContain('已配置');
  });
});
describe('notification pagination races', () => {
  it('ignores an obsolete page response and corrects an empty last page after mutation', async () => {
    let resolveFirst!: (value: {
      list: number[];
      total: number;
      page: number;
      page_size: number;
    }) => void;
    const fetch = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValueOnce({ list: [2], total: 21 })
      .mockResolvedValueOnce({ list: [], total: 1 })
      .mockResolvedValueOnce({ list: [3], total: 1 });
    let state!: ReturnType<typeof useNotificationPage<number>>;
    app = createApp({
      setup() {
        state = useNotificationPage(fetch);
        return () => null;
      },
    });
    app.mount(document.createElement('div'));
    const first = state.load();
    await state.changePage({ current: 2 });
    resolveFirst({ list: [1], total: 100, page: 1, page_size: 20 });
    await first;
    expect(state.rows.value).toEqual([2]);
    expect(state.pagination.value.current).toBe(2);
    await state.load();
    expect(state.pagination.value.current).toBe(1);
    expect(state.rows.value).toEqual([3]);
  });
});
