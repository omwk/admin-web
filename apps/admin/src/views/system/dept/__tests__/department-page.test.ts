import type { Department, DepartmentInput } from '#/api/model/system';

import { createApp, nextTick } from 'vue';

import { Modal } from 'ant-design-vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '#/api/errors';

import DepartmentPage from '../index.vue';

const state = vi.hoisted(() => ({
  codes: [] as string[],
  data: [] as Department[],
  tree: vi.fn(),
  detail: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}));
vi.mock('@vben/common-ui', () => ({
  Page: { template: '<main><slot /></main>' },
}));
vi.mock('#/auth/permission', () => ({
  hasPermission: (code: string) => state.codes.includes(code),
}));
vi.mock('#/api/core/system', () => ({
  getDepartmentsApi: state.tree,
  getDepartmentApi: state.detail,
  createDepartmentApi: state.create,
  updateDepartmentApi: state.update,
  deleteDepartmentApi: state.remove,
}));
const node = (
  id: number,
  name: string,
  parent = 0,
  children: Department[] = [],
): Department => ({
  id,
  name,
  parent_id: parent,
  children,
  path: parent ? `1.${id}` : String(id),
  sort: 0,
  status: 'active',
  member_count: id === 1 ? 3 : 0,
});
const initialTree = () => [
  node(1, '总部', 0, [
    node(2, '电商', 1, [node(3, '商品组', 2)]),
    node(4, '客服', 1),
  ]),
];
const flatten = (nodes: Department[]): Department[] =>
  nodes.flatMap((item) => [item, ...flatten(item.children ?? [])]);
let app: ReturnType<typeof createApp>;
let container: HTMLDivElement;
let confirmation: Parameters<typeof Modal.confirm>[0] | undefined;

beforeEach(() => {
  vi.resetAllMocks();
  state.codes = [
    'system:dept:create',
    'system:dept:update',
    'system:dept:delete',
  ];
  state.data = initialTree();
  state.tree.mockImplementation(async () => structuredClone(state.data));
  state.detail.mockImplementation(async (id: number) => {
    const selected = flatten(state.data).find((item) => item.id === id);
    if (!selected) throw new Error('Missing test department');
    const { children: _children, ...detail } = selected;
    return structuredClone(detail);
  });
  state.remove.mockResolvedValue(undefined);
  confirmation = undefined;
  vi.spyOn(Modal, 'confirm').mockImplementation((options) => {
    confirmation = options;
    return { destroy: vi.fn(), update: vi.fn() };
  });
  container = document.createElement('div');
  document.body.append(container);
});
afterEach(async () => {
  await nextTick();
  app.unmount();
  container.remove();
});
async function mount() {
  app = createApp(DepartmentPage);
  app.mount(container);
  await vi.waitFor(() =>
    expect(state.detail).toHaveBeenCalledWith(state.data[0]?.id),
  );
  await nextTick();
}
function row(id: number) {
  return container.querySelector<HTMLElement>(`[data-dept-id="${id}"]`);
}
function buttons(name: string, parent: null | ParentNode = container) {
  if (!parent) throw new Error('Missing department row');
  return [...parent.querySelectorAll<HTMLButtonElement>('button')].filter(
    (button) => button.textContent?.replaceAll(/\s/g, '') === name,
  );
}
function clickButton(name: string, parent: null | ParentNode = container) {
  const button = buttons(name, parent)[0];
  if (!button) throw new Error('Missing department action');
  button.click();
}
function submitForm() {
  const form = container.querySelector('form');
  if (!form) throw new Error('Missing department form');
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}
async function enterName(name: string) {
  const input = container.querySelector<HTMLInputElement>(
    '[aria-label="部门名称"]',
  );
  if (!input) throw new Error('Missing department name input');
  input.value = name;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await nextTick();
}

