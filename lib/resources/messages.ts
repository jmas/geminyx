import type { ThreadMessage } from "lib/models/threadMessage";

export const RESOURCE = "messages" as const;

/** Page size for thread message lists (recent tail + older pages). */
export const MESSAGES_PAGE_SIZE = 10;

export type MessagesPagingMeta =
  | { mode: "recent"; limit: number }
  | {
      mode: "before";
      limit: number;
      /** Oldest currently loaded message; `id` disambiguates equal `sentAt`. */
      cursor: { sentAt: string; id: string };
    };

export type { ThreadMessage } from "lib/models/threadMessage";

export type MessageCreateVariables = {
  thread_id: string;
  id: string;
  sentAt: string;
  isOutgoing: boolean;
  contentLength: number;
  /** Outgoing payload (UTF-8). Response `body` is set when syncing server replies. */
  body?: string;
  /** Existing row in `blobs` (no new insert). Do not use with `blobBodyBase64`. */
  blobId?: string;
  /** New binary payload; stored in `blobs`, message gets a new `blobId`. */
  blobBodyBase64?: string;
  status?: number;
  meta?: string;
  /** Path (+ query) for this Gemini request; see `ThreadMessage.requestPath`. */
  requestPath: string;
};
