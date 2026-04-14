import type { CapsuleFormModalPalette } from "components/capsule/CapsuleForm";
import { semanticUiPaletteForScheme } from "lib/theme/semanticUi";
import { Platform, PlatformColor, type ColorValue } from "react-native";

function capsuleUiPaletteForAndroidOrWeb(
  scheme: "light" | "dark" | null | undefined,
): CapsuleFormModalPalette & {
  textPrimary: ColorValue;
  rowPressed: ColorValue;
  listRowSurface: ColorValue;
} {
  const s = semanticUiPaletteForScheme(scheme);
  return {
    background: s.systemGroupedBackground,
    listRowSurface: s.secondarySystemGroupedBackground,
    textPrimary: s.label,
    textSecondary: s.secondaryLabel,
    separator: s.separator,
    rowPressed: s.tertiarySystemFill,
    sheetTitle: s.label,
    fieldBg: s.secondarySystemGroupedBackground,
    fieldBorder: s.separator,
    fieldText: s.label,
    placeholder: s.placeholderText,
    cancelLabel: s.systemBlue,
    addLabel: s.systemBlue,
    error: s.systemRed,
    sheetHandle: s.separator,
  };
}

const capsuleUiPaletteIOS = {
  background: PlatformColor("systemGroupedBackground"),
  listRowSurface: PlatformColor("secondarySystemGroupedBackground"),
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
  listRowSurface: ColorValue;
};

export type CapsuleListRowPalette =
  | ReturnType<typeof capsuleUiPaletteForAndroidOrWeb>
  | typeof capsuleUiPaletteIOS;

export function selectCapsuleUiPalette(
  scheme: "light" | "dark" | null | undefined,
): CapsuleListRowPalette {
  if (Platform.OS === "ios") {
    return capsuleUiPaletteIOS;
  }
  return capsuleUiPaletteForAndroidOrWeb(scheme);
}
