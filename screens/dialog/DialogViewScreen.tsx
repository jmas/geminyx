import {
  useCreate,
  useDataProvider,
  useInvalidate,
  useOne,
  type HttpError,
} from "@refinedev/core";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { GemtextLinkAction } from "components/message/GemtextMessageBody";
import { MessageForm } from "components/message/MessageForm";
import {
  MessageList,
  type MessageListHandle,
} from "components/message/MessageList";
import {
  geminiOriginsMatch,
  geminiRequestPathForMessage,
  suggestedCapsuleNameFromGeminiUrl,
} from "lib/models/gemini";
import type { Capsule } from "lib/models/capsule";
import type { Dialog } from "lib/models/dialog";
import type { DialogMessage } from "lib/models/dialogMessage";
import { MESSAGES_PAGE_SIZE } from "lib/resources/messages";
import { RESOURCES } from "lib/refineDataProvider";
import type { CapsuleCreateVariables } from "lib/resources/capsules";
import { logDialogMessage } from "utils/dialogMessageLog";
import { useMessageCreate } from "hooks/message/useMessageCreate";
import { firstParam } from "utils/searchParams";
import { appColors, navigationChromeForScheme } from "lib/theme/appColors";

const colors = {
  light: {
    screenBg: "#e7ebf0",
    bubbleIncoming: "#ffffff",
    bubbleOutgoing: "#3390ec",
    textIncoming: "#000000",
    textOutgoing: "#ffffff",
    timeIncoming: "rgba(0, 0, 0, 0.45)",
    timeOutgoing: "rgba(255, 255, 255, 0.75)",
    composerBarBg: "#ffffff",
    composerFieldBg: "#f0f0f0",
    composerBorder: "rgba(0, 0, 0, 0.08)",
    composerPlaceholder: "#8e8e93",
    composerText: "#000000",
    icon: "#8a8a8e",
    iconSend: "#3390ec",
    linkIncoming: "#1d4ed8",
    linkOutgoing: "rgba(255, 255, 255, 0.96)",
    viewFullBtnBg: "#ffffff",
    viewFullBtnBorder: "rgba(60, 60, 67, 0.22)",
    viewFullBtnLabel: "#3390ec",
  },
  dark: {
    screenBg: appColors.screenDark,
    bubbleIncoming: "#2c2c2e",
    bubbleOutgoing: "#3390ec",
    textIncoming: "#f2f2f7",
    textOutgoing: "#ffffff",
    timeIncoming: "rgba(242, 242, 247, 0.5)",
    timeOutgoing: "rgba(255, 255, 255, 0.75)",
    composerBarBg: "#1c1c1e",
    composerFieldBg: "#3a3a3c",
    composerBorder: "rgba(255, 255, 255, 0.08)",
    composerPlaceholder: "rgba(235, 235, 245, 0.45)",
    composerText: "#f2f2f7",
    icon: "rgba(235, 235, 245, 0.5)",
    iconSend: "#5eb5f7",
    linkIncoming: "#64b5ff",
    linkOutgoing: "rgba(255, 255, 255, 0.95)",
    viewFullBtnBg: "#2c2c2e",
    viewFullBtnBorder: "rgba(255, 255, 255, 0.12)",
    viewFullBtnLabel: "#5eb5f7",
  },
} as const;

function findCapsuleForGeminiUrl(
  capsules: Capsule[],
  targetUrl: string,
): Capsule | undefined {
  return capsules.find(
    (c) => c.url?.trim() && geminiOriginsMatch(c.url, targetUrl),
  );
}

