import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View, type ColorValue } from "react-native";
import { blobMediaKind, type BlobMediaKind } from "lib/models/blobMedia";
import { formatByteCount } from "utils/formatBytes";

const KIND_THEME: Record<
  BlobMediaKind,
  { bg: string; border: string; icon: string }
> = {
  image: {
    bg: "rgba(37, 99, 235, 0.12)",
    border: "rgba(37, 99, 235, 0.28)",
    icon: "#2563eb",
  },
  audio: {
    bg: "rgba(126, 34, 206, 0.12)",
    border: "rgba(126, 34, 206, 0.28)",
    icon: "#7e22ce",
  },
  video: {
    bg: "rgba(220, 38, 38, 0.12)",
    border: "rgba(220, 38, 38, 0.28)",
    icon: "#dc2626",
  },
  other: {
    bg: "rgba(71, 85, 105, 0.14)",
    border: "rgba(71, 85, 105, 0.32)",
    icon: "#475569",
  },
};

function iconForKind(kind: BlobMediaKind): keyof typeof Ionicons.glyphMap {
  switch (kind) {
    case "image":
      return "image-outline";
    case "audio":
      return "musical-notes-outline";
    case "video":
      return "videocam-outline";
    default:
      return "document-outline";
  }
}

export type MessageAttachmentBubbleProps = {
  mimeType: string | undefined;
  byteLength: number | undefined;
  /** Stored filename (e.g. from Gemini URL path). */
  fileName?: string | undefined;
  outgoing: boolean;
  textColor: ColorValue;
  mutedColor: ColorValue;
  onPress?: () => void;
  /** Blob row exists but body is not yet the `[blob: …]` pointer. */
  pending?: boolean;
};

export function MessageAttachmentBubble({
  mimeType,
  byteLength,
  fileName,
  outgoing,
  textColor,
  mutedColor,
  onPress,
  pending = false,
}: MessageAttachmentBubbleProps) {
  const { t } = useTranslation();
  const kind = blobMediaKind(mimeType ?? "");
  const theme = KIND_THEME[kind];
  const bytes = byteLength ?? 0;
  const sizeLabel = formatByteCount(bytes);
  const kindLabel = useMemo(() => {
    switch (kind) {
      case "image":
        return t("attachment.kindImage");
      case "audio":
        return t("attachment.kindAudio");
      case "video":
        return t("attachment.kindVideo");
      default:
        return t("attachment.kindFile");
    }
  }, [kind, t]);
  const trimmedName = fileName?.trim();
  const title = trimmedName || kindLabel;
  const mediaAndSize = `${kindLabel} · ${sizeLabel}`;
  const iconWrapBg = outgoing ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.06)";

  const card = (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.bg,
          borderColor: theme.border,
          opacity: pending ? 0.92 : 1,
        },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: iconWrapBg }]}>
        <Ionicons name={iconForKind(kind)} size={22} color={theme.icon} />
      </View>
      <View style={styles.textCol}>
        <Text
          selectable
          style={[styles.title, { color: textColor }]}
          numberOfLines={2}
        >
          {title}
        </Text>
        <Text
          selectable
          style={[styles.subtitle, { color: mutedColor }]}
          numberOfLines={2}
        >
          {mediaAndSize}
        </Text>
        {pending ? (
          <Text style={[styles.hint, { color: mutedColor }]}>
            {t("attachment.preparing")}
          </Text>
        ) : onPress ? (
          <Text style={[styles.hint, { color: mutedColor }]}>
            {t("attachment.tapToOpen")}
          </Text>
        ) : null}
      </View>
    </View>
  );

  if (onPress && !pending) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${mediaAndSize}`}
        onPress={onPress}
        style={({ pressed }) => [
          styles.pressable,
          { opacity: pressed ? 0.88 : 1 },
        ]}
      >
        {card}
      </Pressable>
    );
  }

  return (
    <View style={styles.pressable} accessibilityLabel={`${title}. ${mediaAndSize}`}>
      {card}
    </View>
  );
}

const styles = StyleSheet.create({
  pressable: {
    width: "100%",
    alignSelf: "stretch",
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    minWidth: 200,
    maxWidth: "100%",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignSelf: "stretch",
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  textCol: {
    flexShrink: 1,
    marginLeft: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: -0.28,
  },
  subtitle: {
    fontSize: 13,
    marginTop: 3,
    fontWeight: "500",
    fontVariant: ["tabular-nums"],
  },
  hint: {
    fontSize: 12,
    marginTop: 4,
    letterSpacing: -0.1,
  },
});
