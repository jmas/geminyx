import { type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Pressable, StyleSheet } from "react-native";

export type MessageContextMenuBubbleProps = {
  children: ReactNode;
  disabled?: boolean;
  actionTitle: string;
  /** SF Symbol name (iOS); ignored on web. */
  systemIcon: string;
  onRefetch: () => void;
};

/** Web: long-press → alert sheet (no native context menu module). */
export function MessageContextMenuBubble({
  children,
  disabled,
  actionTitle,
  systemIcon: _systemIcon,
  onRefetch,
}: MessageContextMenuBubbleProps) {
  const { t } = useTranslation();
  return (
    <Pressable
      style={styles.wrap}
      disabled={disabled}
      onLongPress={() => {
        if (disabled) return;
        Alert.alert(t("messageContextMenu.title"), undefined, [
          { text: actionTitle, onPress: onRefetch },
          { text: t("common.cancel"), style: "cancel" },
        ]);
      }}
      delayLongPress={450}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  /** Lets attachment / wide bubbles use full width allowed by the row (max 80%). */
  wrap: {
    alignSelf: "stretch",
    maxWidth: "100%",
  },
});
