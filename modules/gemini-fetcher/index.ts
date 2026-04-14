import { NativeModules } from "react-native";
import { base64ToUint8Array } from "lib/db/utils";
import {
  parseGeminiResponse as parseGeminiResponseFromWire,
  type GeminiParsedResponse,
} from "lib/models/gemini";

/**
 * Native Gemini (TCP/TLS) client. `fetch` resolves with the **full raw response**
 * (status line + CRLF + body).
 */
export type GeminiFetchTlsIdentity = {
  /**
   * Optional Keychain/Keystore identifier for a previously stored client identity.
   * When present (and supported by the native module), native code should use this
   * identity directly instead of importing PKCS#12 for each request.
   */
  identityLabel?: string;
  /** Base64-encoded PKCS#12 archive (DER). */
  pkcs12Base64: string;
  /** Passphrase for the archive; use empty string if none. */
  passphrase?: string;
};

export interface NativeGeminiFetcherModule {
  fetch(urlString: string): Promise<string>;
  fetchWithOptions?(
    urlString: string,
    options: { pkcs12Base64: string; passphrase?: string },
  ): Promise<string>;
  fetchWithIdentityLabel?(
    urlString: string,
    options: { identityLabel: string },
  ): Promise<string>;
  storeIdentityFromPkcs12?(
    options: { identityLabel: string; pkcs12Base64: string; passphrase?: string },
  ): Promise<void>;
}

export const GeminiFetcherNative = (
  NativeModules as {
    GeminiFetcher?: NativeGeminiFetcherModule;
  }
).GeminiFetcher;

export default GeminiFetcherNative;

export type { GeminiParsedResponse };

/** Native iOS returns this for `20` + non–`text/gemini` MIME (binary body). */
export type GeminiWireBinary = {
  wireFormat: "binary";
  statusCode: number;
  meta: string;
  bodyBase64: string;
};

export type GeminiFetchInit = {
  redirect?: "follow" | "manual" | "error";
  maxRedirects?: number;
  input?: "manual" | "error";
  includeRaw?: boolean;
  /** TLS client identity for servers that require a client certificate. */
  tls?: GeminiFetchTlsIdentity;
};

export type GeminiFetchHistoryItem = { url: string; status: number; meta: string };

export type GeminiInputPrompt = {
  sensitive: boolean;
  prompt: string;
  body?: string;
};

export type GeminiResponse = {
  url: string;
  requestUrl: string;
  redirected: boolean;
  history: GeminiFetchHistoryItem[];

  status: number;
  ok: boolean;
  meta: string;
  statusText: string;

  mimeType: string;
  isGemtext: boolean;
  isBinary: boolean;

  inputPrompt?: GeminiInputPrompt;

  text(): Promise<string>;
  bytes(): Promise<Uint8Array>;

  raw?: string;
};

function isGeminiWireBinary(v: unknown): v is GeminiWireBinary {
  return (
    typeof v === "object" &&
    v !== null &&
    (v as GeminiWireBinary).wireFormat === "binary" &&
    typeof (v as GeminiWireBinary).bodyBase64 === "string"
  );
}

function isRedirectStatus(statusCode: number): boolean {
  return statusCode === 30 || statusCode === 31;
}

function isInputStatus(statusCode: number): boolean {
  return statusCode === 10 || statusCode === 11;
}

function resolveRedirectTarget(meta: string, baseRequestUrl: string): string {
  const m = meta.trim();
  if (!m.length) return "";
  const base = baseRequestUrl.trim();
  try {
    return base.length > 0 ? new URL(m, base).href : m;
  } catch {
    return m;
  }
}

function successMimeType(meta: string): string {
  const m = meta.trim();
  if (!m.length) return "";
  const semi = m.indexOf(";");
  return (semi >= 0 ? m.slice(0, semi) : m).trim().toLowerCase();
}

function statusTextForGeminiStatus(status: number): string {
  if (status >= 20 && status <= 29) return "SUCCESS";
  if (status >= 30 && status <= 39) return "REDIRECT";
  if (status === 10 || status === 11) return "INPUT";
  if (status >= 40 && status <= 49) return "TEMPORARY_FAILURE";
  if (status >= 50 && status <= 59) return "PERMANENT_FAILURE";
  if (status >= 60 && status <= 69) return "CLIENT_CERT_REQUIRED";
  return "UNKNOWN";
}