describe('department page', () => {
  it.each([1, 2])(
    'reloads a newly created department under parent %i and selects its server detail',
    async (parentId) => {
      await mount();
      expect(buttons('新增根部门')).toHaveLength(0);
      expect(buttons('新增一级部门')).toHaveLength(1);
      clickButton(
        parentId === 1 ? '新增一级部门' : '新增子部门',
        parentId === 1 ? container : row(parentId),
      );
      await nextTick();
      expect(container.querySelector('[aria-label="上级部门"]') === null).toBe(
        parentId === 1,
      );
      state.create.mockImplementationOnce(async (input: DepartmentInput) => {
        expect(input).toEqual({
          parent_id: parentId,
          name: '新部门',
          sort: 0,
          status: 'active',
        });
        const created = {
          ...node(9, '新部门', parentId),
          path: parentId === 1 ? '1.9' : '1.2.9',
        };
        const parent = flatten(state.data).find((item) => item.id === parentId);
        if (!parent) throw new Error('Missing parent department');
        parent.children?.push(created);
        return created;
      });
      await enterName('新部门');
      submitForm();
      await vi.waitFor(() => expect(state.tree).toHaveBeenCalledTimes(2));
      await vi.waitFor(() =>
        expect(
          container.querySelector('[data-testid="department-detail"]')
            ?.textContent,
        ).toContain(parentId === 1 ? '1.9' : '1.2.9'),
      );
      expect(row(9)?.textContent).toContain('新部门');
      expect(state.detail.mock.calls.at(-1)).toEqual([9]);
      expect(
        row(9)
          ?.closest('.ant-tree-treenode')
          ?.querySelectorAll('.ant-tree-indent-unit'),
      ).toHaveLength(parentId === 1 ? 1 : 2);
    },
  );

  it('uses the existing root ID even when search hides the entire tree', async () => {
    state.data = [node(73, '唯一根', 0, [node(74, '现有一级', 73)])];
    await mount();
    const search = container.querySelector<HTMLInputElement>(
      '[aria-label="搜索部门"]',
    );
    if (!search) throw new Error('Missing department search input');
    search.value = '没有匹配';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await vi.waitFor(() =>
      expect(container.textContent).toContain('没有匹配的部门'),
    );
    clickButton('新增一级部门');
    await nextTick();
    state.create.mockResolvedValueOnce({
      ...node(75, '新一级', 73),
      path: '73.75',
    });
    await enterName('新一级');
    submitForm();
    await vi.waitFor(() =>
      expect(state.create).toHaveBeenCalledWith({
        parent_id: 73,
        name: '新一级',
        sort: 0,
        status: 'active',
      }),
    );
  });

  it('refreshes both the tree label and detail after renaming a department', async () => {
    await mount();
    clickButton('编辑', row(2));
    await vi.waitFor(() =>
      expect(
        container.querySelector('[data-testid="department-form"]'),
      ).not.toBeNull(),
    );
    state.update.mockImplementationOnce(
      async (id: number, input: DepartmentInput) => {
        expect(id).toBe(2);
        expect(input.name).toBe('电商运营');
        const selected = flatten(state.data).find((item) => item.id === id);
        if (!selected) throw new Error('Missing renamed department');
        Object.assign(selected, input);
        return structuredClone(selected);
      },
    );
    await enterName('电商运营');
    submitForm();
    await vi.waitFor(() => expect(state.tree).toHaveBeenCalledTimes(2));
    await vi.waitFor(() =>
      expect(
        container.querySelector('[data-testid="department-detail"]')
          ?.textContent,
      ).toContain('电商运营'),
    );
    expect(row(2)?.textContent).toContain('电商运营');
    expect(state.detail.mock.calls.at(-1)).toEqual([2]);
  });

  it('reloads the complete tree and detail after moving a department with children', async () => {
    await mount();
    clickButton('编辑', row(2));
    await vi.waitFor(() =>
      expect(
        container.querySelector('[data-testid="department-form"]'),
      ).not.toBeNull(),
    );
    const selector = container.querySelector<HTMLElement>(
      '.ant-select-selector',
    );
    if (!selector) throw new Error('Missing parent selector');
    selector.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await vi.waitFor(() =>
      expect(document.querySelector('.ant-select-dropdown')).not.toBeNull(),
    );
    const sibling = [
      ...document.querySelectorAll<HTMLElement>(
        '.ant-select-dropdown .ant-select-tree-title',
      ),
    ].find((item) => item.textContent === '客服');
    if (!sibling) throw new Error('Missing valid parent option');
    sibling.click();
    state.update.mockImplementationOnce(
      async (_id: number, input: DepartmentInput) => {
        expect(input.parent_id).toBe(4);
        const moved = {
          ...node(2, '电商', 4),
          path: '1.4.2',
          children: [{ ...node(3, '商品组', 2), path: '1.4.2.3' }],
        };
        state.data = [node(1, '总部', 0, [node(4, '客服', 1, [moved])])];
        return moved;
      },
    );
    submitForm();
    await vi.waitFor(() => expect(state.tree).toHaveBeenCalledTimes(2));
    await vi.waitFor(() =>
      expect(
        container.querySelector('[data-testid="department-detail"]')
          ?.textContent,
      ).toContain('1.4.2'),
    );
    expect(state.detail.mock.calls.at(-1)).toEqual([2]);
    expect(row(3)).not.toBeNull();
    expect(
      row(2)
        ?.closest('.ant-tree-treenode')
        ?.querySelectorAll('.ant-tree-indent-unit'),
    ).toHaveLength(2);
    expect(
      row(3)
        ?.closest('.ant-tree-treenode')
        ?.querySelectorAll('.ant-tree-indent-unit'),
    ).toHaveLength(3);
  });

  it('ignores an older detail response after a newer selection', async () => {
    await mount();
    let resolveOlder!: (department: Department) => void;
    state.detail.mockImplementationOnce(
      () =>
        new Promise<Department>((resolve) => {
          resolveOlder = resolve;
        }),
    );
    row(2)?.click();
    await vi.waitFor(() => expect(state.detail).toHaveBeenCalledWith(2));
    row(4)?.click();
    await vi.waitFor(() =>
      expect(
        container.querySelector('[data-testid="department-detail"]')
          ?.textContent,
      ).toContain('客服'),
    );
    resolveOlder(node(2, '电商', 1));
    await nextTick();
    expect(
      container.querySelector('[data-testid="department-detail"]')?.textContent,
    ).toContain('客服');
    expect(
      container.querySelector('[data-testid="department-detail"]')?.textContent,
    ).not.toContain('电商');
  });

  it('confirms consequences and displays a protected-delete 409 verbatim', async () => {
    state.remove.mockRejectedValueOnce(
      new ApiError({
        config: { preserveBusinessMessage: true } as never,
        status: 409,
        code: 10_004,
        message: '部门下仍有子部门，不能删除',
      }),
    );
    await mount();
    clickButton('删除', row(2));
    expect(confirmation?.content).toContain('不可恢复');
    expect(confirmation?.content).toContain('在册用户');
    await confirmation?.onOk?.();
    await vi.waitFor(() =>
      expect(container.querySelector('.ant-alert-message')?.textContent).toBe(
        '部门下仍有子部门，不能删除',
      ),
    );
    expect(state.tree).toHaveBeenCalledTimes(1);
    expect(row(2)).not.toBeNull();
  });

  it('reloads the tree after deleting an empty department', async () => {
    await mount();
    state.remove.mockImplementationOnce(async () => {
      state.data = [
        node(1, '总部', 0, [node(2, '电商', 1, [node(3, '商品组', 2)])]),
      ];
    });
    clickButton('删除', row(4));
    await confirmation?.onOk?.();
    await vi.waitFor(() => expect(state.tree).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(row(4)).toBeNull());
  });

  it.each([
    [[], 0, 0, 0],
    [['system:dept:create'], 5, 0, 0],
    [['system:dept:update'], 0, 4, 0],
    [['system:dept:delete'], 0, 0, 4],
  ] as const)(
    'gates each operation independently for %j',
    async (codes, creates, updates, deletes) => {
      state.codes = [...codes];
      await mount();
      expect(
        buttons('新增一级部门').length + buttons('新增子部门').length,
      ).toBe(creates);
      expect(buttons('编辑')).toHaveLength(updates);
      expect(buttons('删除')).toHaveLength(deletes);
    },
  );

  it('preserves ancestors when searching and shows the exact no-match message', async () => {
    await mount();
    const input = container.querySelector<HTMLInputElement>(
      '[aria-label="搜索部门"]',
    );
    if (!input) throw new Error('Missing department search input');
    input.value = '商品';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await nextTick();
    expect(row(1)).not.toBeNull();
    expect(row(2)).not.toBeNull();
    expect(row(3)).not.toBeNull();
    await vi.waitFor(() => expect(row(4)).toBeNull());
    input.value = '没有这个部门';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await vi.waitFor(() =>
      expect(container.textContent).toContain('没有匹配的部门'),
    );
  });

  it('disables first-level creation when the seeded root is missing', async () => {
    state.data = [];
    app = createApp(DepartmentPage);
    app.mount(container);
    await vi.waitFor(() => expect(container.textContent).toContain('暂无部门'));
    expect(buttons('新增根部门')).toHaveLength(0);
    const button = buttons('新增一级部门')[0];
    expect(button).toBeDefined();
    expect(button?.disabled).toBe(true);
    button?.click();
    await nextTick();
    expect(container.querySelector('form')).toBeNull();
    expect(state.create).not.toHaveBeenCalled();
  });
});
