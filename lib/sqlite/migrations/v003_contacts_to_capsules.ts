import type { SQLiteDatabase } from "expo-sqlite";
import type { SqliteMigration } from "./types";

export const migrationV003: SqliteMigration = {
  version: 3,
  async up(db: SQLiteDatabase) {
    const legacy = await db.getFirstAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='contacts'",
    );
    if (legacy) {
      await db.execAsync(`
        ALTER TABLE contacts RENAME TO capsules;
        ALTER TABLE messages RENAME COLUMN contact_id TO capsule_id;
        DROP INDEX IF EXISTS idx_messages_contact_sent;
        CREATE INDEX IF NOT EXISTS idx_messages_capsule_sent
          ON messages (capsule_id, sent_at);
      `);
    }
  },
};
