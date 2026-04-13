import type { SQLiteDatabase } from "expo-sqlite";
import type { SqliteMigration } from "./types";

export const migrationV008: SqliteMigration = {
  version: 8,
  async up(db: SQLiteDatabase) {
    await db.execAsync("PRAGMA foreign_keys = OFF;");
    await db.withTransactionAsync(async () => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS blobs (
          id TEXT PRIMARY KEY NOT NULL,
          body BLOB NOT NULL
        );
      `);

      await db.execAsync(`DROP TABLE IF EXISTS messages_v8`);
      await db.execAsync(`
        CREATE TABLE messages_v8 (
          id TEXT PRIMARY KEY NOT NULL,
          dialog_id TEXT NOT NULL,
          content_length INTEGER NOT NULL CHECK (content_length >= 0),
          body TEXT,
          blob_id TEXT,
          status INTEGER,
          meta TEXT,
          sent_at TEXT NOT NULL,
          is_outgoing INTEGER NOT NULL CHECK (is_outgoing IN (0, 1)),
          FOREIGN KEY (dialog_id) REFERENCES dialogs (id) ON DELETE CASCADE,
          FOREIGN KEY (blob_id) REFERENCES blobs (id) ON DELETE SET NULL
        );
      `);

      await db.execAsync(`
        INSERT INTO messages_v8 (
          id, dialog_id, content_length, body, blob_id, status, meta, sent_at, is_outgoing
        )
        SELECT
          id,
          dialog_id,
          content_length,
          CASE
            WHEN body IS NULL OR length(body) = 0 THEN NULL
            ELSE cast(body AS TEXT)
          END,
          NULL,
          status,
          meta,
          sent_at,
          is_outgoing
        FROM messages;
      `);

      await db.execAsync(`DROP TABLE messages`);
      await db.execAsync(`ALTER TABLE messages_v8 RENAME TO messages`);
      await db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_messages_dialog_sent
          ON messages (dialog_id, sent_at);
      `);

      await db.execAsync(`
        CREATE TRIGGER IF NOT EXISTS messages_after_delete_cleanup_blob
        AFTER DELETE ON messages
        FOR EACH ROW
        WHEN OLD.blob_id IS NOT NULL
        BEGIN
          DELETE FROM blobs
          WHERE id = OLD.blob_id
            AND NOT EXISTS (
              SELECT 1 FROM messages WHERE blob_id = OLD.blob_id
            );
        END;
      `);
    });
    await db.execAsync("PRAGMA foreign_keys = ON;");
  },
};
