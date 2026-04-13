import type { SQLiteDatabase } from "expo-sqlite";
import type { SqliteMigration } from "./types";

export const migrationV006: SqliteMigration = {
  version: 6,
  async up(db: SQLiteDatabase) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        email TEXT,
        avatar_url TEXT,
        capsule_url TEXT,
        is_active INTEGER NOT NULL DEFAULT 0 CHECK (is_active IN (0, 1))
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_single_active
        ON accounts (is_active) WHERE is_active = 1;
    `);
  },
};
