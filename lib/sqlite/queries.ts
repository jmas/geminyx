import type { Account } from "lib/models/account";
import type { Capsule } from "lib/models/capsule";
import type { Dialog } from "lib/models/dialog";
import type { DialogMessage } from "lib/models/dialogMessage";
import { getDatabase } from "lib/sqlite/setup";

const META_MAX_BYTES = 1024;

function utf8ByteLength(s: string): number {
  return new TextEncoder().encode(s).length;
}

function normalizeBlob(value: unknown): Uint8Array | null {
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

function newCapsuleId(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `cap-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function newBlobId(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return `blob-${c.randomUUID()}`;
  return `blob-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function rowToCapsule(r: {
  id: string;
  name: string;
  avatar_url: string | null;
  url: string | null;
  description: string | null;
}): Capsule {
  return {
    id: r.id,
    name: r.name,
    avatarUrl: r.avatar_url ?? undefined,
    url: r.url ?? undefined,
    description: r.description?.trim() ? r.description.trim() : undefined,
  };
}

export async function fetchCapsules(): Promise<Capsule[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    id: string;
    name: string;
    avatar_url: string | null;
    url: string | null;
    description: string | null;
  }>(
    `SELECT id, name, avatar_url, url, description FROM capsules ORDER BY name COLLATE NOCASE ASC`,
  );
  return rows.map(rowToCapsule);
}

export async function fetchCapsule(
  capsuleId: string,
): Promise<Capsule | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{
    id: string;
    name: string;
    avatar_url: string | null;
    url: string | null;
    description: string | null;
  }>(
    `SELECT id, name, avatar_url, url, description FROM capsules WHERE id = ?`,
    capsuleId,
  );
  if (!row) return null;
  return rowToCapsule(row);
}

/** Inserts a capsule and its dialog row (same id for both, matching existing schema). */
/** Removes the capsule and, via FK CASCADE, its dialog and all messages. */
export async function deleteCapsuleCascade(capsuleId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`DELETE FROM capsules WHERE id = ?`, capsuleId);
}

