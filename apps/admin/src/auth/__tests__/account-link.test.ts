import { describe, expect, it } from 'vitest';

import { frontendAccountLink, passwordError } from '../account-link';

describe('account links and password rules', () => {
  it.each([
    '/auth/invite/accept',
    '/auth/password/reset',
    '/auth/register/verify',
  ])('normalizes %s with tenant code and legacy ID intact', (path) => {
    expect(
      frontendAccountLink(
        `https://deployment.example${path}?tenant=acme&tenant_id=2#token=opaque`,
        'http://127.0.0.1:5666',
      ),
    ).toBe(`http://127.0.0.1:5666${path}?tenant=acme&tenant_id=2#token=opaque`);
    expect(
      frontendAccountLink(
        `${path}?tenant=acme#token=opaque`,
        'https://admin.example',
      ),
    ).toBe(`https://admin.example${path}?tenant=acme#token=opaque`);
  });
  it('targets the current frontend while retaining the tenant and fragment credential', () => {
    expect(
      frontendAccountLink(
        'http://old-host/auth/invite/accept?tenant_id=2#token=opaque',
        'http://127.0.0.1:5666',
      ),
    ).toBe('http://127.0.0.1:5666/auth/invite/accept?tenant_id=2#token=opaque');
    expect(() =>
      frontendAccountLink('https://other/path#token=x', 'http://localhost'),
    ).toThrow('无法识别');
  });
  it('enforces character, letter, digit and UTF-8 byte limits', () => {
    expect(passwordError('Abc12345')).toBe('');
    expect(passwordError('密码123456')).toBe('');
    for (const password of [
      '12345678',
      'abcdefgh',
      'A123',
      'abcdefgh²',
      `密${'a'.repeat(69)}1`,
    ])
      expect(passwordError(password)).not.toBe('');
  });
});
