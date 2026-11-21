import type { IdentityUser } from '#/api/model/identity';

import { createApp, nextTick, reactive } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '#/api/errors';
import { avatarUrl } from '#/utils/avatar';

import AvatarSetting from '../avatar-setting.vue';

const state = vi.hoisted(() => ({
  upload: vi.fn(),
  save: vi.fn(),
  saved: vi.fn(),
  busy: vi.fn(),
}));
vi.mock('#/api/core/self-service', () => ({
  uploadMyAvatarApi: state.upload,
  updateMyProfileApi: state.save,
}));
vi.mock('@vben/hooks', () => ({
  useAppConfig: () => ({ apiURL: 'https://api.example.test/api' }),
}));
vi.mock('ant-design-vue', async (original) => ({
  ...(await original<typeof import('ant-design-vue')>()),
  message: { success: vi.fn() },
}));
let app: ReturnType<typeof createApp>;
let root: HTMLDivElement;
let profile: IdentityUser;
beforeEach(async () => {
  vi.resetAllMocks();
  profile = reactive({
    id: 9,
    username: 'member',
    nickname: '已保存昵称',
    avatar: '/api/v1/avatars/9',
    roles: [],
    tenant_id: 1,
    dept_id: 1,
    is_super: false,
  });
  root = document.createElement('div');
  document.body.append(root);
  app = createApp(AvatarSetting, {
    profile,
    disabled: false,
    onSaved: (avatar: string) => {
      profile.avatar = avatar;
      state.saved(avatar);
    },
    onBusy: state.busy,
  });
  app.mount(root);
  await nextTick();
});
afterEach(() => {
  app.unmount();
  root.remove();
});
async function choose(file: File) {
  const input = root.querySelector('input');
  if (!input) throw new Error('Avatar picker is missing');
  Object.defineProperty(input, 'files', { configurable: true, value: [file] });
  input.dispatchEvent(new Event('change', { bubbles: true }));
  await nextTick();
}
describe('profile avatar upload', () => {
  it('uses the configured backend proxy even for legacy URLs and encodes the display cache key', () => {
    expect(
      avatarUrl(
        { ...profile, avatar: 'https://private-bucket.test/image.jpg' },
        'new image',
      ),
    ).toBe('https://api.example.test/api/v1/avatars/9?v=new%20image');
    expect(avatarUrl({ ...profile, avatar: '' })).toBe('');
  });
  it('refreshes the same canonical proxy immediately after replacing an avatar', async () => {
    state.upload.mockResolvedValue({
      avatar: '/api/v1/avatars/9',
      file_id: 88,
    });
    await choose(new File(['image'], 'new.png', { type: 'image/png' }));
    await vi.waitFor(() =>
      expect(state.saved).toHaveBeenCalledWith('/api/v1/avatars/9'),
    );
    expect(
      root.querySelector('.ant-avatar-circle img')?.getAttribute('src'),
    ).toBe('https://api.example.test/api/v1/avatars/9?v=88');
    expect(state.busy.mock.calls).toEqual([[true], [false]]);
  });
  it.each([
    [new File(['text'], 'fake.png', { type: 'text/plain' }), '头像仅支持'],
    [
      new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'large.png', {
        type: 'image/png',
      }),
      '2 MB',
    ],
  ])('rejects invalid input before upload', async (file, text) => {
    await choose(file);
    expect(root.textContent).toContain(text);
    expect(state.upload).not.toHaveBeenCalled();
  });
  it('accepts exactly 2 MiB and displays a backend decode rejection without changing the avatar', async () => {
    state.upload.mockRejectedValue(
      new ApiError({ status: 400, message: '头像无法解码' }),
    );
    await choose(
      new File([new Uint8Array(2 * 1024 * 1024)], 'invalid.png', {
        type: 'image/png',
      }),
    );
    await vi.waitFor(() => expect(root.textContent).toContain('头像无法解码'));
    expect(state.upload).toHaveBeenCalledTimes(1);
    expect(state.saved).not.toHaveBeenCalled();
  });
  it('deletes using saved profile values and restores the default preview', async () => {
    state.save.mockResolvedValue({ avatar: '' });
    const remove = [...root.querySelectorAll('button')].find(
      (button) => button.textContent?.replaceAll(' ', '') === '删除',
    );
    if (!remove) throw new Error('Avatar delete button is missing');
    remove.click();
    await vi.waitFor(() => expect(state.saved).toHaveBeenCalledWith(''));
    expect(state.save).toHaveBeenCalledWith({
      nickname: '已保存昵称',
      avatar: '',
    });
    expect(root.querySelector('.ant-avatar img')).toBeNull();
  });
});
