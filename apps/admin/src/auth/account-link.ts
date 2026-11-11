/** Backend links may use a deployment origin; keep the credential in the fragment. */
export function frontendAccountLink(link: string, origin: string) {
  const url = new URL(link, origin);
  if (!['/auth/invite/accept', '/auth/password/reset'].includes(url.pathname)) {
    throw new Error('无法识别的账号链接');
  }
  return new URL(`${url.pathname}${url.search}${url.hash}`, origin).href;
}

export function passwordError(password: string) {
  // Go counts Unicode code points rather than grapheme clusters.
  const codePoints = password.match(/./gsu)?.length ?? 0;
  if (
    codePoints < 8 ||
    new TextEncoder().encode(password).length > 72 ||
    !/\p{L}/u.test(password) ||
    !/\p{Nd}/u.test(password)
  ) {
    return '密码至少 8 个字符，包含字母和数字，且不超过 72 字节';
  }
  return '';
}
