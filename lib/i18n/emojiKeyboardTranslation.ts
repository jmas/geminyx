import { en, ua } from "rn-emoji-keyboard";

import i18n from "lib/i18n/init";

/** `rn-emoji-keyboard` bundles Ukrainian as `ua`; use it when app locale is Ukrainian. */
export function emojiKeyboardTranslation(lang?: string) {
  const resolved = lang ?? i18n.resolvedLanguage ?? i18n.language ?? "en";
  return resolved === "uk" ? ua : en;
}
