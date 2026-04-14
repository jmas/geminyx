import type { SQLiteDatabase } from "expo-sqlite";
import type { SqliteMigration } from "./types";

/** Optional PKCS#12 (base64) + passphrase for Gemini TLS client authentication. */
export const migrationV011: SqliteMigration = {
  version: 11,
  async up(db: SQLiteDatabase) {
    // Avoid multi-statement `execAsync` in migrations (some SQLite builds error with rollback).
    // Add columns idempotently when possible.
    await db.execAsync("ALTER TABLE accounts ADD COLUMN gemini_client_p12_base64 TEXT;");
    await db.execAsync(
      "ALTER TABLE accounts ADD COLUMN gemini_client_p12_passphrase TEXT;",
    );
  },
};
