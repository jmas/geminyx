import type { Theme } from "rn-emoji-keyboard/lib/typescript/contexts/KeyboardContext";
import {
  androidDarkSurfaces,
  modalBackdropScrim,
  semanticUiAndroidDark,
  semanticUiAndroidLight,
} from "lib/theme/semanticUi";

/** Theme for `rn-emoji-keyboard` (string colors only — matches semantic Android fallbacks). */
export function rnEmojiKeyboardTheme(
  scheme: "light" | "dark" | null | undefined,
): Theme {
  const dark = scheme === "dark";
  const base = dark ? semanticUiAndroidDark : semanticUiAndroidLight;
  return {
    backdrop: modalBackdropScrim,
    knob: dark ? semanticUiAndroidDark.systemGray5 : "#e5e5ea",
    container: base.secondarySystemGroupedBackground,
    header: base.secondaryLabel,
    skinTonesContainer: dark ? androidDarkSurfaces.tertiaryGrouped : "#e3dbcd",
    category: {
      icon: base.label,
      iconActive: base.systemBlue,
      container: base.systemBackground,
      containerActive: base.secondarySystemGroupedBackground,
    },
    search: {
      background: dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
      text: base.label,
      placeholder: base.placeholderText,
      icon: base.secondaryLabel,
    },
    customButton: {
      icon: base.label,
      iconPressed: base.systemBlue,
      background: dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
      backgroundPressed: dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)",
    },
    emoji: {
      selected: dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)",
    },
  };
}
