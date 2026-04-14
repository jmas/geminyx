export type GeminiParsedResponse = {
  statusCode: number;
  /** Text on the header line after the status and single space (MIME, URI, INPUT prompt, …). */
  meta: string;
  /** Content after the first header line (CRLF or LF); may be empty. */
  body: string;
  /** Full wire string from the server (for debugging). */
  raw: string;
  /**
   * Non–text/gemini success body from native (binary wire). When set, decode with
   * `base64ToUint8Array` instead of treating `body` as UTF-8 text.
   */
  bodyBinaryBase64?: string;
};

/**
 * Parses a Gemini wire response: `<STATUS> <META>\r\n` then body.
 * Accepts `\n` if `\r\n` is missing.
 */
export function parseGeminiResponse(raw: string): GeminiParsedResponse {
  const normalized = raw.replace(/^\ufeff/, "");
  let headerEnd = normalized.indexOf("\r\n");
  let bodyStart = headerEnd >= 0 ? headerEnd + 2 : -1;
  if (headerEnd < 0) {
    const lf = normalized.indexOf("\n");
    if (lf < 0) {
      throw new Error("Invalid Gemini response: missing header line");
    }
    headerEnd = lf;
    bodyStart = lf + 1;
  }
  const header = normalized.slice(0, headerEnd);
  const body = normalized.slice(bodyStart);
  const m = header.match(/^(\d{2}) (.*)$/);
  if (!m) {
    throw new Error(`Invalid Gemini response header: ${header.slice(0, 80)}`);
  }
  const statusCode = Number.parseInt(m[1], 10);
  if (Number.isNaN(statusCode)) {
    throw new Error("Invalid Gemini status code");
  }
  return {
    statusCode,
    meta: m[2],
    body,
    raw: normalized,
  };
}

function appendInputToUrl(promptUrl: string, userInput: string): string {
  const input = userInput.trim();
  if (!input.length) return promptUrl.trim();
  const base = promptUrl.trim();
  const enc = encodeURIComponent(input);
  return base.includes("?") ? `${base}&${enc}` : `${base}?${enc}`;
}

/**
 * Resolves a Gemtext link target against the current document URL (capsule or prior fetch).
 * Absolute `gemini://` links are returned as-is; relative paths use WHATWG URL resolution.
 */
export function resolveGeminiLinkHref(href: string, baseUrl: string): string {
  const h = href.trim();
  if (!h.length) {
    throw new Error("Empty Gemini link");
  }
  if (/^gemini:\/\//i.test(h)) {
    return h;
  }
  const base = baseUrl.trim();
  if (!base.length) {
    throw new Error("Relative Gemini link needs a capsule URL as base");
  }
  try {
    return new URL(h, base).href;
  } catch {
    throw new Error("Could not resolve Gemini link");
  }
}

/**
 * Stores what was requested: same-origin path (+ query + hash), or the full
 * URL string if the request origin differs from the capsule (e.g. INPUT meta).
 */
export function geminiRequestPathForMessage(
  capsuleUrl: string,
  fullRequestUrl: string,
): string {
  const cap = capsuleUrl.trim();
  const req = fullRequestUrl.trim();
  if (!req.length) return "";
  try {
    const uCap = new URL(cap);
    const uReq = new URL(req);
    const same =
      uCap.protocol === uReq.protocol &&
      uCap.hostname === uReq.hostname &&
      uCap.port === uReq.port;
    if (!same) {
      return req;
    }
    const path = `${uReq.pathname}${uReq.search}${uReq.hash}`;
    return path.length > 0 ? path : "/";
  } catch {
    return req;
  }
}

/**
 * True when the message was fetched from the capsule root URL (same path as
 * opening the bare `gemini://host` URL). Used for “Revisit home” vs “Revisit”.
 *
 * Compares resolved URLs so `requestPath` "" vs "/" vs the stored home path
 * all match the same document as `geminiRequestPathForMessage(cap, cap)`.
 */
