/** Human-readable size using binary units (1024). */
export function formatByteCount(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const units = ["KB", "MB", "GB", "TB"] as const;
  let v = bytes / 1024;
  let u = 0;
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024;
    u++;
  }
  const decimals = v >= 100 ? 0 : 1;
  let s = v.toFixed(decimals);
  if (s.endsWith(".0")) s = s.slice(0, -2);
  return `${s} ${units[u]}`;
}
