import type { ThreadMessage } from "lib/models/threadMessage";
import {
  SQLITE_META_MAX_BYTES,
  base64ToUint8Array,
  newId,
  utf8ByteLength,
  uint8ArrayToBase64,
} from "lib/db/utils";
import { AppBlob } from "lib/watermelon/models/Blob";
import { Message as MessageModel } from "lib/watermelon/models/Message";
import { Thread as ThreadModel } from "lib/watermelon/models/Thread";
import { Q } from "@nozbe/watermelondb";
import { BaseRepository } from "repositories/baseRepository";
import { accountsRepo } from "repositories/accountRepository";
import { threadsRepo } from "repositories/threadRepository";
import { logThreadMessage } from "utils/threadMessageLog";

/** Page size for thread message lists (recent tail + older pages). */
export const MESSAGES_PAGE_SIZE = 10;

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
  /** Stored on the `blobs` row with the payload (Gemini success MIME). */
  blobMimeType?: string;
  /** Last path segment of the resource URL (e.g. Gemini fetch URL). */
  blobFileName?: string;
  status?: number;
  meta?: string;
  /** Path (+ query) for this Gemini request; see `ThreadMessage.requestPath`. */
  requestPath: string;
};

export class MessageRepository extends BaseRepository {
  private messages() {
    return this.db().get<MessageModel>("messages");
  }

  private threads() {
    return this.db().get<ThreadModel>("threads");
  }

  private blobs() {
    return this.db().get<AppBlob>("blobs");
  }

  private modelToMessage(
    m: MessageModel,
    blobMap?: Map<string, AppBlob>,
  ): ThreadMessage {
    const msg: ThreadMessage = {
      id: m.id,
      contentLength: m.contentLength,
      sentAt: m.sentAt,
      isOutgoing: m.isOutgoing,
      requestPath: m.requestPath?.trim() ?? "",
    };
    const bodyText = m.body?.trim();
    if (bodyText) msg.body = bodyText;
    if (m.blobId) {
      msg.blobId = m.blobId;
      const b = blobMap?.get(m.blobId);
      const mt = b?.mimeType?.trim();
      if (mt) msg.blobMimeType = mt;
      if (b?.contentLength != null) {
        msg.blobContentLength = b.contentLength;
      }
      const fn = b?.fileName?.trim();
      if (fn) msg.blobFileName = fn;
    }
    if (m.status != null) msg.status = m.status;
    const meta = m.meta?.trim();
    if (meta) msg.meta = meta;
    return msg;
  }

  private async messagesWithBlobMeta(
    rows: MessageModel[],
  ): Promise<ThreadMessage[]> {
    const ids = [
      ...new Set(
        rows.map((r) => r.blobId).filter((id): id is string => Boolean(id)),
      ),
    ];
    let blobMap = new Map<string, AppBlob>();
    if (ids.length > 0) {
      const blobRows = await this.blobs()
        .query(Q.where("id", Q.oneOf(ids)))
        .fetch();
      blobMap = new Map(blobRows.map((b) => [b.id, b]));
    }
    return rows.map((r) => this.modelToMessage(r, blobMap));
  }

  async countForThread(threadId: string): Promise<number> {
    return this.messages()
      .query(Q.where("thread_id", threadId))
      .fetchCount();
  }

  async listForThread(threadId: string): Promise<ThreadMessage[]> {
    const rows = await this.messages()
      .query(
        Q.where("thread_id", threadId),
        Q.sortBy("sent_at", "asc"),
        Q.sortBy("id", "asc"),
      )
      .fetch();
    return this.messagesWithBlobMeta(rows);
  }

  async listRecentForThread(
    threadId: string,
    limit: number,
  ): Promise<ThreadMessage[]> {
    const rows = await this.messages()
      .query(
        Q.where("thread_id", threadId),
        Q.sortBy("sent_at", "desc"),
        Q.sortBy("id", "desc"),
        Q.take(limit),
      )
      .fetch();
    const ordered = rows.reverse();
    return this.messagesWithBlobMeta(ordered);
  }

  /**
   * Messages that reference a `blobs` row, newest first (by `sent_at`, then `id`).
   * Thread id matches capsule id for capsule conversations.
   */
  async listBlobMessagesForThreadDesc(
    threadId: string,
  ): Promise<ThreadMessage[]> {
    const rows = await this.messages()
      .query(
        Q.where("thread_id", threadId),
        Q.where("blob_id", Q.notEq(null)),
        Q.sortBy("sent_at", "desc"),
        Q.sortBy("id", "desc"),
      )
      .fetch();
    return this.messagesWithBlobMeta(rows);
  }

