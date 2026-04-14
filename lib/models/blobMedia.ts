export type BlobMediaKind = "image" | "audio" | "video" | "other";

/** Short UI label for attachment kind (English). */
export function attachmentKindLabel(kind: BlobMediaKind): string {
  switch (kind) {
    case "image":
      return "Image";
    case "audio":
      return "Audio";
    case "video":
      return "Video";
    default:
      return "File";
  }
}

export function blobMediaKind(mime: string): BlobMediaKind {
  const m = mime.trim().toLowerCase();
  if (m.startsWith("image/")) return "image";
  if (m.startsWith("audio/")) return "audio";
  if (m.startsWith("video/")) return "video";
  return "other";
}

/** Filename extension for cached / shared files (best-effort). */
export function extensionForBlobMime(mime: string): string {
  const m = mime.trim().toLowerCase();
  const table: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/svg+xml": "svg",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/ogg": "ogg",
    "audio/wav": "wav",
    "audio/webm": "webm",
    "audio/mp4": "m4a",
    "audio/aac": "aac",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
    "application/pdf": "pdf",
    "application/octet-stream": "bin",
  };
  if (table[m]) return table[m]!;
  const slash = m.indexOf("/");
  if (slash >= 0 && slash < m.length - 1) {
    const sub = m.slice(slash + 1).replace(/[^a-z0-9]/gi, "");
    if (sub.length > 0 && sub.length <= 8) return sub;
  }
  return "bin";
}
