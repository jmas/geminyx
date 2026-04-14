import { type ReactNode, useCallback, useRef } from "react";
import {
  ActionSheetIOS,
  Alert,
  Platform,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { captureRef } from "react-native-view-shot";

export type CodeBlockContextMenuProps = {
  text: string;
  children: ReactNode;
  /** Optional label used in the fallback alert title. */
  title?: string;
  /** Optional override for image copy behavior (preferred on iOS). */
  onCopyImage?: () => Promise<void>;
  /**
   * A ref to the element to capture for "Copy as Image".
   * Use a `ScrollView` ref + `snapshotContentContainer: true` to include off-screen content.
   */
  captureTargetRef: React.RefObject<any>;
  /** Options passed to view-shot captureRef. */
  captureOptions?: {
    useRenderInContext?: boolean;
    width?: number;
    height?: number;
  };
};

async function copyText(text: string) {
  await Clipboard.setStringAsync(text);
}

function resolveCaptureTarget(
  ref: React.RefObject<any>,
  captureOptions?: CodeBlockContextMenuProps["captureOptions"],
) {
  const curr = ref.current;
  if (!curr) return ref;

  return curr;
}

async function copyRefAsPngToClipboard(
  ref: React.RefObject<any>,
  captureOptions?: CodeBlockContextMenuProps["captureOptions"],
) {
  const target = resolveCaptureTarget(ref, captureOptions);
  const base64 = await captureRef(target, {
    format: "png",
    quality: 1,
    result: "base64",
    useRenderInContext: captureOptions?.useRenderInContext,
    width: captureOptions?.width,
    height: captureOptions?.height,
  });

  if (!base64 || base64.length < 64) {
    throw new Error("Image capture returned empty data.");
  }

  await Clipboard.setImageAsync(base64);
}

export function CodeBlockContextMenu({
  text,
  children,
  title = "Code block",
  onCopyImage,
  captureTargetRef,
  captureOptions,
}: CodeBlockContextMenuProps) {
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const movedRef = useRef(false);

  const sizeReady =
    (captureOptions?.width == null ? true : captureOptions.width > 0) &&
    (captureOptions?.height == null ? true : captureOptions.height > 0);

  const handleAction = useCallback(
    async (action: "copy_text" | "copy_image") => {
      try {
        if (action === "copy_text") {
          await copyText(text);
          return;
        }
        if (action === "copy_image") {
          if (onCopyImage) {
            await onCopyImage();
            return;
          }
          if (!sizeReady) {
            throw new Error("Image is still rendering. Try again in a moment.");
          }
          if (!captureTargetRef.current)
            throw new Error("Capture target not available.");
          await copyRefAsPngToClipboard(captureTargetRef, captureOptions);
          return;
        }
      } catch (e) {
        const message =
          e instanceof Error
            ? e.message
            : action === "copy_image"
              ? "Could not copy image."
              : "Could not copy to clipboard.";
        Alert.alert(
          title,
          message,
          [{ text: "OK" }],
        );
      }
    },
    [captureOptions, captureTargetRef, onCopyImage, sizeReady, text, title],
  );

  const openMenu = useCallback(() => {
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title,
          options: ["Copy Text", "Copy as Image", "Cancel"],
          cancelButtonIndex: 2,
        },
        (buttonIndex) => {
          if (buttonIndex === 0) void handleAction("copy_text");
          if (buttonIndex === 1) void handleAction("copy_image");
        },
      );
      return;
    }

    Alert.alert(title, undefined, [
      { text: "Copy Text", onPress: () => void handleAction("copy_text") },
      { text: "Copy as Image", onPress: () => void handleAction("copy_image") },
      { text: "Cancel", style: "cancel" },
    ]);
  }, [handleAction, title]);

  return (
    <View
      onTouchStart={() => {
        movedRef.current = false;
        if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = setTimeout(() => {
          longPressTimerRef.current = null;
          if (!movedRef.current) openMenu();
        }, 450);
      }}
      onTouchMove={() => {
        movedRef.current = true;
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
      }}
      onTouchEnd={() => {
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
      }}
      onTouchCancel={() => {
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
      }}
    >
      {children}
    </View>
  );
}
