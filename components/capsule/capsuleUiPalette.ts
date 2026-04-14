import type { CapsuleFormModalPalette } from "components/capsule/CapsuleForm";
import { appColors } from "lib/theme/appColors";
import { Platform, PlatformColor, type ColorValue } from "react-native";

/** Shared light/dark tokens for capsule list rows and add-capsule sheet (Android / web). */
export const capsuleUiPalette = {
  light: {
    background: "#ffffff",
    textPrimary: "#000000",
    textSecondary: "#8e8e93",
    separator: "rgba(60, 60, 67, 0.29)",
    rowPressed: "rgba(0, 0, 0, 0.04)",
    sheetTitle: "#000000",
    fieldBg: "#f2f2f7",
    fieldBorder: "rgba(60, 60, 67, 0.18)",
    fieldText: "#000000",
    placeholder: "#8e8e93",
    cancelLabel: "#007aff",
    addLabel: "#007aff",
    error: "#c62828",
    sheetHandle: "rgba(60, 60, 67, 0.3)",
  },
  dark: {
    background: appColors.screenDark,
    textPrimary: "#f2f2f7",
    textSecondary: "rgba(235, 235, 245, 0.55)",
    separator: "rgba(84, 84, 88, 0.55)",
    rowPressed: "rgba(255, 255, 255, 0.06)",
    sheetTitle: "#f2f2f7",
    fieldBg: "#1c1c1e",
    fieldBorder: "rgba(84, 84, 88, 0.45)",
    fieldText: "#f2f2f7",
    placeholder: "rgba(235, 235, 245, 0.45)",
    cancelLabel: "#0a84ff",
    addLabel: "#0a84ff",
    error: "#ff6b6b",
    sheetHandle: "rgba(235, 235, 245, 0.3)",
  },
} as const satisfies Record<
  "light" | "dark",
  CapsuleFormModalPalette & {
    textPrimary: ColorValue;
    rowPressed: ColorValue;
  }
>;

const capsuleUiPaletteIOS = {
  background: PlatformColor("systemBackground"),
  textPrimary: PlatformColor("label"),
  textSecondary: PlatformColor("secondaryLabel"),
  separator: PlatformColor("separator"),
  rowPressed: PlatformColor("tertiarySystemFill"),
  sheetTitle: PlatformColor("label"),
  fieldBg: PlatformColor("secondarySystemGroupedBackground"),
  fieldBorder: PlatformColor("separator"),
  fieldText: PlatformColor("label"),
  placeholder: PlatformColor("placeholderText"),
  cancelLabel: PlatformColor("systemBlue"),
  addLabel: PlatformColor("systemBlue"),
  error: PlatformColor("systemRed"),
  sheetHandle: PlatformColor("separator"),
} as const satisfies CapsuleFormModalPalette & {
  textPrimary: ColorValue;
  rowPressed: ColorValue;
};

export type CapsuleListRowPalette =
  | (typeof capsuleUiPalette)[keyof typeof capsuleUiPalette]
  | typeof capsuleUiPaletteIOS;

export function selectCapsuleUiPalette(
  scheme: "light" | "dark" | null | undefined,
): CapsuleListRowPalette {
  if (Platform.OS === "ios") {
    return capsuleUiPaletteIOS;
  }
  return scheme === "dark" ? capsuleUiPalette.dark : capsuleUiPalette.light;
}
