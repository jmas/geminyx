/**
 * Single source for UI colors: iOS uses UIColor dynamic tokens via PlatformColor;
 * Android / web use hex fallbacks aligned with Apple’s light/dark values.
 */

import { Platform, PlatformColor, type ColorValue } from "react-native";
import {
  appColors,
  iosScreenContentPalette,
  iosThreadListPalette,
  systemBlueForScheme,
} from "lib/theme/appColors";

/** Standard modal / sheet dimming (matches iOS sheet presentation feel). */
export const modalBackdropScrim = "rgba(0, 0, 0, 0.45)" as const;

/**
 * Dark mode surface scale for Android / web (hex), aligned with iOS UIColor dark values:
 * systemBackground → secondarySystemGrouped → tertiarySystemGrouped → systemGray5.
 */
export const androidDarkSurfaces = {
  systemBackground: appColors.screenDark,
  secondaryGrouped: "#1c1c1e",
  tertiaryGrouped: "#2c2c2e",
  systemGray5: "#3a3a3c",
} as const;

/** Android / web fallbacks (hex strings) for libs that cannot use `PlatformColor`. */
export const semanticUiAndroidLight = {
  label: "#000000",
  secondaryLabel: "#3c3c43",
  tertiaryLabel: "#aeaeb2",
  separator: "rgba(60, 60, 67, 0.29)",
  /** Outer grouped list / settings canvas (iOS `systemGroupedBackground`). */
  systemGroupedBackground: appColors.screenGroupedLight,
  /** Primary white surface (modals, composer bar on white). */
  systemBackground: "#ffffff",
  /** Grouped rows / cards on gray outer (iOS light ≈ white). */
  secondarySystemGroupedBackground: "#ffffff",
  placeholderText: "rgba(60, 60, 67, 0.45)",
  link: appColors.systemBlueLight,
  systemBlue: appColors.systemBlueLight,
  systemRed: appColors.destructive,
  tertiarySystemFill: "rgba(0, 0, 0, 0.04)",
  systemGray4: "rgba(120, 120, 128, 0.35)",
  systemGray5: "#e5e7eb",
} as const;

export const semanticUiAndroidDark = {
  label: "#f2f2f7",
  secondaryLabel: "rgba(235, 235, 245, 0.55)",
  tertiaryLabel: "rgba(235, 235, 245, 0.35)",
  separator: "rgba(255, 255, 255, 0.12)",
  systemGroupedBackground: androidDarkSurfaces.systemBackground,
  systemBackground: androidDarkSurfaces.systemBackground,
  secondarySystemGroupedBackground: androidDarkSurfaces.secondaryGrouped,
  placeholderText: "rgba(235, 235, 245, 0.45)",
  link: appColors.systemBlueDark,
  systemBlue: appColors.systemBlueDark,
  systemRed: appColors.destructive,
  tertiarySystemFill: "rgba(255, 255, 255, 0.06)",
  systemGray4: "rgba(235, 235, 245, 0.25)",
  systemGray5: androidDarkSurfaces.systemGray5,
} as const;

export type SemanticUiPalette = {
  label: ColorValue;
  secondaryLabel: ColorValue;
  tertiaryLabel: ColorValue;
  separator: ColorValue;
  systemGroupedBackground: ColorValue;
  systemBackground: ColorValue;
  secondarySystemGroupedBackground: ColorValue;
  placeholderText: ColorValue;
  link: ColorValue;
  systemBlue: ColorValue;
  systemRed: ColorValue;
  tertiarySystemFill: ColorValue;
  systemGray4: ColorValue;
  systemGray5: ColorValue;
};

export function semanticUiPaletteForScheme(
  scheme: "light" | "dark" | null | undefined,
): SemanticUiPalette {
  if (Platform.OS === "ios") {
    return {
      label: PlatformColor("label"),
      secondaryLabel: PlatformColor("secondaryLabel"),
      tertiaryLabel: PlatformColor("tertiaryLabel"),
      separator: PlatformColor("separator"),
      systemGroupedBackground: PlatformColor("systemGroupedBackground"),
      systemBackground: PlatformColor("systemBackground"),
      secondarySystemGroupedBackground: PlatformColor(
        "secondarySystemGroupedBackground",
      ),
      placeholderText: PlatformColor("placeholderText"),
      link: PlatformColor("link"),
      systemBlue: PlatformColor("systemBlue"),
      systemRed: PlatformColor("systemRed"),
      tertiarySystemFill: PlatformColor("tertiarySystemFill"),
      systemGray4: PlatformColor("systemGray4"),
      systemGray5: PlatformColor("systemGray5"),
    };
  }
  return scheme === "dark" ? semanticUiAndroidDark : semanticUiAndroidLight;
}

