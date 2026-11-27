import type { ApiRequestConfig } from '#/api/client';
import type {
  GatewayCallPage,
  GatewayCallQuery,
  GatewayCallSummary,
  GatewayClient,
  GatewayClientCreated,
  GatewayClientInput,
  GatewayClientUpdate,
  GatewayCreatedSecret,
  GatewayInfo,
  GatewayRevealedSecret,
  GatewayRoute,
  GatewayRouteGrant,
  GatewayRouteGrantInput,
  GatewayRouteInput,
  GatewayRouteUpdate,
  GatewaySecret,
  GatewaySummaryQuery,
  GatewayTryInput,
  GatewayTryResult,
} from '#/api/model/gateway';

import { requestClient } from '#/api/request';

const read: ApiRequestConfig = { silent: true };
const write: ApiRequestConfig = {
  preserveBusinessMessage: true,
  silent: true,
};

export const getGatewayClientsApi = () =>
  requestClient.get<GatewayClient[]>('/admin/api-clients', read);
export const getGatewayClientApi = (clientId: number) =>
  requestClient.get<GatewayClient>(`/admin/api-clients/${clientId}`, read);
export const createGatewayClientApi = (input: GatewayClientInput) =>
  requestClient.post<GatewayClientCreated>('/admin/api-clients', input, write);
export const updateGatewayClientApi = (
  id: number,
  input: GatewayClientUpdate,
) => requestClient.put<GatewayClient>(`/admin/api-clients/${id}`, input, write);

export const getGatewaySecretsApi = (clientId: number) =>
  requestClient.get<GatewaySecret[]>(
    `/admin/api-clients/${clientId}/secrets`,
    read,
  );
export const createGatewaySecretApi = (
  clientId: number,
  overlapSeconds: number,
) =>
  requestClient.post<GatewayCreatedSecret>(
    `/admin/api-clients/${clientId}/secrets`,
    { overlap_seconds: overlapSeconds },
    write,
  );
export const revealGatewaySecretApi = (clientId: number, secretId: number) =>
  requestClient.get<GatewayRevealedSecret>(
    `/admin/api-clients/${clientId}/secrets/${secretId}/reveal`,
    { ...read, headers: { 'Cache-Control': 'no-store' } },
  );
export const revokeGatewaySecretApi = (clientId: number, secretId: number) =>
  requestClient.delete(
    `/admin/api-clients/${clientId}/secrets/${secretId}`,
    write,
  );

export const getGatewayClientGrantsApi = (clientId: number) =>
  requestClient.get<GatewayRouteGrant[]>(
    `/admin/api-clients/${clientId}/routes`,
    read,
  );
export const saveGatewayClientGrantApi = (
  clientId: number,
  input: GatewayRouteGrantInput,
) =>
  requestClient.post<undefined>(
    `/admin/api-clients/${clientId}/routes`,
    input,
    write,
  );
export const revokeGatewayClientGrantApi = (
  clientId: number,
  grantId: number,
) =>
  requestClient.delete<undefined>(
    `/admin/api-clients/${clientId}/routes/${grantId}`,
    write,
  );

export const getGatewayRoutesApi = () =>
  requestClient.get<GatewayRoute[]>('/admin/api-routes', read);
export const createGatewayRouteApi = (input: GatewayRouteInput) =>
  requestClient.post<GatewayRoute>('/admin/api-routes', input, write);
export const updateGatewayRouteApi = (id: number, input: GatewayRouteUpdate) =>
  requestClient.put<GatewayRoute>(`/admin/api-routes/${id}`, input, write);

export const getGatewayCallsApi = (query: GatewayCallQuery) =>
  requestClient.get<GatewayCallPage>('/admin/api-calls', {
    ...read,
    params: query,
  });
export const getGatewayCallSummaryApi = (query: GatewaySummaryQuery) =>
  requestClient.get<GatewayCallSummary>('/admin/api-calls/summary', {
    ...read,
    params: query,
  });
export const tryGatewayClientApi = (clientId: number, input: GatewayTryInput) =>
  requestClient.post<GatewayTryResult>(
    `/admin/api-clients/${clientId}/try`,
    input,
    write,
  );
export const getGatewayInfoApi = () =>
  requestClient.get<GatewayInfo>('/admin/gateway/info', read);
