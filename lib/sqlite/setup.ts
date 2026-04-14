import {
  deleteDatabaseAsync,
  openDatabaseAsync,
  type SQLiteDatabase,
} from "expo-sqlite";
import { runMigrations } from "lib/sqlite/migrations";

/** File name in Expo’s default SQLite directory (app sandbox). */
export const DATABASE_NAME = "geminyx.db";

let dbPromise: Promise<SQLiteDatabase> | null = null;

/**
 * Closes the open connection (if any), deletes the DB file, and clears the
 * singleton so the next `getDatabase()` creates a new file and runs migrations.
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

async function openAndPrepare(): Promise<SQLiteDatabase> {
  const db = await openDatabaseAsync(DATABASE_NAME);
  await db.execAsync("PRAGMA foreign_keys = ON;");
  await runMigrations(db);
  return db;
}

/** Shared app database (file-backed on iOS/Android; lives in the app sandbox). */
export function getDatabase(): Promise<SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = openAndPrepare();
  }
  return dbPromise;
}

/**
 * Open DB and ensure the active account has default starter capsules when it has none
 * (e.g. after deleting all capsules). New accounts also get these in `AccountRepository.insert`.
 */
export async function initializeDatabase(): Promise<void> {
  const db = await getDatabase();
  const { capsulesRepo } = await import("repositories/capsuleRepository");
  const row = await db.getFirstAsync<{ id: string }>(
    "SELECT id FROM accounts WHERE is_active = 1 LIMIT 1",
  );
  if (row?.id) {
    await capsulesRepo.seedDefaultCapsulesIfEmpty(row.id);
  }
}
