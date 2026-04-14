import { File, Paths } from "expo-file-system";

/**
 * Removes the pre–WatermelonDB `expo-sqlite` file if it is still on disk so we do not
 * leave a stale `geminyx.db` next to the Watermelon-managed database.
 */
export function deleteLegacyExpoSqliteDatabaseIfPresent(): void {
  const candidates = [
    new File(Paths.document, "SQLite", "geminyx.db"),
    new File(Paths.document, "geminyx.db"),
  ];
  for (const f of candidates) {
    try {
      if (f.exists) f.delete();
    } catch {
      /* ignore */
    }
  }
}
