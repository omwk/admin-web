// Email links use a fragment credential even when the deployed app uses hash routes.
export function normalizeEmailVerificationLink(href: string, base: string) {
  const url = new URL(href);
  const basePath = new URL(base, url.origin).pathname.replace(/\/$/, '');
  if (
    url.pathname !== `${basePath}/auth/email/verify` ||
    url.hash.startsWith('#/')
  )
    return undefined;
  return `${basePath}/#/auth/email/verify${url.search}${url.hash}`;
}
