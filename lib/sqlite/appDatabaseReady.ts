import { File } from "expo-file-system";
import { defaultDatabaseDirectory, openDatabaseAsync } from "expo-sqlite";
import { Platform } from "react-native";
import { runMigrations } from "lib/sqlite/migrations";
import { DATABASE_NAME } from "lib/sqlite/setup";

function geminyxDatabaseAbsolutePath(dir: string): string {
  const name = DATABASE_NAME.replace(/^\/+/, "");
  return `${String(dir).replace(/\/*$/, "")}/${name}`;
}

function toFileUri(path: string): string {
  if (path.startsWith("file://")) return path;
  return path.startsWith("/") ? `file://${path}` : `file:///${path}`;
}

/**
 * True when the SQLite file exists (native) and contains at least one account row.
 * On first launch the DB file is absent until the user finishes onboarding.
 */
export async function isAppDatabaseReady(): Promise<boolean> {
  try {
    if (Platform.OS !== "web") {
      const dir = defaultDatabaseDirectory;
      if (dir != null) {
        const path = geminyxDatabaseAbsolutePath(dir);
        const file = new File(toFileUri(path));
        if (!file.exists) return false;
      }
    }

    const db = await openDatabaseAsync(DATABASE_NAME);
    try {
      await db.execAsync("PRAGMA foreign_keys = ON;");
      await runMigrations(db);
      const row = await db.getFirstAsync<{ n: number }>(
        "SELECT COUNT(*) AS n FROM accounts",
      );
      return (row?.n ?? 0) > 0;
    } finally {
      await db.closeAsync();
    }
  } catch {
    return false;
  }
}
