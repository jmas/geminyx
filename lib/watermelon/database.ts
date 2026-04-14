import { Database } from "@nozbe/watermelondb";
import SQLiteAdapter from "@nozbe/watermelondb/adapters/sqlite";
import {
  Account,
  AppBlob,
  Capsule,
  Category,
  Message,
  Setting,
  Thread,
} from "lib/watermelon/models";
import { geminyxMigrations } from "lib/watermelon/migrations";
import { geminyxSchema } from "lib/watermelon/schema";

const modelClasses = [
  Account,
  Capsule,
  Category,
  Thread,
  Message,
  AppBlob,
  Setting,
];

let databaseSingleton: Database | null = null;

export function getWatermelonDatabase(): Database {
  if (!databaseSingleton) {
    const adapter = new SQLiteAdapter({
      schema: geminyxSchema,
      migrations: geminyxMigrations,
      dbName: "geminyx",
      jsi: true,
    });
    databaseSingleton = new Database({
      adapter,
      modelClasses,
    });
  }
  return databaseSingleton;
}

/** Clears the singleton so the next open is a new JS `Database` instance (e.g. after reset). */
export function clearWatermelonDatabaseSingleton(): void {
  databaseSingleton = null;
}