export function isCapsuleRootRequestPath(
  capsuleUrl: string,
  message: { requestPath: string },
): boolean {
  const cap = capsuleUrl.trim();
  if (!cap) return false;
  try {
    const homePath = geminiRequestPathForMessage(cap, cap);
    const rootUrl = resolveGeminiRequestPathForCompare(cap, homePath);
    const msgUrl = resolveGeminiRequestPathForCompare(
      cap,
      message.requestPath ?? "",
    );
    return geminiUrlsCanonicallyEqual(rootUrl, msgUrl);
  } catch {
    return false;
  }
}

function geminiUrlsCanonicallyEqual(a: string, b: string): boolean {
  if (a === b) return true;
  try {
    return new URL(a).href === new URL(b).href;
  } catch {
    return false;
  }
}

function resolveGeminiRequestPathForCompare(
  capsuleUrl: string,
  requestPath: string,
): string {
  const cap = capsuleUrl.trim();
  const raw = requestPath.trim();
  const homePath = geminiRequestPathForMessage(cap, cap);
  if (raw === "" || raw === "/" || raw === homePath) {
    return geminiDocumentBaseUrlForMessage(cap, {
      isOutgoing: false,
      requestPath: homePath,
    });
  }
  return geminiDocumentBaseUrlForMessage(cap, {
    isOutgoing: false,
    requestPath: raw,
  });
}

/** Base URL for resolving relative Gemtext links for a given message. */
export function geminiDocumentBaseUrlForMessage(
  capsuleUrl: string,
  message: { isOutgoing: boolean; requestPath: string },
): string {
  const cap = capsuleUrl.trim();
  const raw = message.requestPath?.trim() ?? "";
  if (!raw.length) {
    return cap;
  }
  if (/^gemini:\/\//i.test(raw)) {
    return raw;
  }
  try {
    return new URL(raw, cap).href;
  } catch {
    return cap;
  }
}

/**
 * Builds the URL for the next Gemini request.
 * - No input text: returns the capsule URL only (start / home).
 * - With input (message form): `resolve(capsuleUrl, lastMessage.requestPath)` + `?` +
 *   `encodeURIComponent(input)` (and `&` if the base URL already has a query).
 */
export function resolveGeminiRequestUrl(
  capsuleUrl: string,
  lastMessage: { requestPath?: string } | undefined,
  userText: string,
): string {
  const base = capsuleUrl.trim();
  if (!base) {
    throw new Error("Capsule URL is missing");
  }
  const text = userText.trim();

  if (!text.length) {
    return base;
  }

  const promptBase = lastMessage
    ? geminiDocumentBaseUrlForMessage(base, {
        isOutgoing: false,
        requestPath: lastMessage.requestPath ?? "",
      })
    : base;
  return appendInputToUrl(promptBase, text);
}

/** Status 30 (temporary) or 31 (permanent) redirection. */
export function isGeminiRedirectStatus(statusCode: number): boolean {
  return statusCode === 30 || statusCode === 31;
}

/**
 * Resolves 30/31 `meta` (absolute or relative URI per spec) against the request
 * that received the redirect.
 */
export function resolveGeminiRedirectTarget(
  meta: string,
  baseRequestUrl: string,
): string {
  const m = meta.trim();
  if (!m.length) return "";
  const base = baseRequestUrl.trim();
  try {
    return base.length > 0 ? new URL(m, base).href : m;
  } catch {
    return m;
  }
}

/**
 * Capsule-stored URL: `gemini://` origin only (no path, query, or hash).
 * Default port 1965 is omitted; non-default ports are kept.
 */
