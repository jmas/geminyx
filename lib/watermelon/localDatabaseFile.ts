import { File as ExpoFile, Paths } from "expo-file-system";
import { Platform } from "react-native";

/** Matches `dbName: "geminyx"` in `lib/watermelon/database.ts` (native code appends `.db`). */
export const WATERMELON_SQLITE_FILENAME = "geminyx.db";

/**
 * Absolute path to the SQLite file WatermelonDB opens. Differs by platform:
 * iOS: `Documents/geminyx.db` (see WatermelonDB `DatabasePlatformIOS.mm`).
 * Android: app data dir `geminyx.db` (see WatermelonDB `WMDatabase.createSQLiteDatabase`).
 */
export function getWatermelonSqliteFile(): ExpoFile {
  if (Platform.OS === "android") {
    return new ExpoFile(Paths.document.parentDirectory, WATERMELON_SQLITE_FILENAME);
  }
  return new ExpoFile(Paths.document, WATERMELON_SQLITE_FILENAME);
}

/** WAL sidecar files next to the main DB (safe to delete before restore). */
export function getWatermelonWalShmFiles(): ExpoFile[] {
  const main = getWatermelonSqliteFile();
  return [
    new ExpoFile(main.parentDirectory, `${WATERMELON_SQLITE_FILENAME}-wal`),
    new ExpoFile(main.parentDirectory, `${WATERMELON_SQLITE_FILENAME}-shm`),
  ];
}
