import { Alert } from "react-native";

/**
 * Validates user-entered Gemini URL for opening a thread. Shows alerts on failure.
 * @returns Trimmed URL or null
 */
export function geminiUrlForThreadNavigationOrAlert(
  raw: string | undefined,
): string | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed.length) {
    Alert.alert("URL required", "Enter a gemini:// URL.");
    return null;
  }
  if (!/^gemini:\/\//i.test(trimmed)) {
    Alert.alert("Invalid URL", "The URL must start with gemini://.");
    return null;
  }
  try {
    const u = new URL(trimmed);
    if (!/^gemini:$/i.test(u.protocol)) {
      throw new Error("not gemini protocol");
    }
  } catch {
    Alert.alert("Invalid URL", "Could not parse this URL. Check the format.");
    return null;
  }
  return trimmed;
}
