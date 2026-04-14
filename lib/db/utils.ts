export const SQLITE_META_MAX_BYTES = 1024;

export function utf8ByteLength(s: string): number {
  return new TextEncoder().encode(s).length;
}

export function normalizeStoredBlob(value: unknown): Uint8Array | null {
  if (value == null) return null;
  if (value instanceof Uint8Array) return value.byteLength > 0 ? value : null;
  if (value instanceof ArrayBuffer) {
    const u = new Uint8Array(value);
    return u.byteLength > 0 ? u : null;
  }
  if (Array.isArray(value)) {
    const u = Uint8Array.from(value as number[]);
    return u.byteLength > 0 ? u : null;
  }
  return null;
}

export function newId(prefix: string): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return `${prefix}-${c.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

export function base64ToUint8Array(b64: string): Uint8Array {
  const binary = atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
