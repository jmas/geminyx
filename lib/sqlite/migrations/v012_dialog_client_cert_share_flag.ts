import type { SQLiteDatabase } from "expo-sqlite";
import { tableColumnSet } from "./helpers";
import type { SqliteMigration } from "./types";

export const migrationV012: SqliteMigration = {
  version: 12,
  async up(db: SQLiteDatabase) {
    // `ALTER TABLE` statements may auto-commit and can behave poorly inside Expo's
    // `withTransactionAsync` wrapper (e.g. rollback errors).
    const cols = await tableColumnSet(db, "dialogs");
    if (!cols.has("client_cert_share_allowed")) {
      await db.runAsync(
        "ALTER TABLE dialogs ADD COLUMN client_cert_share_allowed INTEGER NOT NULL DEFAULT 0 CHECK (client_cert_share_allowed IN (0, 1))",
      );
    }
  },
};

