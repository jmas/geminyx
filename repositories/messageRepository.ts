import type { ThreadMessage } from "lib/models/threadMessage";
import type { MessageCreateVariables } from "lib/resources/messages";
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
import { getWatermelonDatabase } from "lib/watermelon/database";
import { accountsRepo } from "repositories/accountRepository";
import { threadsRepo } from "repositories/threadRepository";
import { logThreadMessage } from "utils/threadMessageLog";

export class MessageRepository {
  private messages() {
    return getWatermelonDatabase().get<MessageModel>("messages");
  }

  private threads() {
    return getWatermelonDatabase().get<ThreadModel>("threads");
  }

  private blobs() {
    return getWatermelonDatabase().get<AppBlob>("blobs");
  }

  private modelToMessage(m: MessageModel): ThreadMessage {
    const msg: ThreadMessage = {
      id: m.id,
      contentLength: m.contentLength,
      sentAt: m.sentAt,
      isOutgoing: m.isOutgoing,
      requestPath: m.requestPath?.trim() ?? "",
    };
    const bodyText = m.body?.trim();
    if (bodyText) msg.body = bodyText;
    if (m.blobId) msg.blobId = m.blobId;
    if (m.status != null) msg.status = m.status;
    const meta = m.meta?.trim();
    if (meta) msg.meta = meta;
    return msg;
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
    return rows.map((r) => this.modelToMessage(r));
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
    return rows.reverse().map((r) => this.modelToMessage(r));
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
    return rows.reverse().map((r) => this.modelToMessage(r));
  }

  async insert(
    threadId: string,
    message: ThreadMessage,
    blobPayload?: Uint8Array | null,
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
      bodyText != null && bodyText.length > 0
        ? utf8ByteLength(bodyText)
        : message.contentLength;

    const db = getWatermelonDatabase();
    await db.write(async () => {
      if (blobPayload != null && blobPayload.byteLength > 0 && blobId) {
        const b64 = uint8ArrayToBase64(blobPayload);
        await this.blobs().create((rec) => {
          rec._raw.id = blobId!;
          rec.bodyBase64 = b64;
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
    const saved = await this.insert(v.thread_id, message, blobPayload);
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
