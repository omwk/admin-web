import { createApp, nextTick } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '#/api/errors';

import ProviderForm from '../provider-form.vue';

const api = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock('#/api/core/notifications', () => ({
  saveNotificationProviderApi: api.save,
}));
let app: ReturnType<typeof createApp>;
let container: HTMLDivElement;
beforeEach(() => {
  vi.resetAllMocks();
  container = document.createElement('div');
  document.body.append(container);
});
afterEach(async () => {
  app?.unmount();
  await nextTick();
  container.remove();
});
function mount() {
  app = createApp(ProviderForm);
  app.mount(container);
}
function input(label: string) {
  const element = document.querySelector<HTMLInputElement>(
    `input[aria-label="${label}"]`,
  );
  if (!element) throw new Error(`Missing input: ${label}`);
  return element;
}
function fill(label: string, value: string) {
  const element = input(label);
  element.value = value;
  element.dispatchEvent(new Event('input', { bubbles: true }));
}
function item(label: string) {
  const element = document
    .querySelector(`[aria-label="${label}"]`)
    ?.closest('.ant-form-item');
  if (!element) throw new Error(`Missing form item: ${label}`);
  return element;
}
async function select(label: string, option: string) {
  await nextTick();
  document
    .querySelector(`[aria-label="${label}"]`)
    ?.closest('.ant-select')
    ?.querySelector('.ant-select-selector')
    ?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  await nextTick();
  const target = [...document.querySelectorAll('.ant-select-item-option')].find(
    (element) => element.textContent?.trim() === option,
  );
  if (!target) throw new Error(`Missing option: ${option}`);
  target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await nextTick();
}
async function submit() {
  await nextTick();
  document
    .querySelector<HTMLButtonElement>('.ant-modal .ant-btn-primary')
    ?.click();
}
function complete() {
  fill('服务商名称', 'FE-IDN-010');
  fill('SMTP 地址（host:port）', 'smtp.163.com:465');
  fill('发件人邮箱', 'noreply@example.com');
}

