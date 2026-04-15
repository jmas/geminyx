import { Alert } from "react-native";
import { i18n } from "lib/i18n";

/**
 * Validates user-entered Gemini URL for opening a thread. Shows alerts on failure.
 * @returns Trimmed URL or null
 */
export function geminiUrlForThreadNavigationOrAlert(
  raw: string | undefined,
): string | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed.length) {
    Alert.alert(i18n.t("threads.urlRequiredTitle"), i18n.t("threads.urlRequiredBody"));
    return null;
  }
  if (!/^gemini:\/\//i.test(trimmed)) {
    Alert.alert(i18n.t("threads.urlInvalidTitle"), i18n.t("threads.urlInvalidBodyPrefix"));
    return null;
  }
  try {
    const u = new URL(trimmed);
    if (!/^gemini:$/i.test(u.protocol)) {
      throw new Error("not gemini protocol");
    }
  } catch {
    Alert.alert(i18n.t("threads.urlInvalidTitle"), i18n.t("threads.urlInvalidBodyParse"));
    return null;
  }
  return trimmed;
}