export function destructivePressedOverlayForScheme(
  scheme: "light" | "dark" | null | undefined,
): ColorValue {
  return scheme === "dark"
    ? "rgba(255, 107, 107, 0.15)"
    : "rgba(255, 59, 48, 0.12)";
}

export type ThreadListRowPalette = {
  background: ColorValue;
  listRowSurface: ColorValue;
  textPrimary: ColorValue;
  textSecondary: ColorValue;
  separator: ColorValue;
  rowPressed: ColorValue;
};

export function threadListPaletteForScheme(
  scheme: "light" | "dark" | null | undefined,
): ReturnType<typeof iosThreadListPalette> | ThreadListRowPalette {
  if (Platform.OS === "ios") {
    return iosThreadListPalette();
  }
  const s = semanticUiPaletteForScheme(scheme);
  return {
    background: s.systemGroupedBackground,
    listRowSurface: s.secondarySystemGroupedBackground,
    textPrimary: s.label,
    textSecondary: s.secondaryLabel,
    separator: s.separator,
    rowPressed: s.tertiarySystemFill,
  };
}

export function screenContentListPaletteForScheme(
  scheme: "light" | "dark" | null | undefined,
): ReturnType<typeof iosScreenContentPalette> {
  if (Platform.OS === "ios") {
    return iosScreenContentPalette();
  }
  const s = semanticUiPaletteForScheme(scheme);
  return {
    background: s.systemGroupedBackground,
    textPrimary: s.label,
    textSecondary: s.secondaryLabel,
    textTertiary: s.tertiaryLabel,
    profilePressed: s.tertiarySystemFill,
    cardBg: s.secondarySystemGroupedBackground,
    separator: s.separator,
    rowPressed: s.tertiarySystemFill,
  } as ReturnType<typeof iosScreenContentPalette>;
}

export type CertificateScreenPalette = {
  background: ColorValue;
  textPrimary: ColorValue;
  textSecondary: ColorValue;
  textTertiary: ColorValue;
  separator: ColorValue;
  fieldBg: ColorValue;
  fieldBorder: ColorValue;
  danger: ColorValue;
  dangerPressed: ColorValue;
  rowPressed: ColorValue;
};

export function certificateScreenPaletteForScheme(
  scheme: "light" | "dark" | null | undefined,
): CertificateScreenPalette {
  if (Platform.OS === "ios") {
    return {
      background: PlatformColor("systemGroupedBackground"),
      textPrimary: PlatformColor("label"),
      textSecondary: PlatformColor("secondaryLabel"),
      textTertiary: PlatformColor("tertiaryLabel"),
      separator: PlatformColor("separator"),
      fieldBg: PlatformColor("secondarySystemGroupedBackground"),
      fieldBorder: PlatformColor("separator"),
      danger: PlatformColor("systemRed"),
      dangerPressed: destructivePressedOverlayForScheme(scheme),
      rowPressed: PlatformColor("tertiarySystemFill"),
    };
  }
  const s = semanticUiPaletteForScheme(scheme);
  return {
    background: s.systemGroupedBackground,
    textPrimary: s.label,
    textSecondary: s.secondaryLabel,
    textTertiary: s.tertiaryLabel,
    separator: s.separator,
    fieldBg: s.secondarySystemGroupedBackground,
    fieldBorder: s.separator,
    danger: s.systemRed,
    dangerPressed: destructivePressedOverlayForScheme(scheme),
    rowPressed: s.tertiarySystemFill,
  };
}

export type DeveloperScreenPalette = {
  background: ColorValue;
  textPrimary: ColorValue;
  textSecondary: ColorValue;
  danger: ColorValue;
  dangerPressed: ColorValue;
  cardBg: ColorValue;
};

export function developerScreenPaletteForScheme(
  scheme: "light" | "dark" | null | undefined,
): DeveloperScreenPalette {
  if (Platform.OS === "ios") {
    return {
      background: PlatformColor("systemGroupedBackground"),
      textPrimary: PlatformColor("label"),
      textSecondary: PlatformColor("secondaryLabel"),
      danger: PlatformColor("systemRed"),
      dangerPressed: destructivePressedOverlayForScheme(scheme),
      cardBg: PlatformColor("secondarySystemGroupedBackground"),
    };
  }
  const s = semanticUiPaletteForScheme(scheme);
  return {
    background: s.systemGroupedBackground,
    textPrimary: s.label,
    textSecondary: s.secondaryLabel,
    danger: s.systemRed,
    dangerPressed: destructivePressedOverlayForScheme(scheme),
    cardBg: s.secondarySystemGroupedBackground,
  };
}

