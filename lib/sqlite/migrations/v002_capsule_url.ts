import type { SQLiteDatabase } from "expo-sqlite";
import type { SqliteMigration } from "./types";

export const migrationV002: SqliteMigration = {
  version: 2,
  async up(db: SQLiteDatabase) {
    const hasCapsules = await db.getFirstAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='capsules'",
    );
    if (hasCapsules) {
      await db.execAsync("ALTER TABLE capsules ADD COLUMN url TEXT");
    } else {
      await db.execAsync("ALTER TABLE contacts ADD COLUMN url TEXT");
    }
  },
};
