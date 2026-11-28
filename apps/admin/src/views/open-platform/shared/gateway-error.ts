import { toApiError } from '#/api/errors';

const versionConflictMessage = '已被他人修改，请刷新';

export function gatewayErrorMessage(error: unknown) {
  const failure = toApiError(error);
  return failure.businessMessage || failure.message;
}

export function gatewayRouteSaveError(error: unknown) {
  return isGatewayVersionConflict(error)
    ? versionConflictMessage
    : gatewayErrorMessage(error);
}

export function gatewayClientSaveError(error: unknown) {
  return isGatewayVersionConflict(error)
    ? versionConflictMessage
    : gatewayErrorMessage(error);
}

export function isGatewayVersionConflict(error: unknown) {
  const failure = toApiError(error);
  return failure.status === 409 || failure.code === 10_409;
}
