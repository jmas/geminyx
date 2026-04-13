/** First value from Expo Router / search params that may be string or string[]. */
export function firstParam(
  v: string | string[] | undefined,
): string | undefined {
  if (v == null) return undefined;
  return Array.isArray(v) ? v[0] : v;
}
