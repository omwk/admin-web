import type { Department } from '#/api/model/system';

import { createApp, nextTick } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '#/api/errors';

import DepartmentForm from '../department-form.vue';

const api = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn() }));
vi.mock('#/api/core/system', () => ({
  createDepartmentApi: api.create,
  updateDepartmentApi: api.update,
}));
const root: Department = {
  id: 1,
  parent_id: 0,
  name: '总部',
  path: '1',
  sort: 0,
  status: 'active',
  member_count: 3,
};
const child: Department = {
  ...root,
  id: 2,
  parent_id: 1,
  name: '电商',
  path: '1.2',
  sort: -3,
  status: 'disabled',
  member_count: 0,
};
let app: ReturnType<typeof createApp>;
let container: HTMLDivElement;
const saved = vi.fn();
const busy = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  container = document.createElement('div');
  document.body.append(container);
});
afterEach(async () => {
  await nextTick();
  app.unmount();
  container.remove();
});
function mount(department?: Department, parentId = 1) {
  app = createApp(DepartmentForm, {
    department,
    parentId,
    departments: [
      {
        ...root,
        children: [
          {
            ...child,
            children: [
              { ...child, id: 3, parent_id: 2, name: '商品组', path: '1.2.3' },
            ],
          },
        ],
      },
    ],
    onSaved: saved,
    onBusy: busy,
  });
  app.mount(container);
}
async function submit(name: string) {
  const input = container.querySelector<HTMLInputElement>(
    '[aria-label="部门名称"]',
  );
  if (!input) throw new Error('Missing department name input');
  input.value = name;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await nextTick();
  const form = container.querySelector('form');
  if (!form) throw new Error('Missing department form');
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

describe('department form', () => {
  it('renders the edited department and its descendant as disabled parent choices', async () => {
    mount(child);
    const selector = container.querySelector<HTMLElement>(
      '.ant-select-selector',
    );
    if (!selector) throw new Error('Missing parent selector');
    selector.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await vi.waitFor(() =>
      expect(document.querySelector('.ant-select-dropdown')).not.toBeNull(),
    );
    const choices = [
      ...document.querySelectorAll<HTMLElement>('.ant-select-tree-title'),
    ];
    for (const name of ['电商', '商品组']) {
      const choice = choices.find((item) => item.textContent === name);
      expect(
        choice
          ?.closest('.ant-select-tree-treenode')
          ?.classList.contains('ant-select-tree-treenode-disabled'),
      ).toBe(true);
    }
    const rootChoice = choices.find((item) => item.textContent === '总部');
    expect(
      rootChoice
        ?.closest('.ant-select-tree-treenode')
        ?.classList.contains('ant-select-tree-treenode-disabled'),
    ).toBe(false);
    expect(
      choices.find((item) => item.textContent === '无（根）'),
    ).toBeUndefined();
  });

  it.each(['', '   ', '甲'.repeat(65)])(
    'rejects invalid names without sending requests: %j',
    async (name) => {
      mount();
      await submit(name);
      await vi.waitFor(() =>
        expect(container.textContent).toContain('名称必填，长度为 1–64 字'),
      );
      expect(api.create).not.toHaveBeenCalled();
    },
  );

  it.each([1, 2])(
    'creates with the chosen parent %i and default sort/status',
    async (parentId) => {
      const response = {
        ...child,
        parent_id: parentId,
        name: '新部门',
        sort: 0,
        status: 'active',
      };
      api.create.mockResolvedValueOnce(response);
      mount(undefined, parentId);
      expect(container.querySelector('[aria-label="上级部门"]') === null).toBe(
        parentId === 1,
      );
      await submit(' 新部门 ');
      await vi.waitFor(() =>
        expect(api.create).toHaveBeenCalledWith({
          parent_id: parentId,
          name: '新部门',
          sort: 0,
          status: 'active',
        }),
      );
      expect(saved).toHaveBeenCalledWith(response);
      expect(busy.mock.calls).toEqual([[true], [false]]);
    },
  );

  it('rejects root creation when no parent is provided', async () => {
    mount(undefined, 0);
    await submit('无上级部门');
    await vi.waitFor(() =>
      expect(container.textContent).toContain('请选择上级部门'),
    );
    expect(api.create).not.toHaveBeenCalled();
  });

  it('still saves the existing root with its original parent', async () => {
    api.update.mockResolvedValueOnce({ ...root, name: '总部改名' });
    mount(root);
    await submit('总部改名');
    await vi.waitFor(() =>
      expect(api.update).toHaveBeenCalledWith(root.id, {
        parent_id: 0,
        name: '总部改名',
        sort: 0,
        status: 'active',
      }),
    );
  });

  it('saves editable fields only, preserving sort and disabled status', async () => {
    api.update.mockResolvedValueOnce({ ...child, name: '改名部门' });
    mount(child);
    await submit('改名部门');
    await vi.waitFor(() =>
      expect(api.update).toHaveBeenCalledWith(2, {
        parent_id: 1,
        name: '改名部门',
        sort: -3,
        status: 'disabled',
      }),
    );
    expect(saved).toHaveBeenCalledWith({ ...child, name: '改名部门' });
  });

  it.each(['同一上级部门下名称已存在', '已存在根部门，请选择上级部门'])(
    'shows the backend message verbatim and retains the form: %s',
    async (message) => {
      api.create.mockRejectedValueOnce(
        new ApiError({
          config: { preserveBusinessMessage: true } as never,
          status: 400,
          code: 10_001,
          message,
        }),
      );
      mount(undefined, 1);
      await submit('电商');
      await vi.waitFor(() =>
        expect(container.querySelector('.ant-alert-message')?.textContent).toBe(
          message,
        ),
      );
      expect(
        container.querySelector<HTMLInputElement>('[aria-label="部门名称"]')
          ?.value,
      ).toBe('电商');
      expect(saved).not.toHaveBeenCalled();
    },
  );
});
