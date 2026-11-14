import type { PageResult } from '#/api/model/response';
import type { Tenant, TenantMember } from '#/api/model/tenant';

import { createApp, h, nextTick, ref } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '#/api/errors';
import { formatDateTime } from '#/utils/datetime';

import MemberDrawer from '../member-drawer.vue';

const state = vi.hoisted(() => ({ members: vi.fn(), dictionary: vi.fn() }));
vi.mock('#/api/core/tenants', () => ({ getTenantMembersApi: state.members }));
vi.mock('#/composables/use-meta-dictionary', () => ({
  useMetaDictionary: (type: string) => {
    state.dictionary(type);
    return {
      error: ref(''),
      label: (value: string) =>
        ({
          active: '启用（字典）',
          disabled: '禁用（字典）',
          locked: '锁定（字典）',
        })[value],
      color: () => 'red',
    };
  },
}));
const tenant: Tenant = {
  id: 8,
  code: 'acme',
  name: 'Acme',
  status: 'active',
  admin_active_count: 1,
  member_count: 21,
  provisioned_from: null,
  created_at: '',
  updated_at: '',
};
const firstMember: TenantMember = {
  id: 1,
  account: 'member-0',
  nickname: null,
  status: 'active',
  is_super: true,
  created_at: '2026-11-14T00:00:00Z',
};
const result: PageResult<TenantMember> = {
  page: 1,
  page_size: 20,
  total: 21,
  list: ['active', 'disabled', 'locked'].map((status, index) => ({
    id: index + 1,
    account: `member-${index}`,
    nickname: null,
    status: status as TenantMember['status'],
    is_super: index === 0,
    created_at: '2026-11-14T00:00:00Z',
  })),
};
let app: ReturnType<typeof createApp>;
let root: HTMLDivElement;
beforeEach(() => {
  state.dictionary.mockClear();
  state.members.mockReset().mockResolvedValue(result);
  root = document.createElement('div');
  document.body.append(root);
});
afterEach(() => {
  app?.unmount();
  root.remove();
});

describe('read-only tenant members', () => {
  it('renders exact fields with dictionary status, formatted dates and server pagination', async () => {
    app = createApp(MemberDrawer, { tenant });
    app.mount(root);
    await vi.waitFor(() =>
      expect(document.body.textContent).toContain('member-0'),
    );
    expect(state.members).toHaveBeenCalledExactlyOnceWith(8, 1);
    expect(state.dictionary).toHaveBeenCalledWith('user_status');
    for (const text of [
      '启用（字典）',
      '禁用（字典）',
      '锁定（字典）',
      '是',
      '否',
      formatDateTime(firstMember.created_at),
    ])
      expect(document.body.textContent).toContain(text);
    expect(
      document.querySelectorAll(
        '.ant-drawer input, .ant-drawer select, .ant-drawer textarea',
      ),
    ).toHaveLength(0);
    for (const label of ['编辑', '禁用成员', '重置密码', '删除'])
      expect(document.querySelector('.ant-drawer')?.textContent).not.toContain(
        label,
      );
    const nextPage = document.querySelector<HTMLLIElement>(
      '.ant-drawer .ant-pagination-item-2',
    );
    if (!nextPage) throw new Error('Missing server pagination');
    nextPage.click();
    await vi.waitFor(() =>
      expect(state.members).toHaveBeenLastCalledWith(8, 2),
    );
  });

  it('shows mapped not-found errors, allows retry, and ignores an older response after the target changes', async () => {
    state.members.mockRejectedValueOnce(
      new ApiError({
        status: 404,
        code: 10_003,
        message: '租户不存在',
        config: { preserveBusinessMessage: true } as never,
      }),
    );
    const target = ref(tenant);
    app = createApp({
      render: () => h(MemberDrawer, { tenant: target.value }),
    });
    app.mount(root);
    await vi.waitFor(() =>
      expect(document.body.textContent).toContain('请求的资源不存在'),
    );
    let finish!: (value: PageResult<TenantMember>) => void;
    state.members.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const retry = [
      ...document.querySelectorAll<HTMLButtonElement>('button'),
    ].find((item) => item.textContent?.replaceAll(/\s/g, '') === '重试');
    if (!retry) throw new Error('Missing retry action');
    retry.click();
    await vi.waitFor(() => expect(state.members).toHaveBeenCalledTimes(2));
    state.members.mockResolvedValueOnce({
      ...result,
      list: [{ ...firstMember, account: 'new-tenant-member' }],
    });
    target.value = { ...tenant, id: 9, name: 'New' };
    await vi.waitFor(() =>
      expect(document.body.textContent).toContain('new-tenant-member'),
    );
    finish(result);
    await nextTick();
    expect(document.body.textContent).not.toContain('member-0');
    expect(state.members).toHaveBeenLastCalledWith(9, 1);
  });
});
