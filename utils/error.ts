import { Alert } from "react-native";

/**
 * Returns a human-readable message from any thrown value, or `fallbackMessage`
 * when nothing useful can be extracted.
 */
export function formatError(error: unknown, fallbackMessage: string): string {
  if (error instanceof Error) {
    const m = error.message.trim();
    if (m.length > 0) return m;
    return fallbackMessage;
  }
  if (typeof error === "string") {
    const m = error.trim();
    if (m.length > 0) return m;
    return fallbackMessage;
  }
  if (
    error != null &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  ) {
    const m = (error as { message: string }).message.trim();
    if (m.length > 0) return m;
  }
  if (error == null) {
    return fallbackMessage;
  }
  const s = String(error).trim();
  if (s.length > 0 && s !== "undefined" && s !== "[object Object]") {
    return s;
  }
  return fallbackMessage;
}

/**
 * Shows an alert whose body is `formatError(error, fallbackMessage)`.
 */
export function alertError(
  error: unknown,
  fallbackMessage: string,
  title = "Error",
): void {
  Alert.alert(title, formatError(error, fallbackMessage));
}
