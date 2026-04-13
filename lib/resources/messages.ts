import type {
  BaseRecord,
  CreateParams,
  CrudFilter,
  GetListParams,
} from "@refinedev/core";
import type { DialogMessage } from "lib/models/dialogMessage";
import type { SqliteResourceAdapter } from "lib/sqlite/resourceAdapterTypes";
import {
  countMessagesForDialog,
  fetchMessages,
  fetchMessagesBeforeCursor,
  fetchMessagesRecent,
  insertMessage,
} from "lib/sqlite/queries";
import { logDialogMessage } from "utils/dialogMessageLog";

export const RESOURCE = "messages" as const;

/** Page size for dialog message lists (recent tail + older pages). */
export const MESSAGES_PAGE_SIZE = 10;

export type MessagesPagingMeta =
  | { mode: "recent"; limit: number }
  | {
      mode: "before";
      limit: number;
      /** Oldest currently loaded message; `id` disambiguates equal `sentAt`. */
      cursor: { sentAt: string; id: string };
    };

export type { DialogMessage } from "lib/models/dialogMessage";

function demoMessage(
  id: string,
  body: string,
  sentAt: string,
  isOutgoing: boolean,
  response?: Pick<DialogMessage, "status" | "meta">,
): DialogMessage {
  return {
    id,
    body,
    contentLength: new TextEncoder().encode(body).length,
    sentAt,
    isOutgoing,
    requestPath: "",
    ...response,
  };
}

function eqFilterValue(
  filters: CrudFilter[] | undefined,
  field: string,
): string | undefined {
  if (!filters?.length) return undefined;
  for (const f of filters) {
    if ("field" in f && f.field === field && f.operator === "eq") {
      const v = f.value;
      if (Array.isArray(v)) {
        return v[0] != null ? String(v[0]) : undefined;
      }
      return v != null ? String(v) : undefined;
    }
  }
  return undefined;
}

export type MessageCreateVariables = {
  dialog_id: string;
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
  /** Path (+ query) for this Gemini request; see `DialogMessage.requestPath`. */
  requestPath: string;
};

function base64ToUint8Array(b64: string): Uint8Array {
  const binary = atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export const sqliteAdapter: SqliteResourceAdapter = {
  async getList<TData extends BaseRecord>({
    filters,
    meta,
  }: GetListParams) {
    const dialogId = eqFilterValue(filters, "dialog_id");
    if (!dialogId) {
      return { data: [], total: 0 };
    }
    const paging = (
      meta as { messagesPaging?: MessagesPagingMeta } | undefined
    )?.messagesPaging;
    if (paging) {
      const total = await countMessagesForDialog(dialogId);
      if (paging.mode === "recent") {
        const rows = await fetchMessagesRecent(dialogId, paging.limit);
        return {
          data: rows as unknown as TData[],
          total,
        };
      }
      const rows = await fetchMessagesBeforeCursor(
        dialogId,
        paging.cursor,
        paging.limit,
      );
      return {
        data: rows as unknown as TData[],
        total,
      };
    }
    const rows = await fetchMessages(dialogId);
    return {
      data: rows as unknown as TData[],
      total: rows.length,
    };
  },
  async create<TData extends BaseRecord, TVariables = unknown>({
    variables,
  }: CreateParams<TVariables>) {
    const v = variables as MessageCreateVariables;
    logDialogMessage("sqlite.message.create.begin", {
      dialogId: v.dialog_id,
      id: v.id,
      isOutgoing: v.isOutgoing,
      sentAt: v.sentAt,
      contentLength: v.contentLength,
      hasBody: v.body != null && v.body.length > 0,
      bodyChars: v.body?.length ?? 0,
      status: v.status,
      metaLen: v.meta?.length ?? 0,
      hasBlobId: Boolean(v.blobId),
      hasBlobBodyBase64: Boolean(v.blobBodyBase64?.length),
      requestPathLen: v.requestPath?.length ?? 0,
    });
    const message: DialogMessage = {
      id: v.id,
      contentLength: v.contentLength,
      sentAt: v.sentAt,
      isOutgoing: v.isOutgoing,
      requestPath: v.requestPath?.trim() ?? "",
      ...(v.body !== undefined && v.body.length > 0 ? { body: v.body } : {}),
      ...(v.blobId ? { blobId: v.blobId } : {}),
      ...(v.status !== undefined ? { status: v.status } : {}),
      ...(v.meta !== undefined && v.meta.trim().length > 0
        ? { meta: v.meta.trim() }
        : {}),
    };
    const blobPayload =
      v.blobBodyBase64 != null && v.blobBodyBase64.length > 0
        ? base64ToUint8Array(v.blobBodyBase64)
        : undefined;
    const saved = await insertMessage(v.dialog_id, message, blobPayload);
    logDialogMessage("sqlite.message.create.done", {
      dialogId: v.dialog_id,
      id: saved.id,
      isOutgoing: saved.isOutgoing,
      sentAt: saved.sentAt,
      contentLength: saved.contentLength,
      hasBody: saved.body != null && saved.body.length > 0,
      status: saved.status,
      blobId: saved.blobId,
    });
    return { data: saved as unknown as TData };
  },
};

const baseTime = Date.now();

function at(minutesAgo: number): string {
  return new Date(baseTime - minutesAgo * 60_000).toISOString();
}

const BY_CAPSULE: Record<string, DialogMessage[]> = {
  "1": [
    demoMessage("1-1", "Hey! Are we still on for later?", at(120), false),
    demoMessage("1-2", "Yes — 7 works for me.", at(118), true),
    demoMessage("1-3", "Perfect. I’ll send the address in a bit.", at(115), false),
    demoMessage("1-4", "Thanks!", at(114), true),
    demoMessage("1-5", "No worries. See you then 👋", at(2), false),
  ],
  "2": [
    demoMessage("2-1", "Did you get a chance to review the doc?", at(400), true),
    demoMessage("2-2", "Yep, left a few comments. Mostly small tweaks.", at(395), false),
    demoMessage("2-3", "Amazing, I’ll go through them tonight.", at(390), true),
  ],
  "3": [
    demoMessage("3-1", "Coffee tomorrow?", at(2000), false),
    demoMessage("3-2", "Sure — same place as last time?", at(1990), true),
    demoMessage("3-3", "Works for me. 9:30?", at(1985), false),
    demoMessage("3-4", "Locked in.", at(1980), true),
  ],
  "4": [
    demoMessage("4-1", "Happy birthday 🎂", at(5000), true),
    demoMessage("4-2", "Thank you!! That really made my day.", at(4990), false),
  ],
  "5": [
    demoMessage("5-1", "Long time no chat — how have you been?", at(8000), false),
    demoMessage(
      "5-2",
      "Busy but good! We should catch up properly soon.",
      at(7995),
      true,
    ),
  ],
};

/** Same as in-memory demo map; used to seed SQLite on first app launch. */
export const demoDialogMessagesByCapsule: Record<string, DialogMessage[]> =
  BY_CAPSULE;
