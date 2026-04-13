import type { SQLiteDatabase } from "expo-sqlite";
import type { SqliteMigration } from "./types";

export const migrationV009: SqliteMigration = {
  version: 9,
  async up(db: SQLiteDatabase) {
    await db.execAsync(
      `ALTER TABLE messages ADD COLUMN request_path TEXT NOT NULL DEFAULT ''`,
    );
  },
};
