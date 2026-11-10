import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);

export function formatDateTime(value?: null | string): string {
  if (!value) return '—';
  const date = dayjs.utc(value);
  return date.isValid() ? date.local().format('YYYY-MM-DD HH:mm:ss') : '—';
}
