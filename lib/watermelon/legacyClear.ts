import { File, Paths } from "expo-file-system";

/**
 * Removes the **legacy** pre–WatermelonDB `expo-sqlite` file only (`Documents/SQLite/geminyx.db`).
 *
 * Do **not** delete `Documents/geminyx.db` here — that path is WatermelonDB’s live database
 * (see `lib/watermelon/localDatabaseFile.ts`). Deleting it after `unsafeResetDatabase` or
 * import leaves WAL/SHM sidecars behind and can cause SQLite I/O errors (e.g. 522) on the next open.
 */
export function deleteLegacyExpoSqliteDatabaseIfPresent(): void {
  const candidates = [new File(Paths.document, "SQLite", "geminyx.db")];
  for (const f of candidates) {
    try {
      if (f.exists) f.delete();
    } catch {
      /* ignore */
    }
  }
}
