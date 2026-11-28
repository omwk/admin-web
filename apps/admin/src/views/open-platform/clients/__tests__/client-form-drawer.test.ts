import type { GatewayClient } from '#/api/model/gateway';

import { createApp, nextTick } from 'vue';

import { Modal } from 'ant-design-vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '#/api/errors';

import ClientFormDrawer from '../client-form-drawer.vue';

const api = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
}));
vi.mock('#/api/core/gateway', () => ({
  createGatewayClientApi: api.create,
  updateGatewayClientApi: api.update,
}));

const client = (): GatewayClient => ({
  app_id: 'app-unchanged',
  id: 42,
  ip_whitelist: ['10.0.0.0/8'],
  name: '旧名称',
  owner_user_id: 7,
  status: 'active',
  version: 12,
});

let app: ReturnType<typeof createApp> | undefined;
let container: HTMLDivElement;
let confirmation: Parameters<typeof Modal.confirm>[0] | undefined;
let saved: ReturnType<typeof vi.fn>;
let refreshed: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.resetAllMocks();
  confirmation = undefined;
  saved = vi.fn();
  refreshed = vi.fn();
  api.create.mockResolvedValue({});
  api.update.mockResolvedValue(client());
  vi.spyOn(Modal, 'confirm').mockImplementation((options) => {
    confirmation = options;
    return { destroy: vi.fn(), update: vi.fn() };
  });
  container = document.createElement('div');
  document.body.append(container);
});

afterEach(async () => {
  app?.unmount();
  await nextTick();
  container.remove();
  vi.restoreAllMocks();
});

function mount(selectedClient = client()) {
  app = createApp(ClientFormDrawer, {
    client: selectedClient,
    open: true,
    users: [],
    onSaved: saved,
    onRefresh: refreshed,
  });
  app.mount(container);
}

function input(label: string) {
  const element = document.querySelector<HTMLInputElement>(
    `input[aria-label="${label}"]`,
  );
  if (!element) throw new Error(`Missing input: ${label}`);
  return element;
}

function whitelistInput() {
  const element = document.querySelector<HTMLTextAreaElement>(
    'textarea[aria-label="IP 白名单"]',
  );
  if (!element) throw new Error('Missing IP whitelist input');
  return element;
}

function fill(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  element.value = value;
  element.dispatchEvent(new Event('input', { bubbles: true }));
}

async function submit() {
  await nextTick();
  const button = [
    ...document.querySelectorAll<HTMLButtonElement>('button'),
  ].find(
    (candidate) => candidate.textContent?.replaceAll(/\s/g, '') === '保存',
  );
  if (!button) throw new Error('Missing save button');
  button.click();
}

describe('gateway client edit drawer', () => {
  it('allows editing the name and IP/CIDR list and submits the selected version', async () => {
    mount();
    await nextTick();

    expect(input('客户端名称').disabled).toBe(false);
    expect(whitelistInput().disabled).toBe(false);
    expect(whitelistInput().placeholder).toContain('每行输入一个 IP 或网段');
    expect(document.body.textContent).toContain(
      '每行一个 IP 或网段，例如 10.0.0.0/8、192.168.1.10',
    );

    fill(input('客户端名称'), '新名称');
    fill(whitelistInput(), '10.0.0.0/8\n192.168.1.10');
    await submit();

    await vi.waitFor(() =>
      expect(api.update).toHaveBeenCalledWith(42, {
        ip_whitelist: ['10.0.0.0/8', '192.168.1.10'],
        name: '新名称',
        status: 'active',
        version: 12,
      }),
    );
    expect(saved).toHaveBeenCalledOnce();
  });

  it('requires confirmation before sending an empty whitelist', async () => {
    mount();
    await nextTick();
    fill(whitelistInput(), '');
    await submit();

    await vi.waitFor(() => expect(confirmation).toBeDefined());
    expect(confirmation?.content).toContain('清空后将允许所有 IP');
    expect(api.update).not.toHaveBeenCalled();

    await confirmation?.onOk?.(new MouseEvent('click'));
    await vi.waitFor(() =>
      expect(api.update).toHaveBeenCalledWith(42, {
        ip_whitelist: [],
        name: '旧名称',
        status: 'active',
        version: 12,
      }),
    );
    expect(saved).toHaveBeenCalledOnce();
  });

  it('does not update when clearing the whitelist is cancelled', async () => {
    mount();
    await nextTick();
    fill(whitelistInput(), '');
    await submit();

    await vi.waitFor(() => expect(confirmation).toBeDefined());
    await confirmation?.onCancel?.(new MouseEvent('click'));
    expect(api.update).not.toHaveBeenCalled();
    expect(saved).not.toHaveBeenCalled();
  });

  it('shows a version conflict and requests a list refresh', async () => {
    api.update.mockRejectedValueOnce(
      new ApiError({ code: 10_409, message: 'stale version', status: 409 }),
    );
    mount();
    await nextTick();
    fill(input('客户端名称'), '新名称');
    await submit();

    await vi.waitFor(() => expect(refreshed).toHaveBeenCalledWith(42));
    expect(document.body.textContent).toContain('已被他人修改，请刷新');
    expect(saved).not.toHaveBeenCalled();
  });
});
