import type { DialogMessage } from "lib/models/dialogMessage";
import { SQLITE_META_MAX_BYTES, newId, utf8ByteLength } from "lib/sqlite/utils";
import { BaseSqliteRepository } from "lib/sqlite/baseRepository";

export class MessageRepository extends BaseSqliteRepository {
  private rowToMessage(r: {
    id: string;
    content_length: number;
    body: string | null;
    blob_id: string | null;
    status: number | null;
    meta: string | null;
    sent_at: string;
    is_outgoing: number;
    request_path: string | null;
  }): DialogMessage {
    const msg: DialogMessage = {
      id: r.id,
      contentLength: r.content_length,
      sentAt: r.sent_at,
      isOutgoing: r.is_outgoing === 1,
      requestPath: r.request_path?.trim() ?? "",
    };
    const bodyText = r.body?.trim();
    if (bodyText) msg.body = bodyText;
    if (r.blob_id) msg.blobId = r.blob_id;
    if (r.status != null) msg.status = r.status;
    const meta = r.meta?.trim();
    if (meta) msg.meta = meta;
    return msg;
  }

  async countForDialog(dialogId: string): Promise<number> {
    const db = await this.db();
    const row = await db.getFirstAsync<{ c: number }>(
      `SELECT COUNT(*) AS c FROM messages WHERE dialog_id = ?`,
      dialogId,
    );
    return row?.c ?? 0;
  }

  async listForDialog(dialogId: string): Promise<DialogMessage[]> {
    const db = await this.db();
    const rows = await db.getAllAsync<{
      id: string;
      content_length: number;
      body: string | null;
      blob_id: string | null;
      status: number | null;
      meta: string | null;
      sent_at: string;
      is_outgoing: number;
      request_path: string | null;
    }>(
      `SELECT id, content_length, body, blob_id, status, meta, sent_at, is_outgoing, request_path FROM messages
       WHERE dialog_id = ? ORDER BY datetime(sent_at) ASC, id ASC`,
      dialogId,
    );
    return rows.map((r) => this.rowToMessage(r));
  }

  /** Last `limit` messages in chronological order (oldest of the window first). */
  async listRecentForDialog(
    dialogId: string,
    limit: number,
  ): Promise<DialogMessage[]> {
    const db = await this.db();
    const rows = await db.getAllAsync<{
      id: string;
      content_length: number;
      body: string | null;
      blob_id: string | null;
      status: number | null;
      meta: string | null;
      sent_at: string;
      is_outgoing: number;
      request_path: string | null;
    }>(
      `SELECT id, content_length, body, blob_id, status, meta, sent_at, is_outgoing, request_path FROM (
         SELECT id, content_length, body, blob_id, status, meta, sent_at, is_outgoing, request_path
         FROM messages
         WHERE dialog_id = ?
         ORDER BY datetime(sent_at) DESC, id DESC
         LIMIT ?
       ) ORDER BY datetime(sent_at) ASC, id ASC`,
      dialogId,
      limit,
    );
    return rows.map((r) => this.rowToMessage(r));
  }

  async listBeforeCursorForDialog(
    dialogId: string,
    cursor: { sentAt: string; id: string },
    limit: number,
  ): Promise<DialogMessage[]> {
    const db = await this.db();
    const rows = await db.getAllAsync<{
      id: string;
      content_length: number;
      body: string | null;
      blob_id: string | null;
      status: number | null;
      meta: string | null;
      sent_at: string;
      is_outgoing: number;
      request_path: string | null;
    }>(
      `SELECT id, content_length, body, blob_id, status, meta, sent_at, is_outgoing, request_path FROM messages
       WHERE dialog_id = ?
         AND (
           datetime(sent_at) < datetime(?)
           OR (sent_at = ? AND id < ?)
         )
       ORDER BY datetime(sent_at) DESC, id DESC
       LIMIT ?`,
      dialogId,
      cursor.sentAt,
      cursor.sentAt,
      cursor.id,
      limit,
    );
    return rows.reverse().map((r) => this.rowToMessage(r));
  }

  async insert(
    dialogId: string,
    message: DialogMessage,
    blobPayload?: Uint8Array | null,
  ): Promise<DialogMessage> {
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

    const db = await this.db();
    await db.withTransactionAsync(async () => {
      if (blobPayload != null && blobPayload.byteLength > 0 && blobId) {
        await db.runAsync(
          `INSERT INTO blobs (id, body) VALUES (?, ?)`,
          blobId,
          blobPayload,
        );
      }
      await db.runAsync(
        `INSERT INTO messages (id, dialog_id, content_length, body, blob_id, status, meta, sent_at, is_outgoing, request_path)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        message.id,
        dialogId,
        contentLengthForRow,
        bodyText,
        blobId,
        message.status ?? null,
        message.meta?.trim() ? message.meta.trim() : null,
        message.sentAt,
        message.isOutgoing ? 1 : 0,
        message.requestPath?.trim() ?? "",
      );
      await db.runAsync(
        `UPDATE dialogs SET message_id = ?, last_message_at = ? WHERE id = ?`,
        message.id,
        message.sentAt,
        dialogId,
      );
    });

    const out: DialogMessage = { ...message, contentLength: contentLengthForRow };
    if (bodyText != null) out.body = bodyText;
    else delete out.body;
    if (blobId != null) out.blobId = blobId;
    else delete out.blobId;
    return out;
  }
}

