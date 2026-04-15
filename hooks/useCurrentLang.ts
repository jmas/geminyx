import { useMemo } from "react";
import { useTranslation } from "react-i18next";

export function useCurrentLang(): string {
  const { i18n } = useTranslation();

  const lang = i18n.resolvedLanguage ?? i18n.language ?? "en";
  return useMemo(() => lang, [lang]);
}

