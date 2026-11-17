import type {
  NotificationChannel,
  NotificationKind,
} from '#/api/model/notification';

export const providerKinds: {
  channel: NotificationChannel;
  label: string;
  value: NotificationKind;
}[] = [
  { channel: 'email', label: 'SMTP', value: 'smtp' },
  { channel: 'email', label: '阿里云邮件', value: 'aliyun_dm' },
  { channel: 'email', label: 'SendGrid', value: 'sendgrid' },
  { channel: 'sms', label: '阿里云短信', value: 'aliyun_sms' },
  { channel: 'wecom', label: '企微机器人', value: 'wecom_bot' },
  { channel: 'dingtalk', label: '钉钉机器人', value: 'dingtalk_bot' },
  { channel: 'webhook', label: 'HTTP Webhook', value: 'http' },
];
export interface ProviderField {
  key: string;
  label: string;
  required?: boolean;
  private?: boolean;
  placeholder?: string;
  hint?: string;
}
const guidance: Record<string, { hint: string; placeholder: string }> = {
  smtp_addr: {
    placeholder: 'smtp.163.com:465',
    hint: '587 端口通常配 STARTTLS，465 配 TLS',
  },
  username: {
    placeholder: 'appvae@163.com',
    hint: '163/QQ 邮箱需填写完整邮箱地址',
  },
  password: {
    placeholder: '输入授权码',
    hint: '163 等邮箱使用授权码，不是登录密码',
  },
  from_address: {
    placeholder: 'noreply@example.com',
    hint: '必须与发件人权限一致',
  },
  endpoint: {
    placeholder: 'https://example.com/hook',
    hint: '必须是 http(s)',
  },
  from_name: { placeholder: '订单通知', hint: '显示在收件人邮箱里' },
};
const field = (
  key: string,
  label: string,
  required = false,
  privateValue = false,
): ProviderField => ({
  key,
  label,
  required,
  private: privateValue,
  ...guidance[key],
});
const endpoint = field('endpoint', '服务地址', true);
const accessKeys = [
  field('access_key_id', 'Access Key ID', true),
  field('access_key_secret', 'Access Key Secret', true, true),
];
export function providerFields(kind: NotificationKind): ProviderField[] {
  switch (kind) {
    case 'smtp': {
      return [
        field('smtp_addr', 'SMTP 地址（host:port）', true),
        field('username', 'SMTP 用户名'),
        field('password', 'SMTP 密码', false, true),
        field('from_address', '发件人邮箱', true),
        field('from_name', '发件人名称'),
        field('tls_mode', 'TLS 模式', true),
      ];
    }
    case 'aliyun_dm': {
      return [
        endpoint,
        ...accessKeys,
        field('region', '区域', true),
        field('from_address', '发件人邮箱', true),
        field('from_name', '发件人名称'),
      ];
    }
    case 'sendgrid': {
      return [
        endpoint,
        field('api_key', 'API Key', true, true),
        field('from_address', '发件人邮箱', true),
        field('from_name', '发件人名称'),
      ];
    }
    case 'aliyun_sms': {
      return [
        endpoint,
        ...accessKeys,
        field('region', '区域', true),
        field('sign_name', '短信签名', true),
        field('template_code', '短信模板编码', true),
      ];
    }
    case 'http': {
      return [endpoint, field('secret', '签名 Secret', true, true)];
    }
    default: {
      return [endpoint, field('secret', '签名 Secret', false, true)];
    }
  }
}
