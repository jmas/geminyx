import { type ReactNode } from "react";
import ContextMenu from "react-native-context-menu-view";

export type MessageContextMenuBubbleProps = {
  children: ReactNode;
  disabled?: boolean;
  actionTitle: string;
  systemIcon: string;
  onRefetch: () => void;
};

/** iOS / Android: native context menu (UIMenu-style on iOS). */
export function MessageContextMenuBubble({
  children,
  disabled,
  actionTitle,
  systemIcon,
  onRefetch,
}: MessageContextMenuBubbleProps) {
  return (
    <ContextMenu
      actions={[{ title: actionTitle, systemIcon }]}
      onPress={(e) => {
        if (e.nativeEvent.index === 0) {
          onRefetch();
        }
      }}
      disabled={disabled}
    >
      {children}
    </ContextMenu>
  );
}
