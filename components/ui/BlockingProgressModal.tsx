import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useEffect } from "react";

export type BlockingProgressModalProps = {
  visible: boolean;
  title: string;
  message?: string;
  /**
   * Animate progress 0→0.95 over this duration (ms), on the UI thread.
   * When omitted, no progress bar is shown.
   */
  progressDurationMs?: number;
  /** Change this value to restart the animation. */
  progressKey?: number;
  /** When true, disables dismissal by tapping backdrop. */
  blocking?: boolean;
  onRequestClose?: () => void;
};

export function BlockingProgressModal({
  visible,
  title,
  message,
  progressDurationMs,
  progressKey,
  blocking = true,
  onRequestClose,
}: BlockingProgressModalProps) {
  const canDismiss = !blocking && !!onRequestClose;

  const progress = useSharedValue(0);
  useEffect(() => {
    if (!visible || !progressDurationMs || progressDurationMs <= 0) return;
    // Reset and run a native-driven animation. Once started, it continues even if JS is busy.
    progress.value = 0;
    progress.value = withTiming(0.95, {
      duration: progressDurationMs,
      easing: Easing.linear,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, progressDurationMs, progressKey]);

  const barStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: Math.max(0, Math.min(1, progress.value)) }],
  }));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onRequestClose}
    >
      <Pressable
        style={styles.backdrop}
        onPress={canDismiss ? onRequestClose : undefined}
      >
        <Pressable style={styles.card} onPress={() => {}}>
          <ActivityIndicator size="large" />
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          {progressDurationMs ? (
            <View style={styles.progressTrack}>
              <Animated.View style={[styles.progressFill, barStyle]} />
            </View>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  title: {
    marginTop: 12,
    fontSize: 17,
    fontWeight: "700",
    textAlign: "center",
    color: "#111827",
  },
  message: {
    marginTop: 8,
    fontSize: 14,
    textAlign: "center",
    color: "#374151",
  },
  progressTrack: {
    marginTop: 14,
    width: "100%",
    height: 8,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "#e5e7eb",
  },
  progressFill: {
    height: "100%",
    width: "100%",
    transformOrigin: "left",
    backgroundColor: "#3390ec",
  },
});

