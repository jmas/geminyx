import * as Localization from "expo-localization";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "lib/i18n/en.json";
import uk from "lib/i18n/uk.json";

const deviceCode = Localization.getLocales()[0]?.languageCode ?? "en";
const initialLng = deviceCode === "uk" ? "uk" : "en";

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    uk: { translation: uk },
  },
  lng: initialLng,
  fallbackLng: "en",
  interpolation: { escapeValue: false },
  compatibilityJSON: "v4",
});

export default i18n;
