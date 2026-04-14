import type { SQLiteDatabase } from "expo-sqlite";
import { SEED_CAPSULES } from "lib/resources/seedCapsules";
import type { SqliteMigration } from "./types";

/**
 * Replaces the legacy five-capsule demo seed (ids 1–5) with a single Kennedy Search
 * capsule and no messages. Skips if the DB does not match that legacy shape.
 */
export const migrationV010: SqliteMigration = {
  version: 10,
  async up(db: SQLiteDatabase) {
    const row = await db.getFirstAsync<{ n: number }>(
      `SELECT COUNT(*) AS n FROM capsules WHERE id IN ('1','2','3','4','5')`,
    );
    if ((row?.n ?? 0) !== 5) return;

    const kennedy = SEED_CAPSULES[0];
    if (!kennedy) {
      throw new Error("SEED_CAPSULES must define the Kennedy Search capsule");
    }

    await db.withTransactionAsync(async () => {
      await db.runAsync(`DELETE FROM capsules WHERE id IN ('1','2','3','4','5')`);
      await db.runAsync(
        `INSERT INTO capsules (id, name, avatar_url, url, description)
         VALUES (?, ?, ?, ?, ?)`,
        kennedy.id,
        kennedy.name,
        kennedy.avatarUrl ?? null,
        kennedy.url ?? null,
        kennedy.description?.trim() ? kennedy.description.trim() : null,
      );
      await db.runAsync(
        `INSERT INTO dialogs (id, capsule_id, message_id, last_message_at)
         VALUES (?, ?, NULL, ?)`,
        kennedy.id,
        kennedy.id,
        new Date(0).toISOString(),
      );
    });
  },
};
