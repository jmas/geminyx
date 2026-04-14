import { Platform } from "react-native";
import { File, Paths } from "expo-file-system";
import { Account } from "lib/watermelon/models/Account";
import { getWatermelonDatabase } from "lib/watermelon";

function geminyxWatermelonFile(): File {
  return new File(Paths.document, "geminyx.db");
}

/**
 * True when a local database file exists (native) and contains at least one account row.
 * On first launch there is no DB file until onboarding completes.
 */
export async function isAppDatabaseReady(): Promise<boolean> {
  try {
    if (Platform.OS !== "web") {
      const file = geminyxWatermelonFile();
      if (!file.exists) return false;
    }

    const db = getWatermelonDatabase();
    const count = await db.get<Account>("accounts").query().fetchCount();
    return count > 0;
  } catch {
    return false;
  }
}
