import type { SQLiteDatabase } from "expo-sqlite";
import type { SqliteMigration } from "./types";

export const migrationV013: SqliteMigration = {
  version: 13,
  async up(db: SQLiteDatabase) {
    await db.execAsync("PRAGMA foreign_keys = OFF;");
    await db.withTransactionAsync(async () => {
      // Ensure at least one account exists so we can make `capsules.account_id` NOT NULL.
      await db.execAsync(`
        INSERT INTO accounts (id, name, email, avatar_url, capsule_url, is_active)
        SELECT 'acc_default', 'Default', NULL, NULL, NULL, 1
        WHERE NOT EXISTS (SELECT 1 FROM accounts);
      `);

      // Ensure there is an active account (older DBs could have none).
      await db.execAsync(`
        UPDATE accounts
        SET is_active = 1
        WHERE id = (SELECT id FROM accounts ORDER BY name COLLATE NOCASE ASC LIMIT 1)
          AND NOT EXISTS (SELECT 1 FROM accounts WHERE is_active = 1);
      `);

      await db.execAsync(`DROP TABLE IF EXISTS capsules_v13`);
      await db.execAsync(`
        CREATE TABLE capsules_v13 (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          avatar_url TEXT,
          url TEXT,
          description TEXT,
          account_id TEXT NOT NULL,
          FOREIGN KEY (account_id) REFERENCES accounts (id) ON DELETE CASCADE
        );
      `);

      // Backfill existing capsules to the active account at migration time.
      await db.execAsync(`
        INSERT INTO capsules_v13 (id, name, avatar_url, url, description, account_id)
        SELECT
          id,
          name,
          avatar_url,
          url,
          description,
          (SELECT id FROM accounts WHERE is_active = 1 LIMIT 1) AS account_id
        FROM capsules;
      `);

      await db.execAsync(`DROP TABLE capsules`);
      await db.execAsync(`ALTER TABLE capsules_v13 RENAME TO capsules`);
      await db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_capsules_account_name
          ON capsules (account_id, name COLLATE NOCASE);
      `);
      await db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_capsules_account_id
          ON capsules (account_id, id);
      `);
    });
    await db.execAsync("PRAGMA foreign_keys = ON;");
  },
};

