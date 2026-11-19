import { createApp, nextTick } from 'vue';

import { message } from 'ant-design-vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import TemplateForm from '../template-form.vue';
import {
  insertVariable,
  referencedVariables,
  unknownVariables,
} from '../template-variables';

const api = vi.hoisted(() => ({
  variables: vi.fn(),
  save: vi.fn(),
  preview: vi.fn(),
  test: vi.fn(),
}));
vi.mock('#/api/core/notifications', () => ({
  getNotificationTemplateVariablesApi: api.variables,
  saveNotificationTemplateApi: api.save,
  previewNotificationTemplateApi: api.preview,
  testNotificationTemplateApi: api.test,
}));
const variables = [
  {
    name: 'AppName',
    description: '系统名称',
    example: '示例系统',
    required: true,
  },
  {
    name: 'Link',
    description: '操作链接',
    example: 'https://example.invalid',
    required: false,
  },
];
const template = {
  id: 37,
  tenant_id: null,
  code: 'identity.verify',
  locale: 'zh-CN',
  subject: '{{.AppName}}',
  body: '前后',
  format: 'text',
  enabled: true,
};
let app: ReturnType<typeof createApp>;
let container: HTMLDivElement;
beforeEach(() => {
  vi.resetAllMocks();
  api.variables.mockResolvedValue({ 'identity.verify': variables });
  container = document.createElement('div');
  document.body.append(container);
});
afterEach(async () => {
  app?.unmount();
  message.destroy();
  await nextTick();
  container.remove();
});
function button(text: string) {
  const result = [
    ...document.querySelectorAll<HTMLButtonElement>('button'),
  ].find((item) => item.textContent?.replaceAll(/\s/g, '') === text);
  if (!result) throw new Error(`Missing button ${text}`);
  return result;
}
async function mount() {
  app = createApp(TemplateForm, { template });
  app.mount(container);
  await vi.waitFor(() =>
    expect(document.body.textContent).toContain('系统名称'),
  );
}
describe('template editing tools', () => {
  it('finds unknown fields in control actions, ignoring quoted text and comments', () => {
    const text =
      '{{if .AppName}}{{.Unknown | printf "%s"}}{{end}}{{".Literal"}}{{/* .Comment */}}';
    expect(referencedVariables(text)).toEqual(['AppName', 'Unknown']);
    expect(unknownVariables(text, variables)).toEqual(['Unknown']);
    expect(insertVariable('前选中后', 'Link', 1, 3)).toEqual({
      text: '前{{.Link}}后',
      caret: 10,
    });
  });
  it('inserts into the remembered body selection and blocks unknown saves by name', async () => {
    await mount();
    const body = document.querySelector<HTMLTextAreaElement>(
      'textarea[aria-label="模板正文"]',
    );
    if (!body) throw new Error('Missing body');
    body.focus();
    body.setSelectionRange(1, 1);
    body.dispatchEvent(new Event('select'));
    const insert = document.querySelector<HTMLButtonElement>(
      '[aria-label="插入 Link"]',
    );
    if (!insert) throw new Error('Missing insert');
    insert.click();
    await nextTick();
    expect(body.value).toBe('前{{.Link}}后');
    expect(body.selectionStart).toBe(10);
    body.value = '{{.Mistyped}}';
    body.dispatchEvent(new Event('input', { bubbles: true }));
    await nextTick();
    button('保存').click();
    await vi.waitFor(() =>
      expect(document.body.textContent).toContain(
        '引用了未声明的变量：Mistyped',
      ),
    );
    expect(api.save).not.toHaveBeenCalled();
    expect(button('预览').disabled).toBe(true);
  });
  it('previews the saved ID with examples and enqueues a test on that ID', async () => {
    api.preview.mockResolvedValue({ subject: '示例系统', body: '示例正文' });
    api.test.mockResolvedValue({ delivery_id: 8 });
    await mount();
    button('预览').click();
    await vi.waitFor(() =>
      expect(
        document.querySelector('[data-testid="template-preview"]')?.textContent,
      ).toContain('示例正文'),
    );
    expect(api.preview).toHaveBeenCalledWith(37);
    expect(
      document.querySelector('[data-testid="template-preview"]')?.textContent,
    ).not.toContain('{{');
    button('发送测试').click();
    await vi.waitFor(() => expect(api.test).toHaveBeenCalledWith(37));
    await vi.waitFor(() =>
      expect(document.body.textContent).toContain(
        '已发送测试邮件，可在投递记录查看',
      ),
    );
  });
  it('prevents saving when variable declarations could not be fetched', async () => {
    api.variables.mockRejectedValue(new Error('变量服务暂不可用'));
    app = createApp(TemplateForm, { template });
    app.mount(container);
    await vi.waitFor(() =>
      expect(document.body.textContent).toContain('变量服务暂不可用'),
    );
    button('保存').click();
    await nextTick();
    expect(api.save).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('变量列表尚未加载');
  });
});