export async function geminiFetchRaw(
  urlString: string,
  tls?: GeminiFetchTlsIdentity,
): Promise<string | GeminiWireBinary> {
  const mod = GeminiFetcherNative;
  if (!mod?.fetch) {
    throw new Error(
      "GeminiFetcher native module is not available (native build required).",
    );
  }
  const p12 = tls?.pkcs12Base64?.trim();
  let res: unknown;
  if (p12) {
    if (!mod.fetchWithOptions) {
      throw new Error(
        "This build does not support Gemini client certificates. Rebuild the iOS app with the latest GeminiFetcher native module.",
      );
    }
    res = await mod.fetchWithOptions(urlString, {
      pkcs12Base64: p12,
      passphrase: tls?.passphrase ?? "",
    });
  } else {
    const identityLabel = tls?.identityLabel?.trim();
    if (identityLabel && mod.fetchWithIdentityLabel) {
      res = await mod.fetchWithIdentityLabel(urlString, { identityLabel });
    } else {
      res = await mod.fetch(urlString);
    }
  }
  if (typeof res === "string") {
    return res;
  }
  if (isGeminiWireBinary(res)) {
    return res;
  }
  throw new Error("Gemini fetch returned an unexpected payload type.");
}

export async function fetchGeminiParsed(
  urlString: string,
  tls?: GeminiFetchTlsIdentity,
): Promise<GeminiParsedResponse> {
  const raw = await geminiFetchRaw(urlString, tls);
  if (typeof raw === "string") {
    return parseGeminiResponseFromWire(raw);
  }
  return {
    statusCode: raw.statusCode,
    meta: raw.meta,
    body: "",
    raw: "",
    bodyBinaryBase64: raw.bodyBase64,
  };
}

export async function geminiFetch(
  url: string,
  init?: GeminiFetchInit,
): Promise<GeminiResponse> {
  const redirect = init?.redirect ?? "follow";
  const input = init?.input ?? "manual";
  const maxRedirects = init?.maxRedirects ?? 8;
  const includeRaw = init?.includeRaw ?? false;
  const tls = init?.tls;

  const requestUrl = url.trim();
  if (!requestUrl.length) {
    throw new Error("URL is required");
  }

  const history: GeminiFetchHistoryItem[] = [];
  let currentUrl = requestUrl;
  let redirected = false;

  for (let i = 0; i <= maxRedirects; i++) {
    const parsed = await fetchGeminiParsed(currentUrl, tls);
    const status = parsed.statusCode;
    const meta = parsed.meta;

    history.push({ url: currentUrl, status, meta });

    if (isRedirectStatus(status)) {
      if (redirect === "error") {
        throw new Error(`Gemini redirect not allowed (${status})`);
      }
      if (redirect === "manual") {
        return buildGeminiResponse({
          requestUrl,
          finalUrl: currentUrl,
          redirected,
          history,
          parsed,
          includeRaw,
          inputPolicy: input,
        });
      }
      const target = resolveRedirectTarget(meta, currentUrl);
      if (!target.length) {
        throw new Error("Gemini redirect missing target URL");
      }
      currentUrl = target;
      redirected = true;
      continue;
    }

    if (isInputStatus(status) && input === "error") {
      throw new Error(`Gemini input requested (${status})`);
    }

    return buildGeminiResponse({
      requestUrl,
      finalUrl: currentUrl,
      redirected,
      history,
      parsed,
      includeRaw,
      inputPolicy: input,
    });
  }

  throw new Error(`Too many redirects (max ${maxRedirects})`);
}

function buildGeminiResponse(args: {
  requestUrl: string;
  finalUrl: string;
  redirected: boolean;
  history: GeminiFetchHistoryItem[];
  parsed: GeminiParsedResponse;
  includeRaw: boolean;
  inputPolicy: "manual" | "error";
}): GeminiResponse {
  const { requestUrl, finalUrl, redirected, history, parsed, includeRaw } = args;
  const status = parsed.statusCode;
  const meta = parsed.meta;
  const body = parsed.body;

  const ok = status >= 20 && status <= 29;
  const mimeType = status === 20 ? successMimeType(meta) : "";
  const isGemtext =
    status === 20 && (mimeType === "text/gemini" || mimeType === "");
  const isBinary = status === 20 && mimeType.length > 0 && mimeType !== "text/gemini";

  const inputPrompt: GeminiInputPrompt | undefined = isInputStatus(status)
    ? {
        sensitive: status === 11,
        prompt: meta.trim(),
        ...(body.trim().length > 0 ? { body } : {}),
      }
    : undefined;

  const raw = includeRaw ? parsed.raw : undefined;

  return {
    url: finalUrl,
    requestUrl,
    redirected,
    history,

    status,
    ok,
    meta,
    statusText: statusTextForGeminiStatus(status),

    mimeType,
    isGemtext,
    isBinary,

    inputPrompt,

    async text() {
      return body;
    },
    async bytes() {
      if (parsed.bodyBinaryBase64?.length) {
        return base64ToUint8Array(parsed.bodyBinaryBase64);
      }
      return new TextEncoder().encode(body);
    },

    ...(raw ? { raw } : {}),
  };
}
