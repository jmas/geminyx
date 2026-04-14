import { getWatermelonDatabase } from "lib/watermelon/database";
import { accountsRepo } from "repositories";

/**
 * True when the local DB is openable and there is an active account.
 * Opening the DB is required before querying; we do not rely on guessing the SQLite file path.
 */
export async function isAppDatabaseReady(): Promise<boolean> {
  try {
    getWatermelonDatabase();
    const active = await accountsRepo.getActive();
    return active !== null;
  } catch {
    return false;
  }
}
