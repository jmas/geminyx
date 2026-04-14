import type { Database } from "@nozbe/watermelondb";
import { File as ExpoFile, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Alert, DevSettings } from "react-native";
import { clearWatermelonDatabaseSingleton, getWatermelonDatabase } from "lib/watermelon/database";
import { deleteLegacyExpoSqliteDatabaseIfPresent } from "lib/watermelon/legacyClear";
import {
  getWatermelonSqliteFile,
  getWatermelonWalShmFiles,
} from "lib/watermelon/localDatabaseFile";
import { queryClient } from "lib/queryClient";
import { clearSettingsUiCache } from "repositories";
import { formatError } from "utils/error";

const SQLITE_MAGIC = "SQLite format 3";

async function checkpointWal(db: Database): Promise<void> {
  await db.adapter.unsafeExecute({
    sqlString: "PRAGMA wal_checkpoint(FULL);",
  });
}

function reloadAfterDatabaseFileReplace(): void {
  if (__DEV__) {
    DevSettings.reload();
    return;
  }
  Alert.alert(
    "Restart required",
    "Close the app completely (swipe it away in the app switcher), then reopen it to use the imported database.",
  );
}

/**
 * Copies the live DB to cache and opens the share sheet. Flushes WAL first so the file is self-contained.
 */
export async function exportLocalDatabaseToCacheAndShare(): Promise<void> {
  const db = getWatermelonDatabase();
  await checkpointWal(db);

  const live = getWatermelonSqliteFile();
  if (!live.exists) {
    throw new Error("No local database file found.");
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const exportFile = new ExpoFile(Paths.cache, `geminyx-backup-${stamp}.db`);
  live.copy(exportFile);

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error("Sharing is not available on this device.");
  }
  await Sharing.shareAsync(exportFile.uri, {
    mimeType: "application/x-sqlite3",
    UTI: "public.database",
    dialogTitle: "Export database",
  });
}

/**
 * Replaces the live SQLite file with the picked file, clears caches, and reloads JS (dev) or asks for a cold start (release).
 */
export async function importLocalDatabaseFromPicker(): Promise<void> {
  let source: ExpoFile;
  try {
    const picked = await ExpoFile.pickFileAsync(undefined, "application/octet-stream");
    const chosen = Array.isArray(picked) ? picked[0] : picked;
    if (!chosen) throw new Error("No file selected.");
    source = chosen as ExpoFile;
  } catch (e) {
    if (formatError(e, "").toLowerCase().includes("cancel")) {
      return;
    }
    throw e;
  }

  if (!source?.exists) {
    throw new Error("Could not read the selected file.");
  }

  const header = await source.bytes();
  const magic = new TextDecoder().decode(header.slice(0, SQLITE_MAGIC.length));
  if (!magic.startsWith(SQLITE_MAGIC)) {
    throw new Error("That file does not look like a SQLite database.");
  }

  const db = getWatermelonDatabase();
  await checkpointWal(db);

  for (const sidecar of getWatermelonWalShmFiles()) {
    try {
      if (sidecar.exists) sidecar.delete();
    } catch {
      /* ignore */
    }
  }

  const live = getWatermelonSqliteFile();
  try {
    if (live.exists) live.delete();
  } catch (e) {
    throw new Error(
      `Could not replace the database file: ${formatError(e, "unknown error")}`,
    );
  }

  source.copy(live);

  clearWatermelonDatabaseSingleton();
  clearSettingsUiCache();
  deleteLegacyExpoSqliteDatabaseIfPresent();
  queryClient.clear();

  reloadAfterDatabaseFileReplace();
}
