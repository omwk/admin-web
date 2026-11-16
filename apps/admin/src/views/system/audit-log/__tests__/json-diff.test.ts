import { createApp, h } from 'vue';

import { describe, expect, it } from 'vitest';

import { auditDiff, diffTrees } from '../json-diff';
import JsonDiff from '../json-diff.vue';

describe('audit JSON difference trees', () => {
  it('marks nested changes, additions and removals while preserving backend masks', () => {
    const trees = diffTrees(
      {
        password: '***',
        profile: { name: 'old', removed: true },
        list: [1, 2],
      },
      { password: '***', profile: { name: 'new', added: null }, list: [1] },
    );
    const before = trees.before[0]?.children ?? [];
    const after = trees.after[0]?.children ?? [];
    expect(before[0]).toMatchObject({
      title: 'password: "***"',
      change: 'same',
    });
    expect(before[1]?.children).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: 'name: "old"', change: 'changed' }),
        expect.objectContaining({ title: 'removed: true', change: 'removed' }),
      ]),
    );
    expect(after[1]?.children).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: 'added: null', change: 'added' }),
      ]),
    );
    expect(before[2]?.children?.[1]).toMatchObject({ change: 'removed' });
  });

  it('distinguishes absent fields, null, types and array indexes without mutating snapshots', () => {
    const before = { a: null, b: {}, c: ['x'], d: 1 };
    const copy = structuredClone(before);
    const trees = diffTrees(before, {
      b: null,
      c: ['x', '<img onerror=alert(1)>'],
      d: '1',
    });
    expect(trees.before[0]?.children?.map((node) => node.change)).toEqual([
      'removed',
      'changed',
      'changed',
      'changed',
    ]);
    expect(trees.after[0]?.children?.[1]?.children?.[1]?.title).toContain(
      '<img',
    );
    expect(before).toEqual(copy);
    expect(diffTrees({ a: 1, b: 2 }, { b: 2, a: 1 }).before[0]?.change).toBe(
      'same',
    );
  });
});

describe('audit snapshot presentation', () => {
  it('distinguishes all five shapes and treats empty snapshots as absent', () => {
    expect(auditDiff(null, null)).toEqual({ kind: 'empty', fields: [] });
    expect(auditDiff({}, []).kind).toBe('empty');
    expect(auditDiff(null, { name: 'acme' }).kind).toBe('created');
    expect(auditDiff({ name: 'acme' }, null).kind).toBe('deleted');
    expect(auditDiff({ a: 1, b: 2 }, { b: 2, a: 1 })).toEqual({
      kind: 'unchanged',
      fields: [],
    });
    expect(auditDiff({ name: 'old' }, { name: 'new' }).kind).toBe('updated');
    expect(auditDiff(null, false).kind).toBe('created');
    expect(auditDiff(0, null).kind).toBe('deleted');
  });

  it('lists only changed fields and preserves masks, nulls, types, arrays and snapshots', () => {
    const before = {
      password: '***',
      profile: { name: 'old', removed: true },
      list: [1, 2],
      value: 1,
      nullable: null,
    };
    const copy = structuredClone(before);
    const diff = auditDiff(before, {
      password: '***',
      profile: { name: 'new', added: null },
      list: [1],
      value: '1',
    });
    expect(diff.fields.map((field) => field.field)).toEqual([
      'profile.name',
      'profile.removed',
      'profile.added',
      'list',
      'value',
      'nullable',
    ]);
    expect(diff.fields[0]).toMatchObject({
      before: 'old',
      after: 'new',
      change: 'changed',
    });
    expect(diff.fields[1]).toMatchObject({
      before: true,
      after: undefined,
      change: 'removed',
    });
    expect(diff.fields[2]).toMatchObject({
      before: undefined,
      after: null,
      change: 'added',
    });
    expect(diff.fields[3]).toMatchObject({ before: [1, 2], after: [1] });
    expect(diff.fields[5]).toMatchObject({ before: null, after: undefined });
    expect(auditDiff(null, { password: '***' }).fields[0]?.after).toBe('***');
    expect(before).toEqual(copy);
  });

  it('renders deletions, highlights, shape labels and escaped text in the actual component', () => {
    const root = document.createElement('div');
    const props = {
      before: { name: 'old', same: true },
      after: { name: '<img onerror=alert(1)>', same: true },
    };
    const app = createApp({ render: () => h(JsonDiff, props) });
    app.mount(root);
    expect(root.querySelector('del')?.textContent).toContain('old');
    expect(root.querySelector('mark')?.textContent).toContain(
      '<img onerror=alert(1)>',
    );
    expect(root.querySelector('img')).toBeNull();
    expect(root.textContent).not.toContain('same');
    app.unmount();
    for (const [before, after, label] of [
      [null, null, '—'],
      [null, { name: 'acme' }, '新建'],
      [{ name: 'acme' }, null, '删除'],
      [{ a: 1 }, { a: 1 }, '无变化'],
    ] as const) {
      const view = createApp({ render: () => h(JsonDiff, { before, after }) });
      view.mount(root);
      expect(root.textContent).toContain(label);
      view.unmount();
    }
  });
});
