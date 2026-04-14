import type { SQLiteDatabase } from "expo-sqlite";
import type { SqliteMigration } from "./types";
import { migrationV001 } from "./v001_initial";
import { migrationV002 } from "./v002_capsule_url";
import { migrationV003 } from "./v003_contacts_to_capsules";
import { migrationV004 } from "./v004_dialogs";
import { migrationV005 } from "./v005_capsule_description";
import { migrationV006 } from "./v006_accounts";
import { migrationV007 } from "./v007_message_body";
import { migrationV008 } from "./v008_message_blobs";
import { migrationV009 } from "./v009_message_request_path";
import { migrationV010 } from "./v010_kennedy_only_seed";
import { migrationV011 } from "./v011_account_gemini_client_cert";
import { migrationV012 } from "./v012_dialog_client_cert_share_flag";
import { migrationV013 } from "./v013_capsules_account_scope";

const MIGRATIONS: SqliteMigration[] = [
  migrationV001,
  migrationV002,
  migrationV003,
  migrationV004,
  migrationV005,
  migrationV006,
  migrationV007,
  migrationV008,
  migrationV009,
  migrationV010,
  migrationV011,
  migrationV012,
  migrationV013,
];

/** Ordered ascending by `version` */
export function getMigrations(): SqliteMigration[] {
  return [...MIGRATIONS].sort((a, b) => a.version - b.version);
}

export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  let version =
    (await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version"))
      ?.user_version ?? 0;

  for (const m of getMigrations()) {
    if (version < m.version) {
      await m.up(db);
      await db.execAsync(`PRAGMA user_version = ${m.version}`);
      version = m.version;
    }
  }
}

export type { SqliteMigration } from "./types";
