import { en, ua } from "rn-emoji-keyboard";

import i18n from "lib/i18n/init";

/** `rn-emoji-keyboard` bundles Ukrainian as `ua`; use it when app locale is Ukrainian. */
export function emojiKeyboardTranslation() {
  return i18n.language === "uk" ? ua : en;
}