export function normalizeGeminiCapsuleRootUrl(url: string): string {
  const raw = url.trim();
  if (!raw.length) return raw;
  if (!/^gemini:\/\//i.test(raw)) return raw;
  try {
    const u = new URL(raw);
    if (!/^gemini:$/i.test(u.protocol)) return raw;
    const host = u.hostname;
    const port = u.port;
    const defaultPort = "1965";
    if (port && port !== defaultPort) {
      return `gemini://${host}:${port}`;
    }
    return `gemini://${host}`;
  } catch {
    return raw;
  }
}

/** Compare `gemini://` origin (protocol + host + port). */
export function geminiOriginsMatch(a: string, b: string): boolean {
  const u = a.trim();
  const v = b.trim();
  if (!u.length || !v.length) return false;
  try {
    const ua = new URL(u);
    const ub = new URL(v);
    if (!/^gemini:$/i.test(ua.protocol) || !/^gemini:$/i.test(ub.protocol)) {
      return false;
    }
    return (
      ua.hostname === ub.hostname &&
      String(ua.port || "1965") === String(ub.port || "1965")
    );
  } catch {
    return false;
  }
}

/** `gemini://` URL whose origin differs from the capsule root URL. */
export function isCrossOriginGeminiUrl(
  targetUrl: string,
  capsuleRootUrl: string,
): boolean {
  const t = targetUrl.trim();
  if (!/^gemini:\/\//i.test(t)) return false;
  return !geminiOriginsMatch(t, capsuleRootUrl);
}

export function suggestedCapsuleNameFromGeminiUrl(url: string): string {
  try {
    const u = new URL(url.trim());
    if (u.hostname.length > 0) return u.hostname;
  } catch {
    /* ignore */
  }
  return "Gemini capsule";
}

/** Path + query + hash for footer “Visit …” labels (e.g. `/foo/bar?x=1`). */
export function geminiPathnameForVisitButton(url: string): string {
  const raw = url.trim();
  if (!raw.length) return "";
  try {
    const u = new URL(raw);
    const p = `${u.pathname}${u.search}${u.hash}`;
    return p.length > 0 ? p : "/";
  } catch {
    return "";
  }
}

export function truncateForVisitButtonLabel(text: string, max = 80): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}...`;
}

/** MIME from Gemini `20 <meta>` line (strip parameters). */
export function geminiSuccessMimeType(meta: string): string {
  const m = meta.trim();
  if (!m.length) return "";
  const semi = m.indexOf(";");
  return (semi >= 0 ? m.slice(0, semi) : m).trim().toLowerCase();
}

/** Status 20 with `text/gemini` (or empty meta) body should be shown as Gemtext. */
export function isGeminiTextGeminiResponse(
  statusCode: number,
  meta: string,
): boolean {
  if (statusCode !== 20) return false;
  const mime = geminiSuccessMimeType(meta);
  return mime === "text/gemini" || mime === "";
}

/** Success response with an explicit non–text/gemini MIME (stored as blob). */
export function isGeminiSuccessNonGemtextResource(
  statusCode: number,
  meta: string,
): boolean {
  if (statusCode !== 20) return false;
  const mime = geminiSuccessMimeType(meta);
  return mime.length > 0 && mime !== "text/gemini";
}

export function isGeminiInputStatus(statusCode: number): boolean {
  return statusCode === 10 || statusCode === 11;
}

/**
 * If `meta` looks like a `gemini://` URL (non-compliant or supplemental resource),
 * returns it resolved against `requestUrl`. Otherwise returns null.
 *
 * Spec INPUT `meta` is **human-readable prompt text**, not a URL; callers should
 * show `meta` (and optional `body`) directly. Purely numeric `meta` is treated as
 * non-URL so we do not build bogus paths like `gemini://host/1024`.
 */
export function resolveGeminiInputPromptUrl(
  meta: string,
  requestUrl: string,
): string | null {
  const m = meta.trim();
  if (!m.length) return null;
  if (/^\d+$/.test(m)) return null;
  if (/^gemini:\/\//i.test(m)) {
    return m;
  }
  const base = requestUrl.trim();
  if (!base.length) return null;
  try {
    const abs = new URL(m, base).href;
    return /^gemini:\/\//i.test(abs) ? abs : null;
  } catch {
    return null;
  }
}

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
