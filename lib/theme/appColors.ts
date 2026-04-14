/**
 * App chrome and shared palettes. On iOS, tints and neutrals use UIColor
 * semantic names via PlatformColor so they track system appearance and
 * accessibility (e.g. system blue). Android and web use the hex fallbacks.
 */

import { Platform, PlatformColor, type ColorValue } from "react-native";

export const appColors = {
  systemBlueLight: "#007aff",
  systemBlueDark: "#0a84ff",
  destructive: "#ff3b30",
  screenLight: "#ffffff",
  /**
   * Light mode outer area behind grouped lists (matches iOS `systemGroupedBackground`).
   * Use with `secondarySystemGroupedBackground`-style surfaces for row/card “foreground”.
   */
  screenGroupedLight: "#f2f2f7",
  /** Dark mode root background — matches iOS `systemBackground` / Material baseline black. */
  screenDark: "#000000",
  headerTitleLight: "#000000",
  headerTitleDark: "#f2f2f7",
} as const;

export function systemBlueForScheme(
  scheme: "light" | "dark" | null | undefined,
): ColorValue {
  if (Platform.OS === "ios") {
    return PlatformColor("systemBlue");
  }
  return scheme === "dark"
    ? appColors.systemBlueDark
    : appColors.systemBlueLight;
}

/** Tab bar, stack headers, and full-screen roots — grouped gray (light) like iOS Settings. */
export function rootScreenBackgroundForScheme(
  scheme: "light" | "dark" | null | undefined,
): ColorValue {
  if (Platform.OS === "ios") {
    return PlatformColor("systemGroupedBackground");
  }
  return scheme === "dark" ? appColors.screenDark : appColors.screenGroupedLight;
}

export function headerTitleColorForScheme(
  scheme: "light" | "dark" | null | undefined,
): ColorValue {
  if (Platform.OS === "ios") {
    return PlatformColor("label");
  }
  return scheme === "dark"
    ? appColors.headerTitleDark
    : appColors.headerTitleLight;
}

export function destructiveTintColor(): ColorValue {
  return Platform.OS === "ios"
    ? PlatformColor("systemRed")
    : appColors.destructive;
}

export function systemGreenColor(): ColorValue {
  if (Platform.OS === "ios") return PlatformColor("systemGreen");
  return "#34C759";
}

export function systemOrangeColor(): ColorValue {
  if (Platform.OS === "ios") return PlatformColor("systemOrange");
  return "#FF9500";
}

/** Settings / profile lists — iOS dynamic colors. */
export function iosScreenContentPalette() {
  return {
    background: PlatformColor("systemGroupedBackground"),
    textPrimary: PlatformColor("label"),
    textSecondary: PlatformColor("secondaryLabel"),
    textTertiary: PlatformColor("tertiaryLabel"),
    profilePressed: PlatformColor("tertiarySystemFill"),
    cardBg: PlatformColor("secondarySystemGroupedBackground"),
    separator: PlatformColor("separator"),
    rowPressed: PlatformColor("tertiarySystemFill"),
  } as const;
}

export type IosScreenContentPalette = ReturnType<
  typeof iosScreenContentPalette
>;

export function iosThreadListPalette() {
  return {
    background: PlatformColor("systemGroupedBackground"),
    listRowSurface: PlatformColor("secondarySystemGroupedBackground"),
    textPrimary: PlatformColor("label"),
    textSecondary: PlatformColor("secondaryLabel"),
    separator: PlatformColor("separator"),
    rowPressed: PlatformColor("tertiarySystemFill"),
  } as const;
}

export type IosThreadListPalette = ReturnType<typeof iosThreadListPalette>;

export function iosAccountSwitchPalette() {
  return {
    textPrimary: PlatformColor("label"),
    textSecondary: PlatformColor("secondaryLabel"),
    cardBg: PlatformColor("secondarySystemGroupedBackground"),
  } as const;
}

export type IosAccountSwitchPalette = ReturnType<
  typeof iosAccountSwitchPalette
>;

export function iosIntroScreenPalette() {
  return {
    background: PlatformColor("systemGroupedBackground"),
    textPrimary: PlatformColor("label"),
    textSecondary: PlatformColor("secondaryLabel"),
    separator: PlatformColor("separator"),
    dotInactive: PlatformColor("systemGray4"),
  } as const;
}

export type IosIntroScreenPalette = ReturnType<typeof iosIntroScreenPalette>;

export function iosAccountFormPalette(): {
  background: ColorValue;
  textPrimary: ColorValue;
  textSecondary: ColorValue;
  separator: ColorValue;
  fieldBg: ColorValue;
  fieldBorder: ColorValue;
  fieldText: ColorValue;
  placeholder: ColorValue;
  error: ColorValue;
  primaryLabel: ColorValue;
  primaryButtonBg: ColorValue;
} {
  return {
    background: PlatformColor("systemGroupedBackground"),
    textPrimary: PlatformColor("label"),
    textSecondary: PlatformColor("secondaryLabel"),
    separator: PlatformColor("separator"),
    fieldBg: PlatformColor("secondarySystemGroupedBackground"),
    fieldBorder: PlatformColor("separator"),
    fieldText: PlatformColor("label"),
    placeholder: PlatformColor("placeholderText"),
    error: PlatformColor("systemRed"),
    /** Solid white on systemBlue — use hex; `PlatformColor("white")` is not a valid iOS dynamic token. */
    primaryLabel: "#ffffff",
    primaryButtonBg: PlatformColor("systemBlue"),
  };
}

export function swipeEditActionBackground(): ColorValue {
  return Platform.OS === "ios"
    ? PlatformColor("systemBlue")
    : appColors.systemBlueLight;
}

export function swipeDeleteActionBackground(): ColorValue {
  return Platform.OS === "ios"
    ? PlatformColor("systemRed")
    : appColors.destructive;
}

export function navigationChromeForScheme(
  scheme: "light" | "dark" | null | undefined,
): {
  headerStyle: { backgroundColor: ColorValue };
  headerTintColor: ColorValue;
  headerTitleStyle: { color: ColorValue };
  headerShadowVisible: boolean;
} {
  const dark = scheme === "dark";
  return {
    headerStyle: {
      backgroundColor: rootScreenBackgroundForScheme(scheme),
    },
    headerTintColor: systemBlueForScheme(scheme),
    headerTitleStyle: {
      color: headerTitleColorForScheme(scheme),
    },
    headerShadowVisible: !dark,
  };
}

export function tabNavigatorChromeForScheme(
  scheme: "light" | "dark" | null | undefined,
): {
  tabBarActiveTintColor: ColorValue;
  tabBarInactiveTintColor: ColorValue;
  tabBarStyle: { backgroundColor: ColorValue; borderTopColor: ColorValue };
} & ReturnType<typeof navigationChromeForScheme> {
  const dark = scheme === "dark";
  const nav = navigationChromeForScheme(scheme);
  const inactiveTint: ColorValue =
    Platform.OS === "ios"
      ? PlatformColor("secondaryLabel")
      : dark
        ? "rgba(235, 235, 245, 0.45)"
        : "#8e8e93";
  const borderTop: ColorValue =
    Platform.OS === "ios"
      ? PlatformColor("separator")
      : dark
        ? "rgba(255, 255, 255, 0.08)"
        : "rgba(60, 60, 67, 0.29)";
  return {
    ...nav,
    tabBarActiveTintColor: systemBlueForScheme(scheme),
    tabBarInactiveTintColor: inactiveTint,
    tabBarStyle: {
      backgroundColor: rootScreenBackgroundForScheme(scheme),
      borderTopColor: borderTop,
    },
  };
}
