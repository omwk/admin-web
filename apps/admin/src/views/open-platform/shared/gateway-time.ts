import type { Dayjs } from 'dayjs';

export type GatewayDateRange = [Dayjs, Dayjs];

export function validateGatewayRange(range: GatewayDateRange) {
  if (!range[0].isValid() || !range[1].isValid()) return '请选择有效的时间范围';
  if (range[0].isAfter(range[1])) return '开始时间不能晚于结束时间';
  if (range[1].diff(range[0], 'millisecond') > 30 * 24 * 60 * 60 * 1000)
    return '查询范围不能超过 30 天';
  return '';
}

export function gatewayRangeQuery(range: GatewayDateRange) {
  return { from: range[0].toISOString(), to: range[1].toISOString() };
}

export function formatGatewayRate(value: number) {
  const percent = value <= 1 ? value * 100 : value;
  return `${percent.toFixed(2)}%`;
}

export function formatGatewayCost(cents: number, currency = 'CNY') {
  return `${currency} ${(cents / 100).toFixed(2)}`;
}
