import type { Database } from "@nozbe/watermelondb";
import { getWatermelonDatabase } from "lib/watermelon/database";

/** Shared access to the Watermelon singleton for all repositories. */
export abstract class BaseRepository {
  protected db(): Database {
    return getWatermelonDatabase();
  }
}
