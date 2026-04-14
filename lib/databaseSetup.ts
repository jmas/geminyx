import {
  clearWatermelonDatabaseSingleton,
  deleteLegacyExpoSqliteDatabaseIfPresent,
  getWatermelonDatabase,
} from "lib/watermelon";
import { accountsRepo } from "repositories/accountRepository";
import { capsulesRepo } from "repositories/capsuleRepository";

/**
 * Best-effort removal of the legacy `expo-sqlite` file, then opens WatermelonDB and seeds
 * default capsules when the active account has none.
 */
export async function initializeDatabase(): Promise<void> {
  deleteLegacyExpoSqliteDatabaseIfPresent();
  getWatermelonDatabase();
  const active = await accountsRepo.getActive();
  if (active?.id) {
    await capsulesRepo.seedDefaultCapsulesIfEmpty(active.id);
  }
}

/**
 * Wipes WatermelonDB contents and clears the JS singleton so the next open is fresh.
 */
export async function resetLocalDatabase(): Promise<void> {
  const db = getWatermelonDatabase();
  await db.write(async () => {
    await db.unsafeResetDatabase();
  });
  clearWatermelonDatabaseSingleton();
  deleteLegacyExpoSqliteDatabaseIfPresent();
}
