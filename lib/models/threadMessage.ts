export type ThreadMessage = {
  id: string;
  contentLength: number;
  /** ISO 8601 */
  sentAt: string;
  isOutgoing: boolean;
  /**
   * Path (+ query + hash) of the Gemini URL used for this turn, relative to the
   * same origin as the capsule URL, or a full `gemini://…` URL when the request
   * targeted another host. Empty string means the capsule root URL only.
   */
  requestPath: string;
  /**
   * Optional response fields (e.g. from a capsule/server). Omitted when creating
   * outgoing messages from the composer; may be filled when loading replies.
   */
  status?: number;
  /** UTF-8 string; max 1024 bytes when set. */
  meta?: string;
  /** UTF-8 text; omit when empty or when payload is only in `blobs` via `blobId`. */
  body?: string;
  /** When set, large/binary payload lives in `blobs` (optional FK). */
  blobId?: string;
  /** From `blobs.mime_type` when `blobId` is set (for attachment UI). */
  blobMimeType?: string;
  /** Raw byte length from `blobs.content_length` (or message row for legacy rows). */
  blobContentLength?: number;
  /** Original filename from URL/path when stored on the `blobs` row. */
  blobFileName?: string;
};
