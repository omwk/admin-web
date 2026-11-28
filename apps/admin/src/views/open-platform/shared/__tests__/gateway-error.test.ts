import { describe, expect, it } from 'vitest';

import { ApiError } from '#/api/errors';

import {
  gatewayClientSaveError,
  gatewayErrorMessage,
  gatewayRouteSaveError,
  isGatewayVersionConflict,
} from '../gateway-error';

describe('gateway error messages', () => {
  it('shows the backend message and falls back to the shared status message', () => {
    expect(
      gatewayErrorMessage(
        new ApiError({ message: '租户当前不可编辑', status: 403 }),
      ),
    ).toBe('租户当前不可编辑');
    expect(gatewayErrorMessage(new ApiError({ status: 403 }))).toBe(
      '没有权限执行此操作',
    );
  });

  it('uses the optimistic-lock conflict message for route edits', () => {
    const conflict = new ApiError({ message: 'stale version', status: 409 });
    expect(gatewayRouteSaveError(conflict)).toBe('已被他人修改，请刷新');
    expect(isGatewayVersionConflict(conflict)).toBe(true);
    expect(
      gatewayRouteSaveError(
        new ApiError({ message: '路由 code 已存在', status: 400 }),
      ),
    ).toBe('路由 code 已存在');
    expect(isGatewayVersionConflict(new ApiError({ status: 400 }))).toBe(false);
  });

  it('recognizes the gateway client version-conflict code', () => {
    const conflict = new ApiError({ code: 10_409 });
    expect(isGatewayVersionConflict(conflict)).toBe(true);
    expect(gatewayClientSaveError(conflict)).toBe('已被他人修改，请刷新');
  });
});
