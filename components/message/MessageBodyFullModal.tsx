import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
  type ColorValue,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { selectCapsuleUiPalette } from "components/capsule/capsuleUiPalette";
import {
  GemtextMessageBody,
  type GemtextLinkAction,
  type IncomingGemtextChrome,
} from "components/message/GemtextMessageBody";

export type MessageBodyFullModalProps = {
  /** Injected by react-popup-manager */
  isOpen: boolean;
  /** Injected by react-popup-manager (optional in types for `open()` props) */
  onClose?: () => void;
  body: string;
  baseUrl: string;
  textColor: ColorValue;
  linkColor: ColorValue;
  incomingGemtextChrome?: IncomingGemtextChrome;
  geminiLinksDisabled?: boolean;
  onLinkFollow?: (action: GemtextLinkAction, linkLabel: string) => void;
};

export function MessageBodyFullModal({
  isOpen,
  onClose,
  body,
  baseUrl,
  textColor,
  linkColor,
  incomingGemtextChrome = "light",
  geminiLinksDisabled,
  onLinkFollow,
}: MessageBodyFullModalProps) {
  const scheme = useColorScheme();
  const sheet = selectCapsuleUiPalette(scheme);
  const insets = useSafeAreaInsets();

  const dismiss = onClose ?? (() => {});

  function handleGemtextLink(
    action: GemtextLinkAction,
    linkLabel: string,
  ): void {
    dismiss();
    queueMicrotask(() => onLinkFollow?.(action, linkLabel));
  }

  return (
    <Modal
      visible={isOpen}
      animationType="slide"
      presentationStyle={Platform.OS === "ios" ? "pageSheet" : "fullScreen"}
      onRequestClose={dismiss}
    >
      <View style={[styles.root, { backgroundColor: sheet.background }]}>
        <View style={styles.grabberWrap}>
          <View
            style={[styles.grabber, { backgroundColor: sheet.sheetHandle }]}
          />
        </View>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <GemtextMessageBody
            body={body}
            textColor={textColor}
            linkColor={linkColor}
            baseUrl={baseUrl}
            isOutgoing={false}
            incomingChrome={incomingGemtextChrome}
            codeBlockTheme="terminal"
            linksDisabled={geminiLinksDisabled}
            onGemtextLink={handleGemtextLink}
          />
        </ScrollView>
        <View
          style={[
            styles.footer,
            {
              borderTopColor: sheet.separator,
              paddingBottom: Math.max(insets.bottom, 12),
              backgroundColor: sheet.background,
            },
          ]}
        >
          <Pressable
            onPress={dismiss}
            style={({ pressed }) => [
              styles.closeBtn,
              pressed && { opacity: 0.55 },
            ]}
            accessibilityLabel="Close"
          >
            <Text style={[styles.closeLabel, { color: sheet.cancelLabel }]}>
              Close
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  grabberWrap: {
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 4,
  },
  grabber: {
    width: 36,
    height: 5,
    borderRadius: 3,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    paddingTop: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtn: {
    minHeight: 44,
    minWidth: 120,
    justifyContent: "center",
    alignItems: "center",
  },
  closeLabel: {
    fontSize: 17,
    fontWeight: "600",
  },
});
