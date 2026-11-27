import type { PageResult } from './response';

export type GatewayStatus = 'active' | 'suspended';
export type GatewayRouteStatus = 'disabled' | 'enabled';
export type GatewayMethod = 'DELETE' | 'GET' | 'HEAD' | 'POST' | 'PUT';
export type GatewayVisibility = 'private' | 'public';
export type GatewayBillingMode = 'free' | 'package' | 'per_call';
export type GatewayRouteBillingMode = 'free' | 'per_call';

export interface GatewayClient {
  app_id: string;
  id: number;
  ip_whitelist: string[];
  name: string;
  owner_user_id?: number;
  status: GatewayStatus;
  version: number;
}

export interface GatewaySecret {
  expires_at: null | string;
  id: number;
  last_used_at: null | string;
  revealable: boolean;
  secret_prefix: string;
  status: 'active' | 'expired' | 'revoked';
}

export interface GatewayCreatedSecret {
  expires_at: null | string;
  id: number;
  secret: string;
  secret_prefix: string;
}

export interface GatewayRevealedSecret {
  expires_at: null | string;
  prefix: string;
  secret: string;
}

export type GatewaySecretMaterial =
  | GatewayCreatedSecret
  | GatewayRevealedSecret;

export interface GatewayClientCreated {
  client: GatewayClient;
  key: GatewayCreatedSecret;
}

export interface GatewayClientInput {
  ip_whitelist: string[];
  name: string;
  owner_user_id: number;
}

export interface GatewayClientUpdate {
  status: GatewayStatus;
  version: number;
}

export interface GatewayRoute {
  billing_mode: GatewayBillingMode;
  capability: string;
  code: string;
  currency: string;
  id: number;
  method: GatewayMethod;
  name: string;
  path: string;
  price_cents: null | number;
  route_group: string;
  status: GatewayRouteStatus;
  units_per_call: null | number;
  version: number;
  visibility: GatewayVisibility;
}

export interface GatewayRouteInput {
  billing_mode: GatewayRouteBillingMode;
  capability: string;
  code: string;
  currency: string;
  method: GatewayMethod;
  name: string;
  path: string;
  price_cents: null | number;
  route_group: string;
  status: GatewayRouteStatus;
  units_per_call: null | number;
  visibility: GatewayVisibility;
}

export interface GatewayRouteUpdate extends GatewayRouteInput {
  version: number;
}

export interface GatewayRouteGrant {
  expires_at: null | string;
  granted_at: string;
  id: number;
  method: '' | GatewayMethod;
  path: string;
  quota_daily: number;
  quota_monthly: number;
  route_code: string;
  route_id: number;
  route_name: string;
  status: 'active' | 'suspended';
  version: number;
}

export interface GatewayRouteGrantInput {
  expires_at: null | string;
  quota_daily: number;
  quota_monthly: number;
  route_id: number;
  status: 'active' | 'suspended';
}

export interface GatewayCall {
  billing_mode: GatewayBillingMode;
  called_at: string;
  client_id?: number;
  client_name: string;
  cost_cents: number;
  cost_units: number;
  error_code: null | number | string;
  id: number;
  latency_ms: number;
  method: GatewayMethod;
  path: string;
  route_code: string;
  route_id?: number;
  state: string;
  status_code: number;
  trace_id: string;
}

export interface GatewayCallQuery {
  client_id?: number;
  from?: string;
  page?: number;
  page_size?: number;
  route_id?: number;
  status?: 'failed' | 'success';
  to?: string;
  trace_id?: string;
}

export interface GatewayCallSummaryItem {
  calls: number;
  cost_cents: number;
  key: string;
  p95_latency_ms: number;
  success_rate: number;
}

export interface GatewayCallSummary {
  items: GatewayCallSummaryItem[];
  total_calls: number;
}

export type GatewayCallPage = PageResult<GatewayCall>;

export interface GatewaySummaryQuery {
  from?: string;
  group_by: 'client' | 'day' | 'route';
  to?: string;
}

export interface GatewayTryInput {
  body?: unknown;
  query?: Record<string, string>;
  route_id: number;
}

export interface GatewayTryResult {
  billing: {
    billed: boolean;
    mode: GatewayRouteBillingMode;
    units: number;
  };
  error_code?: number;
  latency_ms: number;
  response: unknown;
  status_code: number;
  truncated: boolean;
}

export interface GatewayInfo {
  allowed_origins: string[];
  public_base_url: string;
}
