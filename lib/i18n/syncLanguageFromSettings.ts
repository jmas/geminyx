import * as Localization from "expo-localization";

import i18n from "lib/i18n/init";
import {
  accountsRepo,
  parseAppLanguagePreference,
  settingsRepo,
  SETTINGS_UI_LANGUAGE_KEY,
  type AppLanguagePreference,
} from "repositories";

function deviceLanguageCode(): "en" | "uk" {
  const code = Localization.getLocales()[0]?.languageCode ?? "en";
  return code === "uk" ? "uk" : "en";
}

/** Resolves stored preference to an i18next language code. */
export function resolveI18nLanguageCode(
  pref: AppLanguagePreference | undefined,
): "en" | "uk" {
  if (pref === "en" || pref === "uk") return pref;
  return deviceLanguageCode();
}

/**
 * Applies `ui_language` from the active account’s settings row (or device default
 * when there is no active account / no value).
 */
export async function syncLanguageFromSettings(): Promise<void> {
  const active = await accountsRepo.getActive();
  if (!active?.id) {
    await i18n.changeLanguage(deviceLanguageCode());
    return;
  }
  const raw = await settingsRepo.get(active.id, SETTINGS_UI_LANGUAGE_KEY);
  const pref = parseAppLanguagePreference(raw) ?? "system";
  await i18n.changeLanguage(resolveI18nLanguageCode(pref));
}
