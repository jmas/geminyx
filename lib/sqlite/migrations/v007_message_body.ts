import type { SQLiteDatabase } from "expo-sqlite";
import type { SqliteMigration } from "./types";

export const migrationV007: SqliteMigration = {
  version: 7,
  async up(db: SQLiteDatabase) {
    await db.execAsync("PRAGMA foreign_keys = OFF;");
    await db.withTransactionAsync(async () => {
      await db.execAsync(`DROP TABLE IF EXISTS messages_v7`);
      await db.execAsync(`
        CREATE TABLE messages_v7 (
          id TEXT PRIMARY KEY NOT NULL,
          dialog_id TEXT NOT NULL,
          content_length INTEGER NOT NULL CHECK (content_length >= 0),
          body BLOB,
          status INTEGER,
          meta TEXT,
          sent_at TEXT NOT NULL,
          is_outgoing INTEGER NOT NULL CHECK (is_outgoing IN (0, 1)),
          FOREIGN KEY (dialog_id) REFERENCES dialogs (id) ON DELETE CASCADE
        );
      `);
      await db.execAsync(`
        INSERT INTO messages_v7 (
          id, dialog_id, content_length, body, status, meta, sent_at, is_outgoing
        )
        SELECT
          id,
          dialog_id,
          length(cast(text AS blob)),
          CASE
            WHEN text IS NOT NULL AND length(cast(text AS blob)) > 0
            THEN cast(text AS blob)
            ELSE NULL
          END,
          NULL,
          NULL,
          sent_at,
          is_outgoing
        FROM messages;
      `);
      await db.execAsync(`DROP TABLE messages`);
      await db.execAsync(`ALTER TABLE messages_v7 RENAME TO messages`);
      await db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_messages_dialog_sent
          ON messages (dialog_id, sent_at);
      `);
    });
    await db.execAsync("PRAGMA foreign_keys = ON;");
  },
};
