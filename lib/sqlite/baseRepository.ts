import type { SQLiteDatabase } from "expo-sqlite";
import { getDatabase } from "lib/sqlite/setup";

export type DbGetter = () => Promise<SQLiteDatabase>;

export abstract class BaseSqliteRepository {
  private readonly getDb: DbGetter;

  constructor(getDb: DbGetter = getDatabase) {
    this.getDb = getDb;
  }

  protected db(): Promise<SQLiteDatabase> {
    return this.getDb();
  }
}

