import { Platform } from "react-native";
import type { AccountFormPalette } from "components/account/AccountForm";
import { iosAccountFormPalette, systemBlueForScheme } from "lib/theme/appColors";
import { semanticUiPaletteForScheme } from "lib/theme/semanticUi";

export function accountFormPaletteForScheme(
  scheme: "light" | "dark" | null | undefined,
): AccountFormPalette {
  if (Platform.OS === "ios") {
    return iosAccountFormPalette();
  }
  const s = semanticUiPaletteForScheme(scheme);
  return {
    background: s.systemGroupedBackground,
    textPrimary: s.label,
    textSecondary: s.secondaryLabel,
    separator: s.separator,
    fieldBg: s.secondarySystemGroupedBackground,
    fieldBorder: s.separator,
    fieldText: s.label,
    placeholder: s.placeholderText,
    error: s.systemRed,
    primaryLabel: "#ffffff",
    primaryButtonBg: systemBlueForScheme(scheme),
  };
}