  async listBeforeCursorForThread(
    threadId: string,
    cursor: { sentAt: string; id: string },
    limit: number,
  ): Promise<ThreadMessage[]> {
    const rows = await this.messages()
      .query(
        Q.where("thread_id", threadId),
        Q.or(
          Q.where("sent_at", Q.lt(cursor.sentAt)),
          Q.and(
            Q.where("sent_at", cursor.sentAt),
            Q.where("id", Q.lt(cursor.id)),
          ),
        ),
        Q.sortBy("sent_at", "desc"),
        Q.sortBy("id", "desc"),
        Q.take(limit),
      )
      .fetch();
    const ordered = rows.reverse();
    return this.messagesWithBlobMeta(ordered);
  }

  async insert(
    threadId: string,
    message: ThreadMessage,
    blobPayload?: Uint8Array | null,
    blobMime?: string | null,
    blobFileName?: string | null,
  ): Promise<ThreadMessage> {
    if (
      message.meta !== undefined &&
      utf8ByteLength(message.meta) > SQLITE_META_MAX_BYTES
    ) {
      throw new Error(`meta exceeds ${SQLITE_META_MAX_BYTES} bytes`);
    }

    let bodyText: string | null =
      message.body != null && message.body.trim().length > 0
        ? message.body.trim()
        : null;

    let blobId: string | null = null;
    if (blobPayload != null && blobPayload.byteLength > 0) {
      blobId = newId("blob");
    } else if (message.blobId) {
      blobId = message.blobId;
    }

    if (
      blobPayload != null &&
      blobPayload.byteLength > 0 &&
      blobId &&
      (bodyText == null || bodyText.length === 0)
    ) {
      bodyText = `[blob: ${blobId}]`;
    }

    const contentLengthForRow =
      blobPayload != null && blobPayload.byteLength > 0
        ? blobPayload.byteLength
        : bodyText != null && bodyText.length > 0
          ? utf8ByteLength(bodyText)
          : message.contentLength;

    const db = this.db();
    await db.write(async () => {
      if (blobPayload != null && blobPayload.byteLength > 0 && blobId) {
        const b64 = uint8ArrayToBase64(blobPayload);
        await this.blobs().create((rec) => {
          rec._raw.id = blobId!;
          rec.bodyBase64 = b64;
          rec.messageId = message.id;
          rec.mimeType = blobMime?.trim() ? blobMime.trim() : undefined;
          rec.contentLength = blobPayload.byteLength;
          rec.fileName = blobFileName?.trim() ? blobFileName.trim() : undefined;
        });
      }
      await this.messages().create((rec) => {
        rec._raw.id = message.id;
        rec.threadId = threadId;
        rec.contentLength = contentLengthForRow;
        rec.body = bodyText ?? undefined;
        rec.blobId = blobId ?? undefined;
        rec.status = message.status ?? undefined;
        rec.meta = message.meta?.trim() ? message.meta.trim() : undefined;
        rec.sentAt = message.sentAt;
        rec.isOutgoing = message.isOutgoing;
        rec.requestPath = message.requestPath?.trim() ?? "";
      });
      const th = await this.threads().find(threadId);
      await th.update((d) => {
        d.messageId = message.id;
        d.lastMessageAt = message.sentAt;
      });
    });

    const out: ThreadMessage = { ...message, contentLength: contentLengthForRow };
    if (bodyText != null) out.body = bodyText;
    else delete out.body;
    if (blobId != null) out.blobId = blobId;
    else delete out.blobId;
    if (blobPayload != null && blobPayload.byteLength > 0) {
      out.blobContentLength = blobPayload.byteLength;
      const mt = blobMime?.trim();
      if (mt) out.blobMimeType = mt;
      const fn = blobFileName?.trim();
      if (fn) out.blobFileName = fn;
    }
    return out;
  }

  async createFromVariables(v: MessageCreateVariables): Promise<ThreadMessage> {
    const accountId = (await accountsRepo.getActive())?.id;
    if (!accountId) {
      throw { message: "No active account", statusCode: 400 };
    }
    const d = await threadsRepo.getByIdForAccount(accountId, v.thread_id);
    if (!d) {
      throw { message: "Thread not found", statusCode: 404 };
    }

    logThreadMessage("sqlite.message.create.begin", {
      threadId: v.thread_id,
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
    const message: ThreadMessage = {
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
    const saved = await this.insert(
      v.thread_id,
      message,
      blobPayload,
      v.blobMimeType?.trim() ? v.blobMimeType.trim() : null,
      v.blobFileName?.trim() ? v.blobFileName.trim() : null,
    );
    logThreadMessage("sqlite.message.create.done", {
      threadId: v.thread_id,
      id: saved.id,
      isOutgoing: saved.isOutgoing,
      sentAt: saved.sentAt,
      contentLength: saved.contentLength,
      hasBody: saved.body != null && saved.body.length > 0,
      status: saved.status,
      blobId: saved.blobId,
    });
    return saved;
  }
}
