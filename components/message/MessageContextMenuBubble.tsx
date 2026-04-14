import { type ReactNode } from "react";
import { Alert, Pressable } from "react-native";

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
  return (
    <Pressable
      disabled={disabled}
      onLongPress={() => {
        if (disabled) return;
        Alert.alert("Message", undefined, [
          { text: actionTitle, onPress: onRefetch },
          { text: "Cancel", style: "cancel" },
        ]);
      }}
      delayLongPress={450}
    >
      {children}
    </Pressable>
  );
}
