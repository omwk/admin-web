/** Preserve int64 values before JSON.parse can round them to a JS Number. */
export function parseCatalogJSON(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const json = value.replaceAll(
    /"(?:\\.|[^"\\])*"|-?\d+(?:\.\d+)?(?:[Ee][+-]?\d+)?/g,
    (token) => {
      if (!/^-?\d+$/.test(token)) return token;
      const integer = BigInt(token);
      return integer > BigInt(Number.MAX_SAFE_INTEGER) ||
        integer < BigInt(Number.MIN_SAFE_INTEGER)
        ? `"${token}"`
        : token;
    },
  );
  return JSON.parse(json);
}
