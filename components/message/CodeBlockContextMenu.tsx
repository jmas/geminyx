import { type ReactNode, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  ActionSheetIOS,
  Alert,
  Platform,
  View,
} from "react-native";
import { setImageAsync, setStringAsync } from "lib/clipboard";

/** Stable `Error.message` values mapped to i18n in the menu handler. */
const CODEBLOCK_ERR = {
  RENDERING: "CODEBLOCK_RENDERING",
  NO_CAPTURE: "CODEBLOCK_NO_CAPTURE",
  CAPTURE_EMPTY: "CODEBLOCK_CAPTURE_EMPTY",
} as const;

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
  await setStringAsync(text);
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
  const { captureRef } = await import("react-native-view-shot");
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
    throw new Error(CODEBLOCK_ERR.CAPTURE_EMPTY);
  }

  await setImageAsync(base64);
}

export function CodeBlockContextMenu({
  text,
  children,
  title,
  onCopyImage,
  captureTargetRef,
  captureOptions,
}: CodeBlockContextMenuProps) {
  const { t } = useTranslation();
  const menuTitle = title ?? t("codeBlock.titleDefault");
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
            throw new Error(CODEBLOCK_ERR.RENDERING);
          }
          if (!captureTargetRef.current)
            throw new Error(CODEBLOCK_ERR.NO_CAPTURE);
          await copyRefAsPngToClipboard(captureTargetRef, captureOptions);
          return;
        }
      } catch (e) {
        let message: string;
        if (e instanceof Error) {
          if (e.message === CODEBLOCK_ERR.RENDERING) {
            message = t("codeBlock.errorImageRendering");
          } else if (e.message === CODEBLOCK_ERR.NO_CAPTURE) {
            message = t("codeBlock.errorNoCapture");
          } else if (e.message === CODEBLOCK_ERR.CAPTURE_EMPTY) {
            message = t("codeBlock.errorCopyImage");
          } else {
            message =
              action === "copy_image"
                ? t("codeBlock.errorCopyImage")
                : t("codeBlock.errorCopyText");
          }
        } else {
          message =
            action === "copy_image"
              ? t("codeBlock.errorCopyImage")
              : t("codeBlock.errorCopyText");
        }
        Alert.alert(menuTitle, message, [{ text: t("common.ok") }]);
      }
    },
    [
      captureOptions,
      captureTargetRef,
      menuTitle,
      onCopyImage,
      sizeReady,
      t,
      text,
    ],
  );

  const openMenu = useCallback(() => {
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: menuTitle,
          options: [
            t("codeBlock.copyText"),
            t("codeBlock.copyAsImage"),
            t("common.cancel"),
          ],
          cancelButtonIndex: 2,
        },
        (buttonIndex) => {
          if (buttonIndex === 0) void handleAction("copy_text");
          if (buttonIndex === 1) void handleAction("copy_image");
        },
      );
      return;
    }

    Alert.alert(menuTitle, undefined, [
      {
        text: t("codeBlock.copyText"),
        onPress: () => void handleAction("copy_text"),
      },
      {
        text: t("codeBlock.copyAsImage"),
        onPress: () => void handleAction("copy_image"),
      },
      { text: t("common.cancel"), style: "cancel" },
    ]);
  }, [handleAction, menuTitle, t]);

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
