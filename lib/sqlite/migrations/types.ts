import type { SQLiteDatabase } from "expo-sqlite";

export type SqliteMigration = {
  /** `PRAGMA user_version` after this migration succeeds */
  version: number;
  up: (db: SQLiteDatabase) => Promise<void>;
};
