import type { NativeStackNavigationOptions } from "@react-navigation/native-stack";
import { Stack } from "expo-router";
import { navigationChromeForScheme } from "lib/theme/appColors";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useColorScheme } from "react-native";

/**
 * Nested native stack so the capsule list uses UINavigationBar + ScreenStack headers.
 * The tab navigator’s own header is JS-based and does not get iOS system bar-button chrome.
 */
export default function CapsulesStackLayout() {
  const { t } = useTranslation();
  const scheme = useColorScheme();
  const screenOptions = useMemo(
    () =>
      ({
        ...navigationChromeForScheme(scheme),
        headerBackTitle: t("common.back"),
      }) as NativeStackNavigationOptions,
    [scheme, t],
  );

  return <Stack screenOptions={screenOptions} />;
}
