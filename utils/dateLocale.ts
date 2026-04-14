import i18n from "lib/i18n/init";

/**
 * BCP 47 tag for `Intl` date/time formatting, aligned with the active UI language
 * (`i18n`), not necessarily the device locale.
 */
export function localeTagForDateFormatting(): string {
  const lng = i18n.resolvedLanguage ?? i18n.language ?? "en";
  if (lng === "uk") return "uk-UA";
  return "en-US";
}
