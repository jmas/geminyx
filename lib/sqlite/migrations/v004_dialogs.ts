import type { SQLiteDatabase } from "expo-sqlite";
import { tableColumnSet } from "./helpers";
import type { SqliteMigration } from "./types";

export const migrationV004: SqliteMigration = {
  version: 4,
  async up(db: SQLiteDatabase) {
    await db.execAsync("PRAGMA foreign_keys = OFF;");
    await db.withTransactionAsync(async () => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS dialogs (
          id TEXT PRIMARY KEY NOT NULL,
          capsule_id TEXT NOT NULL UNIQUE,
          message_id TEXT,
          last_message_at TEXT NOT NULL,
          FOREIGN KEY (capsule_id) REFERENCES capsules (id) ON DELETE CASCADE,
          FOREIGN KEY (message_id) REFERENCES messages (id) ON DELETE SET NULL
        );
      `);

      let capCols = await tableColumnSet(db, "capsules");
      let msgCols = await tableColumnSet(db, "messages");

      if (capCols.has("last_message_at")) {
        const capRows = await db.getAllAsync<{
          id: string;
          last_message_at: string;
        }>("SELECT id, last_message_at FROM capsules");
        for (const c of capRows) {
          const dupe = await db.getFirstAsync<{ one: number }>(
            "SELECT 1 AS one FROM dialogs WHERE id = ?",
            c.id,
          );
          if (!dupe) {
            await db.runAsync(
              `INSERT INTO dialogs (id, capsule_id, message_id, last_message_at)
               VALUES (?, ?, NULL, ?)`,
              c.id,
              c.id,
              c.last_message_at,
            );
          }
        }
      } else {
        const capRows = await db.getAllAsync<{ id: string }>(
          "SELECT id FROM capsules",
        );
        for (const c of capRows) {
          const dupe = await db.getFirstAsync<{ one: number }>(
            "SELECT 1 AS one FROM dialogs WHERE id = ?",
            c.id,
          );
          if (!dupe) {
            await db.runAsync(
              `INSERT INTO dialogs (id, capsule_id, message_id, last_message_at)
               VALUES (?, ?, NULL, ?)`,
              c.id,
              c.id,
              new Date(0).toISOString(),
            );
          }
        }
      }

      msgCols = await tableColumnSet(db, "messages");
      if (!msgCols.has("dialog_id")) {
        await db.execAsync(
          "ALTER TABLE messages ADD COLUMN dialog_id TEXT REFERENCES dialogs (id) ON DELETE CASCADE",
        );
        msgCols = await tableColumnSet(db, "messages");
      }

      if (msgCols.has("capsule_id")) {
        await db.execAsync(`
          UPDATE messages SET dialog_id = (
            SELECT d.id FROM dialogs d WHERE d.capsule_id = messages.capsule_id
          );
        `);

        await db.execAsync(`
          UPDATE dialogs SET
            message_id = (
              SELECT m.id FROM messages m
              WHERE m.dialog_id = dialogs.id
              ORDER BY datetime(m.sent_at) DESC LIMIT 1
            ),
            last_message_at = COALESCE(
              (SELECT MAX(m.sent_at) FROM messages m WHERE m.dialog_id = dialogs.id),
              last_message_at
            );
        `);

        await db.execAsync(`UPDATE dialogs SET message_id = NULL`);

        await db.execAsync(`DROP TABLE IF EXISTS messages_v4`);
        await db.execAsync(`
          CREATE TABLE messages_v4 (
            id TEXT PRIMARY KEY NOT NULL,
            dialog_id TEXT NOT NULL,
            text TEXT NOT NULL,
            sent_at TEXT NOT NULL,
            is_outgoing INTEGER NOT NULL CHECK (is_outgoing IN (0, 1)),
            FOREIGN KEY (dialog_id) REFERENCES dialogs (id) ON DELETE CASCADE
          );
        `);
        await db.execAsync(`
          INSERT INTO messages_v4 (id, dialog_id, text, sent_at, is_outgoing)
          SELECT id, dialog_id, text, sent_at, is_outgoing FROM messages;
        `);
        await db.execAsync(`DROP TABLE messages`);
        await db.execAsync(`ALTER TABLE messages_v4 RENAME TO messages`);
        await db.execAsync(`
          CREATE INDEX IF NOT EXISTS idx_messages_dialog_sent
            ON messages (dialog_id, sent_at);
        `);
      }

      await db.execAsync(`
        UPDATE dialogs SET
          message_id = (
            SELECT m.id FROM messages m
            WHERE m.dialog_id = dialogs.id
            ORDER BY datetime(m.sent_at) DESC LIMIT 1
          ),
          last_message_at = COALESCE(
            (SELECT MAX(m.sent_at) FROM messages m WHERE m.dialog_id = dialogs.id),
            last_message_at
          );
      `);

      capCols = await tableColumnSet(db, "capsules");
      if (capCols.has("last_message_at")) {
        await db.execAsync(`DROP TABLE IF EXISTS capsules_v4`);
        await db.execAsync(`
          CREATE TABLE capsules_v4 (
            id TEXT PRIMARY KEY NOT NULL,
            name TEXT NOT NULL,
            avatar_url TEXT,
            url TEXT
          );
        `);
        await db.execAsync(`
          INSERT INTO capsules_v4 (id, name, avatar_url, url)
          SELECT id, name, avatar_url, url FROM capsules;
        `);
        await db.execAsync(`DROP TABLE capsules`);
        await db.execAsync(`ALTER TABLE capsules_v4 RENAME TO capsules`);
      }
    });
    await db.execAsync("PRAGMA foreign_keys = ON;");
  },
};
