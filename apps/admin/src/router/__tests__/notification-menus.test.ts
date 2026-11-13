import type { IdentityMenu } from '#/api/model/menu';

import { describe, expect, it } from 'vitest';

import { resolveMenuComponent } from '../component-registry';
import { notificationMenus } from '../notification-menus';

const menu = (id: number, path: string): IdentityMenu => ({
  id,
  name: path,
  path,
  parent_id: 0,
  sort: id,
  type: 'menu',
  is_external: false,
  keep_alive: false,
  meta: {},
});
describe('notification menu permissions', () => {
  const inbox = menu(1, '/system/notifications');
  const channels = menu(2, '/system/notifications/channels');
  it('hides channel menus even when the backend returned a retained menu grant', () => {
    expect(
      notificationMenus([inbox, channels], ['system:notify:list']),
    ).toEqual([{ ...inbox, children: [] }]);
    expect(notificationMenus([inbox, channels], [])).toEqual([]);
    expect(
      notificationMenus(
        [inbox, channels],
        ['system:notify:list', 'system:notify:manage'],
      ),
    ).toHaveLength(2);
  });
  it('filters relative child paths without affecting unrelated menus', () => {
    const parent = {
      ...menu(3, '/system'),
      type: 'dir' as const,
      children: [
        { ...channels, path: 'notifications/channels' },
        menu(4, '/system/users'),
      ],
    };
    expect(
      notificationMenus([parent], ['system:user:list'])[0]?.children?.map(
        (value) => value.id,
      ),
    ).toEqual([4]);
  });
  it('resolves both exact backend projected components', () => {
    expect(resolveMenuComponent('system/notification/index')).toBe(
      '/system/notification/index.vue',
    );
    expect(resolveMenuComponent('system/notification/channels')).toBe(
      '/system/notification/channels.vue',
    );
  });
});
