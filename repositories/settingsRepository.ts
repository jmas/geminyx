import { Q } from "@nozbe/watermelondb";
import { newId } from "lib/db/utils";
import { Setting as SettingModel } from "lib/watermelon/models/Setting";
import { BaseRepository } from "repositories/baseRepository";
import { accountsRepo } from "repositories/accountRepository";

/** Row key for persisted root tab; value is JSON string of a tab route name. */
export const SETTINGS_TAB_ACTIVE_KEY = "tab_active" as const;

/** UI language: follow device, or force English / Ukrainian. Stored as JSON string. */
export const SETTINGS_UI_LANGUAGE_KEY = "ui_language" as const;

export type AppLanguagePreference = "system" | "en" | "uk";

export function parseAppLanguagePreference(
  raw: unknown,
): AppLanguagePreference | undefined {
  if (raw === "system" || raw === "en" || raw === "uk") return raw;
  return undefined;
}

export const ROOT_TAB_ROUTE_NAMES = ["index", "threads", "settings"] as const;
export type RootTabRouteName = (typeof ROOT_TAB_ROUTE_NAMES)[number];

function isRootTabRouteName(v: unknown): v is RootTabRouteName {
  return (
    typeof v === "string" &&
    (ROOT_TAB_ROUTE_NAMES as readonly string[]).includes(v)
  );
}

let cachedInitialRootTab: RootTabRouteName | undefined;

export function getCachedInitialRootTab(): RootTabRouteName {
  return cachedInitialRootTab ?? "index";
}

export function clearSettingsUiCache(): void {
  cachedInitialRootTab = undefined;
}

export async function preloadSettingsFromDatabase(): Promise<void> {
  const active = await accountsRepo.getActive();
  if (!active?.id) {
    cachedInitialRootTab = "index";
    return;
  }
  const raw = await settingsRepo.get(active.id, SETTINGS_TAB_ACTIVE_KEY);
  cachedInitialRootTab = isRootTabRouteName(raw) ? raw : "index";
}

function parseJsonValue(json: string): unknown {
  try {
    return JSON.parse(json) as unknown;
  } catch {
    return undefined;
  }
}

export class SettingsRepository extends BaseRepository {
  private settingsCollection() {
    return this.db().get<SettingModel>("settings");
  }

  async get(accountId: string, key: string): Promise<unknown | undefined> {
    const rows = await this.settingsCollection()
      .query(
        Q.and(Q.where("account_id", accountId), Q.where("setting_key", key)),
      )
      .fetch();
    const row = rows[0];
    if (!row) return undefined;
    return parseJsonValue(row.valueJson);
  }

  async getForActiveAccount(key: string): Promise<unknown | undefined> {
    const active = await accountsRepo.getActive();
    if (!active?.id) return undefined;
    return this.get(active.id, key);
  }

  async set(accountId: string, key: string, value: unknown): Promise<void> {
    let valueJson: string;
    try {
      valueJson = JSON.stringify(value);
    } catch {
      throw new Error("settings:set value is not JSON-serializable");
    }
    const col = this.settingsCollection();
    const db = this.db();
    const existing = await col
      .query(
        Q.and(Q.where("account_id", accountId), Q.where("setting_key", key)),
      )
      .fetch();
    await db.write(async () => {
      const row = existing[0];
      if (row) {
        await row.update((rec) => {
          rec.valueJson = valueJson;
        });
      } else {
        await col.create((rec) => {
          rec._raw.id = newId("set");
          rec.accountId = accountId;
          rec.settingKey = key;
          rec.valueJson = valueJson;
        });
      }
    });
  }

  async setForActiveAccount(key: string, value: unknown): Promise<void> {
    const active = await accountsRepo.getActive();
    if (!active?.id) return;
    await this.set(active.id, key, value);
  }
}

export const settingsRepo = new SettingsRepository();
