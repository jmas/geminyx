import {
  deleteDatabaseAsync,
  openDatabaseAsync,
  type SQLiteDatabase,
} from "expo-sqlite";
import { SEED_CAPSULES } from "lib/resources/seedCapsules";
import { runMigrations } from "lib/sqlite/migrations";

/** File name in Expo’s default SQLite directory (app sandbox). */
export const DATABASE_NAME = "geminyx.db";

let dbPromise: Promise<SQLiteDatabase> | null = null;

/**
 * Closes the open connection (if any), deletes the DB file, and clears the
 * singleton so the next `getDatabase()` creates a new file and runs migrations + seed.
 * On a real “fresh install”, deleting the app also wipes this file.
 */
export async function resetLocalDatabase(): Promise<void> {
  const pending = dbPromise;
  dbPromise = null;
  if (pending) {
    try {
      const db = await pending;
      await db.closeAsync();
    } catch {
      /* ignore close errors */
    }
  }
  await deleteDatabaseAsync(DATABASE_NAME);
}

async function seedIfEmpty(db: SQLiteDatabase): Promise<void> {
  const countRow = await db.getFirstAsync<{ n: number }>(
    "SELECT COUNT(*) AS n FROM capsules",
  );
  if ((countRow?.n ?? 0) > 0) return;

  await db.withTransactionAsync(async () => {
    const emptyDialogAt = new Date(0).toISOString();
    for (const c of SEED_CAPSULES) {
      await db.runAsync(
        `INSERT INTO capsules (id, name, avatar_url, url, description)
         VALUES (?, ?, ?, ?, ?)`,
        c.id,
        c.name,
        c.avatarUrl ?? null,
        c.url ?? null,
        c.description?.trim() ? c.description.trim() : null,
      );
      await db.runAsync(
        `INSERT INTO dialogs (id, capsule_id, message_id, last_message_at)
         VALUES (?, ?, NULL, ?)`,
        c.id,
        c.id,
        emptyDialogAt,
      );
    }
  });
}

async function openAndPrepare(): Promise<SQLiteDatabase> {
  const db = await openDatabaseAsync(DATABASE_NAME);
  await db.execAsync("PRAGMA foreign_keys = ON;");
  await runMigrations(db);
  await seedIfEmpty(db);
  return db;
}

/** Shared app database (file-backed on iOS/Android; lives in the app sandbox). */
export function getDatabase(): Promise<SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = openAndPrepare();
  }
  return dbPromise;
}

/** Open DB, run migrations, seed demo rows once. Call once at startup. */
export async function initializeDatabase(): Promise<void> {
  await getDatabase();
}
