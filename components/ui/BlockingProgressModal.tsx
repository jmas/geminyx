import {
  ActivityIndicator,
  Modal,
  Platform,
  PlatformColor,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
  type ColorValue,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useEffect, useMemo } from "react";

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
  const scheme = useColorScheme();
  const canDismiss = !blocking && !!onRequestClose;

  const progress = useSharedValue(0);

  const chrome = useMemo(() => {
    if (Platform.OS === "ios") {
      return {
        card: PlatformColor("systemBackground") as ColorValue,
        title: PlatformColor("label") as ColorValue,
        message: PlatformColor("secondaryLabel") as ColorValue,
        track: PlatformColor("systemGray5") as ColorValue,
        fill: PlatformColor("systemBlue") as ColorValue,
      };
    }
    const dark = scheme === "dark";
    return {
      card: dark ? "#1c1c1e" : "#ffffff",
      title: dark ? "#f2f2f7" : "#111827",
      message: dark ? "rgba(235, 235, 245, 0.75)" : "#374151",
      track: dark ? "#3a3a3c" : "#e5e7eb",
      fill: dark ? "#0a84ff" : "#3390ec",
    };
  }, [scheme]);
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
        <Pressable
          style={[styles.card, { backgroundColor: chrome.card }]}
          onPress={() => {}}
        >
          <ActivityIndicator size="large" color={chrome.fill} />
          <Text style={[styles.title, { color: chrome.title }]}>{title}</Text>
          {message ? (
            <Text style={[styles.message, { color: chrome.message }]}>
              {message}
            </Text>
          ) : null}
          {progressDurationMs ? (
            <View
              style={[styles.progressTrack, { backgroundColor: chrome.track }]}
            >
              <Animated.View
                style={[styles.progressFill, barStyle, { backgroundColor: chrome.fill }]}
              />
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
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  title: {
    marginTop: 12,
    fontSize: 17,
    fontWeight: "700",
    textAlign: "center",
  },
  message: {
    marginTop: 8,
    fontSize: 14,
    textAlign: "center",
  },
  progressTrack: {
    marginTop: 14,
    width: "100%",
    height: 8,
    borderRadius: 999,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    width: "100%",
    transformOrigin: "left",
  },
});

