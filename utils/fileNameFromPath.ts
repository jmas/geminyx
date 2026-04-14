/**
 * Last path segment of a URI or file path; strips query and fragment.
 * Works for `file://`, `gemini://`, `https://`, and plain `/a/b/c.png`.
 */
export function fileNameFromUriOrPath(uri: string): string | undefined {
  const s = uri.trim();
  if (!s) return undefined;
  let path = s.split("#")[0] ?? s;
  path = path.split("?")[0] ?? path;
  path = path.replace(/\\/g, "/");
  const parts = path.split("/").filter((p) => p.length > 0);
  const last = parts.length > 0 ? parts[parts.length - 1] : undefined;
  if (!last) return undefined;
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
}
