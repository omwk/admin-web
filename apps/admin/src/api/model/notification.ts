export type NotificationChannel =
  | 'bark'
  | 'dingtalk'
  | 'email'
  | 'gotify'
  | 'sms'
  | 'webhook'
  | 'wecom';
export type PersonalNotificationChannel = 'bark' | 'gotify' | 'webhook';
export interface PersonalNotificationChannelView {
  channel: PersonalNotificationChannel;
  endpoint_masked: string;
  enabled: boolean;
  verified_at: null | string;
  created_at: string;
  updated_at: string;
}
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
  title: string;
  summary: string;
  template_name: string;
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
  name: string;
  transactional: boolean;
  available: boolean;
  reason: string;
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
export interface NotificationVariable {
  name: string;
  description: string;
  example: string;
  required: boolean;
}
export interface NotificationTemplatePreview {
  subject: string;
  body: string;
}
export type BroadcastChannel = 'email' | 'inbox';
export interface BroadcastAudience {
  type: 'all' | 'roles' | 'users';
  ids?: number[];
}
export interface NotificationBroadcastInput {
  title: string;
  body: string;
  channels: BroadcastChannel[];
  audience: BroadcastAudience;
}
export interface NotificationBroadcastResult {
  broadcast_id: number;
  recipients: number;
}
export interface NotificationBroadcast extends NotificationBroadcastResult {
  title: string;
  channels: string[];
  audience: BroadcastAudience;
  created_at: string;
}
export interface NotificationDelivery {
  id: number;
  tenant_id: number;
  channel: NotificationChannel;
  template_code: string;
  template_name: string;
  recipient_masked: null | string;
  recipient_hash: string;
  recipient_domain: string;
  provider_id: null | number;
  status: 'failed' | 'pending' | 'sent' | 'skipped';
  attempts: number;
  last_error: string;
  last_error_message: string;
  created_at: string;
  sent_at: null | string;
  next_retry_at: null | string;
}
export interface NotificationDeliveryFilters {
  status?: NotificationDelivery['status'];
  channel?: NotificationChannel;
  template_code?: string;
}
export interface NotificationDeliveryRetryResult {
  retried: number;
  skipped: number;
}
