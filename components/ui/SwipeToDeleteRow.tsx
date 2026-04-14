import { Ionicons } from "@expo/vector-icons";
import type { ReactNode, RefObject } from "react";
import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import ReanimatedSwipeable, {
  SwipeDirection,
  type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";

export type SwipeToDeleteRowProps = {
  children: ReactNode;
  /** Called when user taps the red delete action (after row snaps closed). */
  onDeletePress: () => void;
  /** Called when user taps edit action (after row snaps closed). */
  onEditPress?: () => void;
  /** When another row opens, the previously open instance is closed. */
  openRegistryRef?: RefObject<SwipeableMethods | null>;
  disabled?: boolean;
};

export function SwipeToDeleteRow({
  children,
  onDeletePress,
  onEditPress,
  openRegistryRef,
  disabled,
}: SwipeToDeleteRowProps) {
  const selfRef = useRef<SwipeableMethods | null>(null);
  const actionsWidth = (onEditPress ? 2 : 1) * 88;
  const [isOpenRight, setIsOpenRight] = useState(false);
  const isOpenRightRef = useRef(false);

  if (disabled) {
    return <>{children}</>;
  }

  return (
    <ReanimatedSwipeable
      ref={selfRef}
      friction={2}
      overshootRight={false}
      rightThreshold={actionsWidth * 0.4}
      childrenContainerStyle={styles.childFill}
      renderRightActions={(_progress, _translation, swipeableMethods) => (
        <View
          style={[styles.actionsWrap, { width: actionsWidth }]}
          pointerEvents="box-only"
        >
          {onEditPress ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Edit"
              style={[styles.editAction, !isOpenRight && styles.actionDisabled]}
              onPressIn={(e) => e.stopPropagation()}
              onPress={() => {
                if (!isOpenRightRef.current) return;
                swipeableMethods.close();
                setTimeout(() => onEditPress(), 0);
              }}
            >
              <Ionicons name="pencil" color="#ffffff" size={20} />
              <Text style={styles.actionLabel}>Edit</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Delete"
            style={[styles.deleteAction, !isOpenRight && styles.actionDisabled]}
            onPressIn={(e) => e.stopPropagation()}
            onPress={() => {
              if (!isOpenRightRef.current) return;
              swipeableMethods.close();
              setTimeout(() => onDeletePress(), 0);
            }}
          >
            <Ionicons name="trash-outline" color="#ffffff" size={22} />
            <Text style={styles.actionLabel}>Delete</Text>
          </Pressable>
        </View>
      )}
      onSwipeableOpen={(direction) => {
        // Opening right actions happens by swiping LEFT.
        if (direction === SwipeDirection.LEFT) {
          isOpenRightRef.current = true;
          setIsOpenRight(true);
        }
      }}
      onSwipeableWillOpen={() => {
        // Hide actions during drag/open animation; reveal once fully open.
        isOpenRightRef.current = false;
        setIsOpenRight(false);

        const prev = openRegistryRef?.current;
        if (prev && prev !== selfRef.current) {
          prev.close();
        }
        if (openRegistryRef) {
          openRegistryRef.current = selfRef.current;
        }
      }}
      onSwipeableClose={() => {
        isOpenRightRef.current = false;
        setIsOpenRight(false);
        if (openRegistryRef?.current === selfRef.current) {
          openRegistryRef.current = null;
        }
      }}
    >
      {children}
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  childFill: {
    flex: 1,
  },
  actionsWrap: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "stretch",
    height: "100%",
  },
  editAction: {
    backgroundColor: "#3390ec",
    justifyContent: "center",
    alignItems: "center",
    width: 88,
    height: "100%",
    minHeight: 72,
    paddingHorizontal: 8,
  },
  deleteAction: {
    backgroundColor: "#ff3b30",
    justifyContent: "center",
    alignItems: "center",
    width: 88,
    height: "100%",
    minHeight: 72,
    paddingHorizontal: 8,
  },
  actionDisabled: {
    opacity: 0.35,
  },
  actionLabel: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 4,
  },
});
