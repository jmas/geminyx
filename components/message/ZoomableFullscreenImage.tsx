import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo } from "react";
import {
  Dimensions,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  clamp,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type ZoomableFullscreenImageProps = {
  visible: boolean;
  uri: string;
  onClose: () => void;
  /** When set, shows a share control next to the close button. */
  onSharePress?: () => void;
  /**
   * When true, renders only the viewer UI (no `Modal`). Use as a layer inside an
   * existing modal so it stacks above sheet content — nested `Modal`s are unreliable on iOS.
   */
  embedded?: boolean;
};

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const DOUBLE_TAP_SCALE = 2.5;
/** At 1× zoom, drag down past this distance (or fling fast) to close. */
const DISMISS_DRAG_PX = 120;
const DISMISS_VELOCITY_Y = 900;
const ZOOMED_EPS = 1.02;

const windowH = Dimensions.get("window").height;

/**
 * Full-screen image viewer with pinch-to-zoom and pan when zoomed.
 * Renders above other UI via `Modal` (use from a parent that already uses a sheet modal).
 */
export function ZoomableFullscreenImage({
  visible,
  uri,
  onClose,
  onSharePress,
  embedded = false,
}: ZoomableFullscreenImageProps) {
  const insets = useSafeAreaInsets();
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const dismissDragY = useSharedValue(0);

  useEffect(() => {
    if (!visible) {
      scale.value = 1;
      savedScale.value = 1;
      translateX.value = 0;
      translateY.value = 0;
      dismissDragY.value = 0;
    }
  }, [visible, dismissDragY, scale, savedScale, translateX, translateY]);

  const composed = useMemo(() => {
    const pinchGesture = Gesture.Pinch()
      .onStart(() => {
        savedScale.value = scale.value;
      })
      .onUpdate((e) => {
        scale.value = clamp(savedScale.value * e.scale, MIN_SCALE, MAX_SCALE);
      })
      .onEnd(() => {
        savedScale.value = scale.value;
        if (scale.value < 1.01) {
          scale.value = withTiming(1);
          savedScale.value = 1;
          translateX.value = withTiming(0);
          translateY.value = withTiming(0);
        }
      });

    const panGesture = Gesture.Pan()
      .maxPointers(1)
      .onStart(() => {
        startX.value = translateX.value;
        startY.value = translateY.value;
      })
      .onUpdate((e) => {
        if (scale.value > ZOOMED_EPS) {
          translateX.value = startX.value + e.translationX;
          translateY.value = startY.value + e.translationY;
          return;
        }
        dismissDragY.value = Math.max(0, e.translationY);
      })
      .onEnd((e) => {
        if (scale.value > ZOOMED_EPS) {
          return;
        }
        if (
          dismissDragY.value > DISMISS_DRAG_PX ||
          e.velocityY > DISMISS_VELOCITY_Y
        ) {
          runOnJS(onClose)();
        }
        dismissDragY.value = withTiming(0, { duration: 220 });
      });

    const doubleTapGesture = Gesture.Tap()
      .numberOfTaps(2)
      .onEnd(() => {
        const zoomed = scale.value > 1.05;
        if (zoomed) {
          scale.value = withTiming(1);
          savedScale.value = 1;
          translateX.value = withTiming(0);
          translateY.value = withTiming(0);
        } else {
          scale.value = withTiming(DOUBLE_TAP_SCALE);
          savedScale.value = DOUBLE_TAP_SCALE;
        }
      });

    return Gesture.Simultaneous(
      doubleTapGesture,
      Gesture.Simultaneous(pinchGesture, panGesture),
    );
  }, [onClose, savedScale, scale, startX, startY, translateX, translateY, dismissDragY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const dismissLayerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: dismissDragY.value }],
    opacity: interpolate(
      dismissDragY.value,
      [0, windowH * 0.35],
      [1, 0.55],
      Extrapolation.CLAMP,
    ),
  }));

  const body = (
    <GestureHandlerRootView style={styles.root}>
      {visible ? <StatusBar style="light" /> : null}
      <View style={styles.blackFill}>
        <Animated.View style={[styles.dismissLayer, dismissLayerStyle]}>
          <GestureDetector gesture={composed}>
            <Animated.View style={[styles.zoomLayer, animatedStyle]}>
              <Image
                source={{ uri }}
                style={styles.image}
                resizeMode="contain"
                accessibilityLabel="Attachment image"
                accessibilityIgnoresInvertColors
              />
            </Animated.View>
          </GestureDetector>

          <View style={styles.chromeOverlay} pointerEvents="box-none">
          {onSharePress ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Share image"
              onPress={onSharePress}
              style={({ pressed }) => [
                styles.chromeBtn,
                styles.shareBtn,
                {
                  top: insets.top + 8,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
              hitSlop={12}
            >
              <Ionicons name="share-outline" size={24} color="#ffffff" />
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close full screen"
            onPress={onClose}
            style={({ pressed }) => [
              styles.chromeBtn,
              styles.closeBtn,
              {
                top: insets.top + 8,
                opacity: pressed ? 0.75 : 1,
              },
            ]}
            hitSlop={12}
          >
            <Ionicons name="close" size={30} color="#ffffff" />
          </Pressable>
        </View>
        </Animated.View>
      </View>
    </GestureHandlerRootView>
  );

  if (embedded) {
    if (!visible) return null;
    return <View style={styles.embeddedWrap}>{body}</View>;
  }

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {body}
    </Modal>
  );
}

const styles = StyleSheet.create({
  embeddedWrap: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    elevation: 1000,
    backgroundColor: "#000000",
  },
  root: {
    flex: 1,
    backgroundColor: "#000000",
  },
  blackFill: {
    flex: 1,
    backgroundColor: "#000000",
  },
  dismissLayer: {
    flex: 1,
  },
  zoomLayer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  chromeOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  chromeBtn: {
    position: "absolute",
    zIndex: 2,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  shareBtn: {
    left: 12,
  },
  closeBtn: {
    right: 12,
  },
});
