import type { GatewayRouteInput } from '#/api/model/gateway';

export type GatewayRouteDraft = Omit<
  GatewayRouteInput,
  'price_cents' | 'units_per_call'
> & {
  price_cents: null | number;
  units_per_call: null | number;
};

export const gatewayCapabilities = [
  {
    capability: 'order.status',
    label: '订单状态查询',
    method: 'GET' as const,
    path: '/open/v1/orders/:id/status',
    route_group: 'orders',
  },
  {
    capability: 'usage.read',
    label: '用量查询',
    method: 'GET' as const,
    path: '/open/v1/usage',
    route_group: 'usage',
  },
];

export function emptyGatewayRouteDraft(): GatewayRouteDraft {
  const capability = gatewayCapabilities[0];
  if (!capability) throw new Error('没有可用的网关 capability');
  return {
    billing_mode: 'free',
    capability: capability.capability,
    code: capability.capability,
    currency: 'CNY',
    method: capability.method,
    name: '',
    path: capability.path,
    price_cents: null,
    route_group: capability.route_group,
    status: 'enabled',
    units_per_call: null,
    visibility: 'public',
  };
}

export function applyGatewayCapability(
  draft: GatewayRouteDraft,
  capability: string,
) {
  const definition = gatewayCapabilities.find(
    (item) => item.capability === capability,
  );
  if (!definition) return;
  draft.capability = definition.capability;
  draft.code = definition.capability;
  draft.method = definition.method;
  draft.path = definition.path;
  draft.route_group = definition.route_group;
}

export function validateGatewayRoute(draft: GatewayRouteDraft) {
  if (!draft.code.trim()) return '请填写路由 code';
  if (!draft.name.trim()) return '请填写路由名称';
  if (!draft.capability.trim()) return '请填写 capability';
  if (!gatewayCapabilities.some((item) => item.capability === draft.capability))
    return '请选择已登记的 capability';
  if (draft.code !== draft.capability)
    return '路由 code 必须与已登记的 capability 一致';
  if (!draft.path.trim().startsWith('/open/'))
    return '路由路径必须以 /open/ 开头';
  if (
    draft.billing_mode === 'per_call' &&
    draft.currency.trim().toUpperCase() !== 'CNY'
  )
    return '按量计费币种必须是 CNY';
  if (!draft.route_group.trim()) return '请填写路由分组';
  if (!draft.currency.trim()) return '请填写币种';
  if (draft.billing_mode === 'per_call') {
    if (
      !Number.isSafeInteger(draft.price_cents) ||
      (draft.price_cents ?? 0) <= 0
    )
      return '按量计费价格必须是大于 0 的整数分';
    if (
      !Number.isSafeInteger(draft.units_per_call) ||
      (draft.units_per_call ?? 0) <= 0
    )
      return '每次用量必须是大于 0 的整数';
  }
  return '';
}

export function normalizeGatewayRoute(
  draft: GatewayRouteDraft,
): GatewayRouteInput {
  return {
    billing_mode: draft.billing_mode,
    capability: draft.capability.trim(),
    code: draft.code.trim(),
    currency: draft.currency.trim().toUpperCase(),
    method: draft.method,
    name: draft.name.trim(),
    path: draft.path.trim(),
    price_cents:
      draft.billing_mode === 'per_call' ? (draft.price_cents ?? 0) : 0,
    route_group: draft.route_group.trim(),
    status: draft.status,
    units_per_call:
      draft.billing_mode === 'per_call' ? (draft.units_per_call ?? 1) : 1,
    visibility: draft.visibility,
  };
}
