import { describe, expect, it } from 'vitest';

import { normalizeEmailVerificationLink } from '../email-verify-link';

describe('external email verification links with hash routing', () => {
  it('keeps the credential in the fragment and preserves the tenant', () => {
    const target = normalizeEmailVerificationLink(
      'https://accounts.example/auth/email/verify?tenant=acme#token=opaque',
      '/',
    );
    expect(target).toBe('/#/auth/email/verify?tenant=acme#token=opaque');
    expect(new URL(target ?? '', 'https://accounts.example').search).toBe('');
  });
  it('supports an application deployed under a base path', () => {
    expect(
      normalizeEmailVerificationLink(
        'https://accounts.example/console/auth/email/verify?tenant=acme#token=opaque',
        '/console/',
      ),
    ).toBe('/console/#/auth/email/verify?tenant=acme#token=opaque');
  });
  it('also routes a missing credential to the verification error page', () => {
    expect(
      normalizeEmailVerificationLink(
        'https://accounts.example/auth/email/verify',
        '/',
      ),
    ).toBe('/#/auth/email/verify');
  });
  it.each([
    'https://accounts.example/#/auth/email/verify?tenant=acme#token=opaque',
    'https://accounts.example/auth/login#token=opaque',
    'https://accounts.example/other/auth/email/verify#token=opaque',
  ])('leaves other locations alone: %s', (href) => {
    expect(normalizeEmailVerificationLink(href, '/')).toBeUndefined();
  });
});