export async function insertCapsuleWithDialog(input: {
  name: string;
  avatarUrl?: string;
  url?: string;
  description?: string;
  id?: string;
}): Promise<Capsule> {
  const id = input.id ?? newCapsuleId();
  const name = input.name.trim();
  const avatarUrl = input.avatarUrl?.trim();
  const url = input.url?.trim();
  const description = input.description?.trim();
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO capsules (id, name, avatar_url, url, description) VALUES (?, ?, ?, ?, ?)`,
      id,
      name,
      avatarUrl ? avatarUrl : null,
      url ? url : null,
      description ? description : null,
    );
    await db.runAsync(
      `INSERT INTO dialogs (id, capsule_id, message_id, last_message_at) VALUES (?, ?, NULL, ?)`,
      id,
      id,
      new Date(0).toISOString(),
    );
  });
  const row = await fetchCapsule(id);
  if (!row) {
    throw new Error("insertCapsuleWithDialog: row missing after insert");
  }
  return row;
}

export async function fetchDialogs(): Promise<Dialog[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    dialog_id: string;
    last_message_at: string;
    capsule_id: string;
    name: string;
    avatar_url: string | null;
    url: string | null;
    description: string | null;
  }>(
    `SELECT
       d.id AS dialog_id,
       d.last_message_at,
       c.id AS capsule_id,
       c.name,
       c.avatar_url,
       c.url,
       c.description
     FROM dialogs d
     INNER JOIN capsules c ON c.id = d.capsule_id
     ORDER BY datetime(d.last_message_at) DESC`,
  );
  return rows.map((r) => ({
    id: r.dialog_id,
    lastMessageAt: r.last_message_at,
    capsule: rowToCapsule({
      id: r.capsule_id,
      name: r.name,
      avatar_url: r.avatar_url,
      url: r.url,
      description: r.description,
    }),
  }));
}

export async function fetchDialog(dialogId: string): Promise<Dialog | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{
    dialog_id: string;
    last_message_at: string;
    capsule_id: string;
    name: string;
    avatar_url: string | null;
    url: string | null;
    description: string | null;
  }>(
    `SELECT
       d.id AS dialog_id,
       d.last_message_at,
       c.id AS capsule_id,
       c.name,
       c.avatar_url,
       c.url,
       c.description
     FROM dialogs d
     INNER JOIN capsules c ON c.id = d.capsule_id
     WHERE d.id = ?`,
    dialogId,
  );
  if (!row) return null;
  return {
    id: row.dialog_id,
    lastMessageAt: row.last_message_at,
    capsule: rowToCapsule({
      id: row.capsule_id,
      name: row.name,
      avatar_url: row.avatar_url,
      url: row.url,
      description: row.description,
    }),
  };
}

function rowToMessage(r: {
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

/** Loads raw bytes from `blobs` (e.g. attachment payloads). */
export async function fetchBlobBody(blobId: string): Promise<Uint8Array | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ body: unknown }>(
    `SELECT body FROM blobs WHERE id = ?`,
    blobId,
  );
  return normalizeBlob(row?.body ?? null);
}

export async function countMessagesForDialog(dialogId: string): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ c: number }>(
    `SELECT COUNT(*) AS c FROM messages WHERE dialog_id = ?`,
    dialogId,
  );
  return row?.c ?? 0;
}

/** Last `limit` messages in chronological order (oldest of the window first). */
export async function fetchMessagesRecent(
  dialogId: string,
  limit: number,
): Promise<DialogMessage[]> {
  const db = await getDatabase();
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
  return rows.map(rowToMessage);
}

/**
 * Up to `limit` messages strictly older than the cursor (chronological order).
 * `id` breaks ties when several rows share the same `sentAt` (same ordering as list queries).
 */
export async function fetchMessagesBeforeCursor(
  dialogId: string,
  cursor: { sentAt: string; id: string },
  limit: number,
): Promise<DialogMessage[]> {
  const db = await getDatabase();
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
  return rows.reverse().map(rowToMessage);
}

export async function fetchMessages(
  dialogId: string,
): Promise<DialogMessage[]> {
  const db = await getDatabase();
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
  return rows.map(rowToMessage);
}

function rowToAccount(r: {
  id: string;
  name: string;
  email: string | null;
  avatar_url: string | null;
  capsule_url: string | null;
  is_active: number;
}): Account {
  return {
    id: r.id,
    name: r.name,
    email: r.email?.trim() ? r.email.trim() : undefined,
    avatarUrl: r.avatar_url ?? undefined,
    capsuleUrl: r.capsule_url ?? undefined,
    isActive: r.is_active === 1,
  };
}

export async function fetchAccounts(options?: {
  activeOnly?: boolean;
}): Promise<Account[]> {
  const db = await getDatabase();
  const activeOnly = options?.activeOnly;
  const where =
    activeOnly === true
      ? "WHERE is_active = 1"
      : activeOnly === false
        ? "WHERE is_active = 0"
        : "";
  const rows = await db.getAllAsync<{
    id: string;
    name: string;
    email: string | null;
    avatar_url: string | null;
    capsule_url: string | null;
    is_active: number;
  }>(
    `SELECT id, name, email, avatar_url, capsule_url, is_active FROM accounts ${where} ORDER BY name COLLATE NOCASE ASC`,
  );
  return rows.map(rowToAccount);
}

export async function fetchAccount(accountId: string): Promise<Account | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{
    id: string;
    name: string;
    email: string | null;
    avatar_url: string | null;
    capsule_url: string | null;
    is_active: number;
  }>(
    `SELECT id, name, email, avatar_url, capsule_url, is_active FROM accounts WHERE id = ?`,
    accountId,
  );
  if (!row) return null;
  return rowToAccount(row);
}

/** The account marked active for this app session (at most one). */
export async function fetchActiveAccount(): Promise<Account | null> {
  const rows = await fetchAccounts({ activeOnly: true });
  return rows[0] ?? null;
}

export async function patchAccount(
  accountId: string,
  patch: Partial<
    Pick<Account, "name" | "email" | "avatarUrl" | "capsuleUrl" | "isActive">
  >,
): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    if (patch.isActive === true) {
      await db.runAsync(`UPDATE accounts SET is_active = 0`);
    }

    const sets: string[] = [];
    const values: (string | number | null)[] = [];

    if (patch.name !== undefined) {
      sets.push("name = ?");
      values.push(patch.name);
    }
    if (patch.email !== undefined) {
      sets.push("email = ?");
      values.push(patch.email?.trim() ? patch.email.trim() : null);
    }
    if (patch.avatarUrl !== undefined) {
      sets.push("avatar_url = ?");
      values.push(patch.avatarUrl ?? null);
    }
    if (patch.capsuleUrl !== undefined) {
      sets.push("capsule_url = ?");
      values.push(patch.capsuleUrl ?? null);
    }
    if (patch.isActive !== undefined) {
      sets.push("is_active = ?");
      values.push(patch.isActive ? 1 : 0);
    }

    if (sets.length === 0) return;

    values.push(accountId);
    await db.runAsync(
      `UPDATE accounts SET ${sets.join(", ")} WHERE id = ?`,
      ...values,
    );
  });
}

export async function insertMessage(
  dialogId: string,
  message: DialogMessage,
  blobPayload?: Uint8Array | null,
): Promise<DialogMessage> {
  if (message.meta !== undefined && utf8ByteLength(message.meta) > META_MAX_BYTES) {
    throw new Error(`meta exceeds ${META_MAX_BYTES} bytes`);
  }
  let bodyText: string | null =
    message.body != null && message.body.trim().length > 0
      ? message.body.trim()
      : null;

  let blobId: string | null = null;
  if (blobPayload != null && blobPayload.byteLength > 0) {
    blobId = newBlobId();
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

  const db = await getDatabase();
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

  const out: DialogMessage = {
    ...message,
    contentLength: contentLengthForRow,
  };
  if (bodyText != null) out.body = bodyText;
  else delete out.body;
  if (blobId != null) out.blobId = blobId;
  else delete out.blobId;
  return out;
}
