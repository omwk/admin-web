import type { SettingGroup } from '#/api/model/configuration';

import { describe, expect, it } from 'vitest';

import {
  settingChanges,
  settingDraft,
  validateSettings,
} from '../settings-schema';

const group: SettingGroup = {
  group: 'security',
  items: [
    {
      schema: {
        group: 'security',
        key: 'password_min_length',
        type: 'number',
        default: 8,
        min: 8,
        max: 64,
        read_only: false,
        desc: '密码最小字符数',
        hot_reload: true,
      },
      value: 8,
    },
    {
      schema: {
        group: 'security',
        key: 'policy',
        type: 'string',
        default: 'keep_raw',
        enum: ['reject', 'keep_raw'],
        read_only: false,
        desc: '策略',
        hot_reload: false,
      },
      value: 'keep_raw',
    },
    {
      schema: {
        group: 'security',
        key: 'locked',
        type: 'boolean',
        default: true,
        read_only: true,
        desc: '保护值',
        hot_reload: false,
      },
      value: true,
    },
  ],
};
describe('schema-driven settings', () => {
  it.each([3, 8.5, Number.NaN, Number.POSITIVE_INFINITY, null])(
    'rejects invalid numeric input %s before HTTP',
    (value) => {
      const draft = settingDraft(group);
      draft.password_min_length = value;
      expect(validateSettings(group, draft).password_min_length).toBeTruthy();
    },
  );
  it('accepts inclusive numeric bounds and rejects unregistered enum values', () => {
    const draft = settingDraft(group);
    draft.password_min_length = 64;
    expect(validateSettings(group, draft)).toEqual({});
    draft.password_min_length = 65;
    draft.policy = 'unknown';
    expect(Object.keys(validateSettings(group, draft))).toEqual([
      'password_min_length',
      'policy',
    ]);
  });
  it('sends only changed registered writable keys, preserving boolean and number types', () => {
    const draft = settingDraft(group);
    expect(settingChanges(group, draft)).toEqual({});
    draft.password_min_length = 12;
    draft.locked = false;
    draft.unregistered = 'must not be sent';
    expect(settingChanges(group, draft)).toEqual({ password_min_length: 12 });
  });
  it('validates Unicode lengths and IANA timezone instead of hardcoding per-field ranges', () => {
    const system: SettingGroup = {
      group: 'system',
      items: [
        {
          schema: {
            group: 'system',
            key: 'system_name',
            type: 'string',
            default: '',
            min: 1,
            max: 2,
            read_only: false,
            desc: '名称',
            hot_reload: false,
          },
          value: '系统',
        },
        {
          schema: {
            group: 'system',
            key: 'timezone',
            type: 'string',
            default: 'Asia/Shanghai',
            read_only: false,
            desc: '时区',
            hot_reload: false,
          },
          value: 'Asia/Shanghai',
        },
      ],
    };
    const draft = settingDraft(system);
    draft.system_name = '😀😀';
    expect(validateSettings(system, draft)).toEqual({});
    draft.system_name = '😀😀😀';
    draft.timezone = 'not/a/timezone';
    expect(Object.keys(validateSettings(system, draft))).toEqual([
      'system_name',
      'timezone',
    ]);
  });
});
