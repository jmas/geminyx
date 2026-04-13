import type { SQLiteDatabase } from "expo-sqlite";
import type { SqliteMigration } from "./types";

export const migrationV001: SqliteMigration = {
  version: 1,
  async up(db: SQLiteDatabase) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS capsules (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        last_message_at TEXT NOT NULL,
        avatar_url TEXT
      );
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY NOT NULL,
        capsule_id TEXT NOT NULL,
        text TEXT NOT NULL,
        sent_at TEXT NOT NULL,
        is_outgoing INTEGER NOT NULL CHECK (is_outgoing IN (0, 1)),
        FOREIGN KEY (capsule_id) REFERENCES capsules (id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_messages_capsule_sent
        ON messages (capsule_id, sent_at);
    `);
  },
};
