import { Platform, StyleSheet, Text, View } from "react-native";
import { avatarHueFromId, initialsFromName } from "utils/avatar";

type Props = {
  capsuleId: string;
  name: string;
  /** Single emoji or short emoji sequence; when set, shown instead of initials */
  emoji?: string;
  size: number;
};

export function CapsuleAvatar({ capsuleId, name, emoji, size }: Props) {
  const hue = avatarHueFromId(capsuleId);
  const initials = initialsFromName(name);
  const trimmed = emoji?.trim() ?? "";
  const showEmoji = trimmed.length > 0;

  const radius = size / 2;
  const initialsFontSize = Math.max(12, Math.round(size * 0.36));
  /** Color emoji often draws outside the nominal line box — keep font modest + extra line height so `overflow: hidden` does not clip. */
  const emojiFontSize = Math.max(14, Math.round(size * 0.44));
  const emojiLineHeight = Math.round(emojiFontSize * 1.28);
  const emojiInset = Math.max(4, Math.round(size * 0.12));

  return (
    <View
      style={[
        styles.fallback,
        {
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: `hsl(${hue}, 42%, 46%)`,
        },
      ]}
      accessibilityLabel={`${name} avatar`}
    >
      {showEmoji ? (
        <View
          style={[styles.emojiWrap, { padding: emojiInset }]}
          pointerEvents="none"
        >
          <Text
            numberOfLines={1}
            allowFontScaling={false}
            style={[
              styles.emojiLabel,
              {
                fontSize: emojiFontSize,
                lineHeight: emojiLineHeight,
              },
              Platform.OS === "android"
                ? {
                    includeFontPadding: false,
                    textAlignVertical: "center",
                  }
                : null,
            ]}
          >
            {trimmed}
          </Text>
        </View>
      ) : (
        <Text style={[styles.initials, { fontSize: initialsFontSize }]}>{initials}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  /** Inset + flex center so glyphs stay inside the rounded clip (color emoji overshoots font metrics). */
  emojiWrap: {
    flex: 1,
    alignSelf: "stretch",
    justifyContent: "center",
    alignItems: "center",
  },
  emojiLabel: {
    textAlign: "center",
  },
  initials: {
    color: "#ffffff",
    fontWeight: "600",
  },
});
