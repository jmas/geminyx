import type { SQLiteDatabase } from "expo-sqlite";
import type { SqliteMigration } from "./types";

export const migrationV005: SqliteMigration = {
  version: 5,
  async up(db: SQLiteDatabase) {
    await db.execAsync(
      "ALTER TABLE capsules ADD COLUMN description TEXT",
    );
  },
};
