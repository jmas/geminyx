import { useCallback, useMemo } from "react";

import { useCurrentLang } from "hooks/useCurrentLang";
import { localeTagForDateFormatting } from "utils/dateLocale";
import { formatLastMessageDate } from "utils/formatLastMessageDate";
import { formatMessageTime } from "utils/formatMessageTime";

export type DateFormatter = {
  lang: string;
  localeTag: string;
  formatLastMessageDate: (isoString: string, now?: Date) => string;
  formatMessageTime: (isoString: string) => string;
};

/**
 * Reactive date formatting helpers that update immediately when the UI language changes.
 *
 * Important: `formatLastMessageDate` includes translated labels like "Just now" / "Yesterday".
 */
export function useDateFormatter(): DateFormatter {
  const lang = useCurrentLang();

  // Locale tag is derived from the same source as date utils, but we expose it
  // so callers can use `Intl` directly when needed.
  const localeTag = useMemo(() => {
    void lang;
    return localeTagForDateFormatting();
  }, [lang]);

  // `lang` is intentionally referenced so this hook re-renders on language change,
  // even though these helpers delegate to i18n-aware utilities.
  const fmtLast = useCallback((isoString: string, now?: Date) => {
    void lang;
    return formatLastMessageDate(isoString, now);
  }, [lang]);

  const fmtTime = useCallback(
    (isoString: string) => {
      void lang;
      return formatMessageTime(isoString);
    },
    [lang],
  );

  return useMemo(
    () => ({
      lang,
      localeTag,
      formatLastMessageDate: fmtLast,
      formatMessageTime: fmtTime,
    }),
    [lang, localeTag, fmtLast, fmtTime],
  );
}