describe('provider form configuration', () => {
  it('renders ordinary fields visibly with exact guidance and masks SMTP credentials', () => {
    mount();
    complete();
    fill('SMTP 用户名', 'appvae@163.com');
    fill('SMTP 密码', crypto.randomUUID());
    const guidance = [
      [
        'SMTP 地址（host:port）',
        'smtp.163.com:465',
        '587 端口通常配 STARTTLS，465 配 TLS',
      ],
      ['SMTP 用户名', 'appvae@163.com', '163/QQ 邮箱需填写完整邮箱地址'],
      ['SMTP 密码', '输入授权码', '163 等邮箱使用授权码，不是登录密码'],
      ['发件人邮箱', 'noreply@example.com', '必须与发件人权限一致'],
      ['发件人名称', '订单通知', '显示在收件人邮箱里'],
    ] as const;
    for (const [label, placeholder, hint] of guidance) {
      expect(input(label).placeholder).toBe(placeholder);
      expect(item(label).textContent).toContain(hint);
      expect(input(label).type).toBe(
        label === 'SMTP 密码' ? 'password' : 'text',
      );
    }
    expect(input('SMTP 地址（host:port）').value).toBe('smtp.163.com:465');
    expect(input('SMTP 用户名').value).toBe('appvae@163.com');
    expect(input('发件人邮箱').value).toBe('noreply@example.com');
  });

  it.each([
    ['SendGrid', 'API Key'],
    ['阿里云邮件', 'Access Key Secret'],
    ['HTTP Webhook', '签名 Secret'],
  ])(
    'masks secrets but leaves addresses and identifiers visible for %s',
    async (kind, secret) => {
      mount();
      await select('服务商类型', kind);
      expect(input(secret).type).toBe('password');
      expect(input('服务地址').type).toBe('text');
      expect(input('服务地址').placeholder).toBe('https://example.com/hook');
      expect(item('服务地址').textContent).toContain('必须是 http(s)');
    },
  );

  it('leaves the access key identifier visible', async () => {
    mount();
    await select('服务商类型', '阿里云短信');
    expect(input('Access Key ID').type).toBe('text');
  });

  it.each([
    [
      'smtp_addr',
      'SMTP 地址（host:port）',
      'SMTP 地址需包含端口，例如 smtp.163.com:465',
    ],
    ['username', 'SMTP 用户名', '填写 SMTP 密码时必须同时填写用户名'],
  ])(
    'places %s failures under that field and clears only after editing it',
    async (field, label, message) => {
      api.save.mockRejectedValue(
        new ApiError({ status: 400, message, details: { field } }),
      );
      mount();
      complete();
      await submit();
      await vi.waitFor(() =>
        expect(item(label).textContent).toContain(message),
      );
      expect(item(label).classList.contains('ant-form-item-has-error')).toBe(
        true,
      );
      expect(document.querySelector('.ant-alert-error')).toBeNull();
      fill('发件人名称', '订单通知');
      await nextTick();
      expect(item(label).textContent).toContain(message);
      fill(
        label,
        field === 'smtp_addr' ? 'smtp.163.com:587' : 'appvae@163.com',
      );
      await nextTick();
      await vi.waitFor(() =>
        expect(item(label).textContent).not.toContain(message),
      );
      expect(item(label).classList.contains('ant-form-item-has-error')).toBe(
        false,
      );
    },
  );

  it.each([undefined, 'unknown_field'])(
    'falls back to the banner for an unlocatable field %s',
    async (field) => {
      api.save.mockRejectedValue(
        new ApiError({
          status: 400,
          message: '通道配置无效',
          details: { field },
        }),
      );
      mount();
      complete();
      await submit();
      await vi.waitFor(() =>
        expect(
          document.querySelector('.ant-alert-error')?.textContent,
        ).toContain('通道配置无效'),
      );
    },
  );

  it('redacts secrets in field errors as well as banners', async () => {
    const secret = crypto.randomUUID();
    api.save.mockRejectedValue(
      new ApiError({
        status: 400,
        message: `配置无效：${secret}`,
        details: { field: 'password' },
      }),
    );
    mount();
    complete();
    fill('SMTP 密码', secret);
    await submit();
    await vi.waitFor(() =>
      expect(item('SMTP 密码').textContent).toContain('配置无效：已配置'),
    );
    expect(document.body.textContent).not.toContain(secret);
  });

  it.each([undefined, 'smtp_addr'])(
    'clears config and errors on kind switches while retaining general values (field %s)',
    async (field) => {
      api.save.mockRejectedValueOnce(
        new ApiError({
          status: 400,
          message: '旧类型错误',
          details: { field },
        }),
      );
      mount();
      complete();
      fill('SMTP 密码', crypto.randomUUID());
      fill('服务商优先级', '17');
      document
        .querySelector<HTMLButtonElement>('[aria-label="启用服务商"]')
        ?.click();
      await submit();
      await vi.waitFor(() =>
        expect(document.body.textContent).toContain('旧类型错误'),
      );
      await select('服务商类型', 'HTTP Webhook');
      expect(document.body.textContent).not.toContain('旧类型错误');
      expect(input('服务商名称').value).toBe('FE-IDN-010');
      expect(input('服务商优先级').value).toBe('17');
      expect(
        document
          .querySelector('[aria-label="启用服务商"]')
          ?.getAttribute('aria-checked'),
      ).toBe('false');
      expect(input('服务地址').value).toBe('');
      fill('服务地址', 'https://example.com/hook');
      fill('签名 Secret', crypto.randomUUID());
      api.save.mockResolvedValueOnce({});
      await submit();
      await vi.waitFor(() => expect(api.save).toHaveBeenCalledTimes(2));
      expect(api.save.mock.lastCall?.[0]).toMatchObject({
        name: 'FE-IDN-010',
        priority: 17,
        enabled: false,
        kind: 'http',
      });
      expect(Object.keys(api.save.mock.lastCall?.[0].config)).toEqual([
        'endpoint',
        'secret',
      ]);
      await select('服务商类型', 'SMTP');
      expect(input('SMTP 地址（host:port）').value).toBe('');
      expect(input('SMTP 密码').value).toBe('');
    },
  );

  it('warns on mismatched standard ports, reacts to either input and still saves', async () => {
    api.save.mockResolvedValue({});
    mount();
    complete();
    await nextTick();
    expect(item('TLS 模式').textContent).toContain('465 通常使用隐式 TLS');
    await select('TLS 模式', 'TLS');
    expect(item('TLS 模式').textContent).not.toContain('465 通常使用隐式 TLS');
    fill('SMTP 地址（host:port）', '[::1]:587');
    await nextTick();
    expect(item('TLS 模式').textContent).toContain('587 通常使用 STARTTLS');
    await select('TLS 模式', 'STARTTLS');
    expect(item('TLS 模式').textContent).not.toContain('587 通常使用 STARTTLS');
    fill('SMTP 地址（host:port）', 'smtp.163.com:2525');
    await nextTick();
    expect(item('TLS 模式').querySelector('[role="status"]')).toBeNull();
    fill('SMTP 地址（host:port）', 'smtp.163.com:465');
    await submit();
    await vi.waitFor(() =>
      expect(api.save).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            smtp_addr: 'smtp.163.com:465',
            tls_mode: 'starttls',
          }),
        }),
        undefined,
      ),
    );
  });
});
