/**
 * Shared light/dark chrome so lists, chat, sheets, and navigation stay consistent.
 */

export const appColors = {
  systemBlueLight: "#007aff",
  systemBlueDark: "#0a84ff",
  destructive: "#ff3b30",
  screenLight: "#ffffff",
  /** Softer than pure black; aligns list/chat/sheet roots in dark mode. */
  screenDark: "#121212",
  headerTitleLight: "#000000",
  headerTitleDark: "#f2f2f7",
} as const;

export function systemBlueForScheme(
  scheme: "light" | "dark" | null | undefined,
): string {
  return scheme === "dark"
    ? appColors.systemBlueDark
    : appColors.systemBlueLight;
}

export function rootScreenBackgroundForScheme(
  scheme: "light" | "dark" | null | undefined,
): string {
  return scheme === "dark" ? appColors.screenDark : appColors.screenLight;
}

export function navigationChromeForScheme(
  scheme: "light" | "dark" | null | undefined,
): {
  headerStyle: { backgroundColor: string };
  headerTintColor: string;
  headerTitleStyle: { color: string };
  headerShadowVisible: boolean;
} {
  const dark = scheme === "dark";
  return {
    headerStyle: {
      backgroundColor: dark ? appColors.screenDark : appColors.screenLight,
    },
    headerTintColor: dark
      ? appColors.systemBlueDark
      : appColors.systemBlueLight,
    headerTitleStyle: {
      color: dark ? appColors.headerTitleDark : appColors.headerTitleLight,
    },
    headerShadowVisible: !dark,
  };
}

export function tabNavigatorChromeForScheme(
  scheme: "light" | "dark" | null | undefined,
): {
  tabBarActiveTintColor: string;
  tabBarInactiveTintColor: string;
  tabBarStyle: { backgroundColor: string; borderTopColor: string };
} & ReturnType<typeof navigationChromeForScheme> {
  const dark = scheme === "dark";
  const nav = navigationChromeForScheme(scheme);
  return {
    ...nav,
    tabBarActiveTintColor: dark
      ? appColors.systemBlueDark
      : appColors.systemBlueLight,
    tabBarInactiveTintColor: dark ? "rgba(235, 235, 245, 0.45)" : "#8e8e93",
    tabBarStyle: {
      backgroundColor: dark ? appColors.screenDark : appColors.screenLight,
      borderTopColor: dark
        ? "rgba(255, 255, 255, 0.08)"
        : "rgba(60, 60, 67, 0.29)",
    },
  };
}