export type ThreadConversationPalette = {
  screenBg: ColorValue;
  bubbleIncoming: ColorValue;
  bubbleOutgoing: ColorValue;
  textIncoming: ColorValue;
  textOutgoing: ColorValue;
  timeIncoming: ColorValue;
  timeOutgoing: ColorValue;
  composerBarBg: ColorValue;
  composerFieldBg: ColorValue;
  composerBorder: ColorValue;
  composerPlaceholder: ColorValue;
  composerText: ColorValue;
  icon: ColorValue;
  iconSend: ColorValue;
  linkIncoming: ColorValue;
  linkOutgoing: ColorValue;
  viewFullBtnBg: ColorValue;
  viewFullBtnBorder: ColorValue;
  viewFullBtnLabel: ColorValue;
};

const textOnBlue = "#ffffff";

export function threadConversationPaletteForScheme(
  scheme: "light" | "dark" | null | undefined,
): ThreadConversationPalette {
  const blue = systemBlueForScheme(scheme);
  if (Platform.OS === "ios") {
    const link = PlatformColor("link");
    return {
      screenBg: PlatformColor("systemGroupedBackground"),
      bubbleIncoming: PlatformColor("secondarySystemGroupedBackground"),
      bubbleOutgoing: blue,
      textIncoming: PlatformColor("label"),
      textOutgoing: textOnBlue,
      timeIncoming: PlatformColor("tertiaryLabel"),
      timeOutgoing: "rgba(255, 255, 255, 0.75)",
      composerBarBg: PlatformColor("systemBackground"),
      composerFieldBg: PlatformColor("secondarySystemGroupedBackground"),
      composerBorder: PlatformColor("separator"),
      composerPlaceholder: PlatformColor("placeholderText"),
      composerText: PlatformColor("label"),
      icon: PlatformColor("secondaryLabel"),
      iconSend: blue,
      linkIncoming: link,
      linkOutgoing: "rgba(255, 255, 255, 0.96)",
      viewFullBtnBg: PlatformColor("secondarySystemGroupedBackground"),
      viewFullBtnBorder: PlatformColor("separator"),
      viewFullBtnLabel: blue,
    };
  }
  const s = semanticUiPaletteForScheme(scheme);
  if (scheme === "dark") {
    return {
      screenBg: s.systemGroupedBackground,
      bubbleIncoming: s.secondarySystemGroupedBackground,
      bubbleOutgoing: s.systemBlue,
      textIncoming: s.label,
      textOutgoing: textOnBlue,
      timeIncoming: s.tertiaryLabel,
      timeOutgoing: "rgba(255, 255, 255, 0.75)",
      composerBarBg: s.systemBackground,
      composerFieldBg: s.secondarySystemGroupedBackground,
      composerBorder: s.separator,
      composerPlaceholder: s.placeholderText,
      composerText: s.label,
      icon: s.secondaryLabel,
      iconSend: s.systemBlue,
      linkIncoming: s.link,
      linkOutgoing: "rgba(255, 255, 255, 0.96)",
      viewFullBtnBg: s.secondarySystemGroupedBackground,
      viewFullBtnBorder: s.separator,
      viewFullBtnLabel: s.systemBlue,
    };
  }
  return {
    screenBg: s.systemGroupedBackground,
    bubbleIncoming: "#ffffff",
    bubbleOutgoing: s.systemBlue,
    textIncoming: s.label,
    textOutgoing: textOnBlue,
    timeIncoming: "rgba(0, 0, 0, 0.45)",
    timeOutgoing: "rgba(255, 255, 255, 0.75)",
    composerBarBg: s.systemBackground,
    composerFieldBg: s.secondarySystemGroupedBackground,
    composerBorder: s.separator,
    composerPlaceholder: "#8e8e93",
    composerText: s.label,
    icon: "#8a8a8e",
    iconSend: s.systemBlue,
    linkIncoming: "#1d4ed8",
    linkOutgoing: "rgba(255, 255, 255, 0.96)",
    viewFullBtnBg: "#ffffff",
    viewFullBtnBorder: "rgba(60, 60, 67, 0.22)",
    viewFullBtnLabel: s.systemBlue,
  };
}

export type BlockingProgressChrome = {
  card: ColorValue;
  title: ColorValue;
  message: ColorValue;
  track: ColorValue;
  fill: ColorValue;
};

export function blockingProgressChromeForScheme(
  scheme: "light" | "dark" | null | undefined,
): BlockingProgressChrome {
  if (Platform.OS === "ios") {
    return {
      card: PlatformColor("systemBackground"),
      title: PlatformColor("label"),
      message: PlatformColor("secondaryLabel"),
      track: PlatformColor("systemGray5"),
      fill: PlatformColor("systemBlue"),
    };
  }
  const s = semanticUiPaletteForScheme(scheme);
  return {
    card: s.systemBackground,
    title: s.label,
    message: s.secondaryLabel,
    track: s.systemGray5,
    fill: s.systemBlue,
  };
}
