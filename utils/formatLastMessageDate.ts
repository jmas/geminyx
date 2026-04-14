import i18n from "lib/i18n/init";
import { localeTagForDateFormatting } from "utils/dateLocale";

/**
 * Telegram-style relative labels for last activity time (local calendar).
 */
export function formatLastMessageDate(isoString: string, now = new Date()): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const loc = localeTagForDateFormatting();

  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 0) {
    return date.toLocaleTimeString(loc, { hour: "numeric", minute: "2-digit" });
  }
  if (diffMs < 60_000) {
    return i18n.t("dates.justNow");
  }

  if (isSameCalendarDay(date, now)) {
    return date.toLocaleTimeString(loc, { hour: "numeric", minute: "2-digit" });
  }

  if (isYesterday(date, now)) {
    return i18n.t("dates.yesterday");
  }

  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  if (date > weekAgo) {
    return date.toLocaleDateString(loc, { weekday: "long" });
  }

  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString(loc, { month: "short", day: "numeric" });
  }

  return date.toLocaleDateString(loc, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isYesterday(date: Date, now: Date): boolean {
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  return isSameCalendarDay(date, y);
}
