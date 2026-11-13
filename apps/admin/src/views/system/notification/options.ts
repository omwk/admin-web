import type {
  NotificationChannel,
  NotificationDelivery,
} from '#/api/model/notification';

export const notificationChannels: {
  label: string;
  value: NotificationChannel;
}[] = [
  { label: '邮件', value: 'email' },
  { label: '短信', value: 'sms' },
  { label: '企微', value: 'wecom' },
  { label: '钉钉', value: 'dingtalk' },
  { label: 'Webhook', value: 'webhook' },
];
export const deliveryStatuses: Record<
  NotificationDelivery['status'],
  { color: string; label: string }
> = {
  pending: { color: 'processing', label: '待发送' },
  sent: { color: 'success', label: '已发送' },
  failed: { color: 'error', label: '失败' },
  skipped: { color: 'warning', label: '已跳过' },
};
export function channelLabel(value: string) {
  return (
    notificationChannels.find((channel) => channel.value === value)?.label ??
    value
  );
}
function safePayload(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((entry) => safePayload(entry));
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        /secret|password|token|api.?key|authorization/i.test(key)
          ? '已配置'
          : safePayload(entry),
      ]),
    );
  return value;
}
function payloadText(value: unknown) {
  if (value === null) return '—';
  return typeof value === 'string' ? value : JSON.stringify(value);
}
export function payloadEntries(payload: Record<string, unknown>) {
  const safe = safePayload(payload) as Record<string, unknown>;
  return Object.entries(safe).map(([key, value]) => ({
    key,
    value: payloadText(value),
  }));
}
export function notificationSummary(payload: Record<string, unknown>) {
  const entries = payloadEntries(payload);
  return (
    entries.find((entry) =>
      ['message', 'subject', 'summary', 'title'].includes(entry.key),
    )?.value ??
    (entries.map((entry) => `${entry.key}：${entry.value}`).join('；') ||
      '查看通知详情')
  );
}
