import { describe, expect, it } from 'vitest';

import { diffTrees } from '../json-diff';

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
