export type NotificationChannel =
  | 'dingtalk'
  | 'email'
  | 'sms'
  | 'webhook'
  | 'wecom';
export type NotificationKind =
  | 'aliyun_dm'
  | 'aliyun_sms'
  | 'dingtalk_bot'
  | 'http'
  | 'sendgrid'
  | 'smtp'
  | 'wecom_bot';

export interface NotificationInbox {
  id: number;
  channel: 'inbox' | NotificationChannel;
  template: string;
  payload: Record<string, unknown>;
  status: string;
  attempts: number;
  last_error: string;
  read_at: null | string;
  created_at: string;
  credential_id: null | number;
}
export interface NotificationPreference {
  template: string;
  channel: NotificationChannel;
  enabled: boolean;
}
export interface NotificationPreferenceView extends NotificationPreference {
  inherited: boolean;
}
export interface NotificationProvider {
  id: number;
  tenant_id: null | number;
  channel: NotificationChannel;
  kind: NotificationKind;
  name: string;
  config: Record<string, boolean | string>;
  enabled: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
}
export interface NotificationProviderInput {
  channel: NotificationChannel;
  kind: NotificationKind;
  name: string;
  config?: Record<string, string>;
  enabled: boolean;
  priority: number;
}
export interface NotificationTemplate {
  id: number;
  tenant_id: null | number;
  code: string;
  locale: string;
  subject: string;
  body: string;
  format: 'html' | 'text';
  enabled: boolean;
}
export type NotificationTemplateInput = Pick<
  NotificationTemplate,
  'body' | 'enabled' | 'format' | 'locale' | 'subject'
>;
export interface NotificationDelivery {
  id: number;
  tenant_id: number;
  channel: NotificationChannel;
  template_code: string;
  recipient_hash: string;
  recipient_domain: string;
  provider_id: null | number;
  status: 'failed' | 'pending' | 'sent' | 'skipped';
  attempts: number;
  last_error: string;
  created_at: string;
  sent_at: null | string;
  next_retry_at: null | string;
}
