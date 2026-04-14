import type { Theme } from "rn-emoji-keyboard/lib/typescript/contexts/KeyboardContext";
import { capsuleUiPalette } from "components/capsule/capsuleUiPalette";

/** Theme for `rn-emoji-keyboard` aligned with capsule form light/dark tokens (string colors only). */
export function rnEmojiKeyboardTheme(
  scheme: "light" | "dark" | null | undefined,
): Theme {
  const base = scheme === "dark" ? capsuleUiPalette.dark : capsuleUiPalette.light;
  return {
    backdrop: "rgba(0,0,0,0.45)",
    knob: scheme === "dark" ? "#3a3a3c" : "#e5e5ea",
    container: base.fieldBg,
    header: base.textSecondary,
    skinTonesContainer: scheme === "dark" ? "#2c2c2e" : "#e3dbcd",
    category: {
      icon: base.fieldText,
      iconActive: base.addLabel,
      container: base.background,
      containerActive: base.fieldBg,
    },
    search: {
      background: scheme === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
      text: base.fieldText,
      placeholder: base.placeholder,
      icon: base.textSecondary,
    },
    customButton: {
      icon: base.fieldText,
      iconPressed: base.addLabel,
      background: scheme === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
      backgroundPressed: scheme === "dark" ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)",
    },
    emoji: {
      selected: scheme === "dark" ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)",
    },
  };
}
