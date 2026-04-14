import { localeTagForDateFormatting } from "utils/dateLocale";

/** Short locale time for a message bubble (ISO 8601 input). */
export function formatMessageTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(localeTagForDateFormatting(), {
    hour: "numeric",
    minute: "2-digit",
  });
}