export function DialogViewScreen() {
  const navigation = useNavigation();
  const router = useRouter();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const listRef = useRef<MessageListHandle>(null);
  const messagesRef = useRef<DialogMessage[]>([]);
  const hasMoreOlderRef = useRef(false);
  const loadingOlderRef = useRef(false);
  const params = useLocalSearchParams<{ id: string; name?: string }>();
  const dialogId = firstParam(params.id) ?? "";
  const nameParam = firstParam(params.name);
  const scheme = useColorScheme();
  const palette = scheme === "dark" ? colors.dark : colors.light;

  const [messages, setMessages] = useState<DialogMessage[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);

  const dataProvider = useDataProvider();
  const getList = useMemo(() => dataProvider().getList, [dataProvider]);
  const invalidate = useInvalidate();
  const { mutateAsync: createCapsule } = useCreate<
    Capsule,
    HttpError,
    CapsuleCreateVariables
  >({
    resource: RESOURCES.capsules,
  });

  const dialogFilters = useMemo(
    () =>
      dialogId
        ? [
            {
              field: "dialog_id",
              operator: "eq" as const,
              value: dialogId,
            },
          ]
        : [],
    [dialogId],
  );

  messagesRef.current = messages;

  const loadInitialMessages = useCallback(async () => {
    if (!dialogId) return;
    setLoadingInitial(true);
    try {
      const { data, total } = await getList<DialogMessage>({
        resource: RESOURCES.messages,
        filters: dialogFilters,
        meta: {
          messagesPaging: {
            mode: "recent",
            limit: MESSAGES_PAGE_SIZE,
          },
        },
      });
      setMessages(data);
      const more =
        data.length === MESSAGES_PAGE_SIZE && total > data.length;
      hasMoreOlderRef.current = more;
    } finally {
      setLoadingInitial(false);
    }
  }, [dialogId, dialogFilters, getList]);

  const loadOlderMessages = useCallback(async () => {
    if (!dialogId || loadingOlderRef.current || !hasMoreOlderRef.current) {
      return;
    }
    const list = messagesRef.current;
    if (list.length === 0) return;
    const oldest = list[0];

    loadingOlderRef.current = true;
    setLoadingOlder(true);
    try {
      const { data } = await getList<DialogMessage>({
        resource: RESOURCES.messages,
        filters: dialogFilters,
        meta: {
          messagesPaging: {
            mode: "before",
            limit: MESSAGES_PAGE_SIZE,
            cursor: { sentAt: oldest.sentAt, id: oldest.id },
          },
        },
      });
      if (data.length < MESSAGES_PAGE_SIZE) {
        hasMoreOlderRef.current = false;
      }
      setMessages((prev) => {
        const ids = new Set(prev.map((m) => m.id));
        const fresh = data.filter((m) => !ids.has(m.id));
        return [...fresh, ...prev];
      });
    } finally {
      loadingOlderRef.current = false;
      setLoadingOlder(false);
    }
  }, [dialogId, dialogFilters, getList]);

  useEffect(() => {
    if (!dialogId) {
      setMessages([]);
      hasMoreOlderRef.current = false;
      return;
    }
    void loadInitialMessages();
  }, [dialogId, loadInitialMessages]);

  const { result: dialogRow } = useOne<Dialog>({
    resource: RESOURCES.dialogs,
    id: dialogId,
    queryOptions: { enabled: !!dialogId },
  });

  const capsuleUrl = dialogRow?.capsule?.url?.trim() ?? "";

  const scheduleScrollToEnd = useCallback(() => {
    requestAnimationFrame(() =>
      listRef.current?.scrollToEnd({ animated: true }),
    );
  }, []);

  const { flowPending, submitMessageFlow } = useMessageCreate({
    dialogId,
    capsuleUrl,
    messagesRef,
    setMessages,
    scheduleScrollToEnd,
  });

  const onGemtextLink = useCallback(
    (action: GemtextLinkAction, linkLabel: string) => {
      if (action.type === "open_browser") {
        void (async () => {
          try {
            const supported = await Linking.canOpenURL(action.url);
            if (supported) {
              await Linking.openURL(action.url);
            } else {
              Alert.alert("Cannot open link", action.url);
            }
          } catch (e) {
            Alert.alert(
              "Could not open link",
              e instanceof Error ? e.message : String(e),
            );
          }
        })();
        return;
      }

      const target = action.url.trim();
      if (
        capsuleUrl.length > 0 &&
        geminiOriginsMatch(target, capsuleUrl)
      ) {
        void submitMessageFlow(linkLabel, { fetchUrl: target });
        return;
      }

      void (async () => {
        try {
          const { data: capsules } = await getList<Capsule>({
            resource: RESOURCES.capsules,
          });
          const existing = findCapsuleForGeminiUrl(capsules, target);
          if (existing) {
            router.replace(
              `/dialog/${existing.id}?name=${encodeURIComponent(existing.name)}`,
            );
            return;
          }
          const { data: newCap } = await createCapsule({
            values: {
              name: suggestedCapsuleNameFromGeminiUrl(target),
              url: target,
            },
          });
          await invalidate({
            resource: RESOURCES.capsules,
            invalidates: ["list"],
          });
          await invalidate({
            resource: RESOURCES.dialogs,
            invalidates: ["list"],
          });
          router.replace(
            `/dialog/${newCap.id}?name=${encodeURIComponent(newCap.name)}`,
          );
        } catch (e) {
          logDialogMessage("gemini.link.cross_capsule.error", {
            target: target.slice(0, 120),
            error: e instanceof Error ? e.message : String(e),
          });
          Alert.alert(
            "Could not open capsule",
            e instanceof Error ? e.message : String(e),
          );
        }
      })();
    },
    [
      capsuleUrl,
      createCapsule,
      getList,
      invalidate,
      router,
      submitMessageFlow,
    ],
  );

  const title = useMemo(() => {
    if (nameParam && nameParam.length > 0) return nameParam;
    if (dialogRow?.capsule?.name) return dialogRow.capsule.name;
    return "Dialog";
  }, [nameParam, dialogRow?.capsule?.name]);

  useLayoutEffect(() => {
    navigation.setOptions({
      ...navigationChromeForScheme(scheme),
      title,
    });
  }, [navigation, scheme, title]);

  const lastMessage = messages.length > 0 ? messages[messages.length - 1] : undefined;

  const composerPlaceholder = useMemo(() => {
    const raw = lastMessage?.body?.trim();
    if (!raw) return "Message";
    return raw.length <= 40 ? raw : raw.slice(0, 40);
  }, [lastMessage?.body]);

  const requestHomeAsRefresh = useMemo(() => {
    if (lastMessage == null) return false;
    const cap = capsuleUrl.trim();
    if (!cap) return false;
    try {
      const atCapsuleEntry = geminiRequestPathForMessage(cap, cap);
      const cur = lastMessage.requestPath.trim();
      return (
        cur === atCapsuleEntry ||
        (atCapsuleEntry === "/" && cur === "")
      );
    } catch {
      return false;
    }
  }, [lastMessage, capsuleUrl]);

  const lastExpectsInput =
    lastMessage != null &&
    (lastMessage.status === 10 || lastMessage.status === 11);
  const showStart =
    !loadingInitial && messages.length === 0 && !!dialogId;
  const showTextComposer =
    !!dialogId && !loadingInitial && lastExpectsInput;
  /** Capsule root fetch when the server is not waiting for INPUT (10 / SENSITIVE_INPUT 11). */
  const showHome =
    !!dialogId &&
    !loadingInitial &&
    lastMessage != null &&
    !lastExpectsInput;

  const bottomInset = Math.max(insets.bottom, 8);

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: palette.screenBg }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={headerHeight}
    >
      <MessageList
        ref={listRef}
        resetScrollKey={dialogId}
        messages={messages}
        loadingInitial={loadingInitial}
        loadingOlder={loadingOlder}
        palette={palette}
        incomingGemtextChrome={scheme === "dark" ? "dark" : "light"}
        onRequestLoadOlder={() => void loadOlderMessages()}
        geminiLinkBaseUrl={capsuleUrl}
        onGemtextLink={onGemtextLink}
        geminiLinksDisabled={flowPending}
      />
      {showStart ? (
        <View
          style={[
            styles.startBar,
            {
              backgroundColor: palette.composerBarBg,
              borderTopColor: palette.composerBorder,
              paddingBottom: bottomInset,
            },
          ]}
        >
          <Pressable
            disabled={!capsuleUrl || flowPending}
            onPress={() => {
              logDialogMessage("start_button.press", {
                dialogId,
                hasCapsuleUrl: Boolean(capsuleUrl),
                flowPending,
              });
              void submitMessageFlow("", {
                requestText: "",
                displayText: "Visit",
              });
            }}
            style={({ pressed }) => [
              styles.startButton,
              {
                backgroundColor: palette.iconSend,
                opacity: !capsuleUrl || flowPending ? 0.45 : pressed ? 0.85 : 1,
              },
            ]}
            accessibilityLabel="Visit"
          >
            {flowPending ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.startButtonLabel}>Visit</Text>
            )}
          </Pressable>
        </View>
      ) : null}
      {showHome ? (
        <View
          style={[
            styles.startBar,
            {
              backgroundColor: palette.composerBarBg,
              borderTopColor: palette.composerBorder,
              paddingBottom: bottomInset,
            },
          ]}
        >
          <Pressable
            disabled={!capsuleUrl || flowPending}
            onPress={() => {
              logDialogMessage("home_button.press", {
                dialogId,
                hasCapsuleUrl: Boolean(capsuleUrl),
                flowPending,
                asRefresh: requestHomeAsRefresh,
              });
              void submitMessageFlow("", {
                fromHome: true,
                requestText: "",
                displayText: requestHomeAsRefresh ? "Revisit home" : "Visit home",
              });
            }}
            style={({ pressed }) => [
              styles.homeButton,
              {
                backgroundColor: palette.composerFieldBg,
                borderColor: palette.composerBorder,
                opacity: !capsuleUrl || flowPending ? 0.45 : pressed ? 0.72 : 1,
              },
            ]}
            accessibilityLabel={
              requestHomeAsRefresh
                ? "Revisit home"
                : "Visit home"
            }
          >
            {flowPending ? (
              <ActivityIndicator color={palette.iconSend} />
            ) : (
              <View style={styles.homeButtonContent}>
                <Ionicons
                  name={requestHomeAsRefresh ? "refresh-outline" : "home-outline"}
                  size={18}
                  color={palette.composerText}
                  style={styles.homeButtonIcon}
                />
                <Text
                  style={[styles.homeButtonLabel, { color: palette.composerText }]}
                >
                  {requestHomeAsRefresh ? "Revisit home" : "Visit home"}
                </Text>
              </View>
            )}
          </Pressable>
        </View>
      ) : null}
      {showTextComposer ? (
        <MessageForm
          key={dialogId || "none"}
          palette={palette}
          bottomInset={bottomInset}
          isPending={flowPending}
          disabled={!dialogId || !capsuleUrl}
          placeholder={composerPlaceholder}
          onSubmitBody={submitMessageFlow}
          onRequestHome={() => {
            logDialogMessage("composer.home.submit", {
              dialogId,
              hasCapsuleUrl: Boolean(capsuleUrl),
              asRefresh: requestHomeAsRefresh,
            });
            void submitMessageFlow("", {
              fromHome: true,
              requestText: "",
              displayText: requestHomeAsRefresh ? "Revisit home" : "Visit home",
            });
          }}
          requestHomeAsRefresh={requestHomeAsRefresh}
        />
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  startBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  startButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  startButtonLabel: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "600",
  },
  homeButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  homeButtonLabel: {
    fontSize: 17,
    fontWeight: "600",
  },
  homeButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  homeButtonIcon: {
    marginRight: 8,
  },
});
