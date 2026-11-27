import { toApiError } from '#/api/errors';

export function gatewayErrorMessage(error: unknown) {
  const failure = toApiError(error);
  return failure.businessMessage || failure.message;
}

export function gatewayRouteSaveError(error: unknown) {
  const failure = toApiError(error);
  return failure.status === 409
    ? '已被他人修改，请刷新'
    : gatewayErrorMessage(error);
}

export function isGatewayVersionConflict(error: unknown) {
  return toApiError(error).status === 409;
}
