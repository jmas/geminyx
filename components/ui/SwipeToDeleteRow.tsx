import { Ionicons } from "@expo/vector-icons";
import type { ReactNode, RefObject } from "react";
import { useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";

export type SwipeToDeleteRowProps = {
  children: ReactNode;
  /** Called when user taps the red delete action (after row snaps closed). */
  onDeletePress: () => void;
  /** When another row opens, the previously open instance is closed. */
  openRegistryRef?: RefObject<SwipeableMethods | null>;
  disabled?: boolean;
};

export function SwipeToDeleteRow({
  children,
  onDeletePress,
  openRegistryRef,
  disabled,
}: SwipeToDeleteRowProps) {
  const selfRef = useRef<SwipeableMethods | null>(null);

  if (disabled) {
    return <>{children}</>;
  }

  return (
    <ReanimatedSwipeable
      ref={selfRef}
      friction={2}
      overshootRight={false}
      childrenContainerStyle={styles.childFill}
      renderRightActions={(_progress, _translation, swipeableMethods) => (
        <View style={styles.actionsWrap}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Delete"
            style={styles.deleteAction}
            onPress={() => {
              swipeableMethods.close();
              onDeletePress();
            }}
          >
            <Ionicons name="trash-outline" color="#ffffff" size={22} />
            <Text style={styles.deleteLabel}>Delete</Text>
          </Pressable>
        </View>
      )}
      onSwipeableWillOpen={() => {
        const prev = openRegistryRef?.current;
        if (prev && prev !== selfRef.current) {
          prev.close();
        }
        if (openRegistryRef) {
          openRegistryRef.current = selfRef.current;
        }
      }}
      onSwipeableClose={() => {
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
    justifyContent: "center",
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
  deleteLabel: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 4,
  },
});
