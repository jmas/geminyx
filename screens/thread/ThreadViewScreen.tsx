import { Ionicons } from "@expo/vector-icons";
import { HeaderButton, useHeaderHeight } from "@react-navigation/elements";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CapsuleAvatar } from "components/capsule/CapsuleAvatar";
import type { GemtextLinkAction } from "components/message/GemtextMessageBody";
import { MessageForm } from "components/message/MessageForm";
import {
  MessageList,
  type MessageListEmptyCapsule,
  type MessageListHandle,
} from "components/message/MessageList";
import { BlockingProgressModal } from "components/ui/BlockingProgressModal";
import {
  useLocalSearchParams,
  usePathname,
  useRouter,
  type Href,
} from "expo-router";
import { useAccountActive } from "hooks/account/useAccountActive";
import { useMessageCreate } from "hooks/message/useMessageCreate";
import type { ThreadMessage } from "lib/models/threadMessage";
import {
  geminiDocumentBaseUrlForMessage,
  geminiOriginsMatch,
  geminiPathnameForVisitButton,
  isCapsuleRootRequestPath,
  normalizeGeminiCapsuleRootUrl,
  suggestedCapsuleNameFromGeminiUrl,
  truncateForVisitButtonLabel,
} from "lib/models/gemini";
import { queryKeys } from "lib/queryKeys";
import { destructiveTintColor, headerTitleColorForScheme } from "lib/theme/appColors";
import { threadConversationPaletteForScheme } from "lib/theme/semanticUi";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
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
import {
  accountsRepo,
  capsulesRepo,
  messagesRepo,
  MESSAGES_PAGE_SIZE,
  threadsRepo,
} from "repositories";
import { alertError, formatError } from "utils/error";
import { firstParam } from "utils/searchParams";
import { logThreadMessage } from "utils/threadMessageLog";

export function ThreadViewScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const router = useRouter();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const listRef = useRef<MessageListHandle>(null);
  const messagesRef = useRef<ThreadMessage[]>([]);
  const hasMoreOlderRef = useRef(false);
  const loadingOlderRef = useRef(false);
  const params = useLocalSearchParams<{ id?: string; name?: string; url?: string }>();
  const pathname = usePathname();
  const routeCapsuleId = firstParam(params.id) ?? "";
  const nameParam = firstParam(params.name);
  const urlParam = firstParam(params.url);
  const isCapsulesCreateRoute =
    pathname === "/capsules/create" || pathname.endsWith("/capsules/create");
  const scheme = useColorScheme();
  const palette = useMemo(
    () => threadConversationPaletteForScheme(scheme),
    [scheme],
  );

  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [certGenVisible, setCertGenVisible] = useState(false);
  const certGenTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const certGenStartedAtRef = useRef<number | null>(null);
  const CERT_GEN_TIMEOUT_MS = 150_000; // 2.5 minutes
  const [certGenProgressKey, setCertGenProgressKey] = useState(0);

  const queryClient = useQueryClient();
  const { data: activeAccount, isPending: activePending } = useAccountActive();

  const [resolvedCapsuleId, setResolvedCapsuleId] = useState(routeCapsuleId);

  useEffect(() => {
    setResolvedCapsuleId(routeCapsuleId);
  }, [routeCapsuleId]);

  useEffect(() => {
    if (routeCapsuleId || !urlParam?.trim() || !activeAccount?.id) return;
    let cancelled = false;
    const trimmedUrl = urlParam.trim();
    void capsulesRepo
      .findByGeminiOriginForAccount(activeAccount.id, trimmedUrl)
      .then((found) => {
        if (cancelled) return;
        if (found) {
          setResolvedCapsuleId(found.id);
          return;
        }
        const onThreadsView =
          pathname === "/threads/view" || pathname.endsWith("/threads/view");
        if (onThreadsView) {
          router.replace({
            pathname: "/capsules/create",
            params: {
              url: trimmedUrl,
              ...(nameParam ? { name: nameParam } : {}),
            },
          } as unknown as Href);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [
    routeCapsuleId,
    urlParam,
    activeAccount?.id,
    pathname,
    nameParam,
    router,
  ]);

  const threadId = resolvedCapsuleId;

  const { data: threadRow, refetch: refetchThreadRow } = useQuery({
    queryKey: [...queryKeys.threads.detail(threadId), activeAccount?.id ?? "none"],
    queryFn: async () => {
      if (!threadId || !activeAccount?.id) return null;
      return threadsRepo.getByIdForAccount(activeAccount.id, threadId);
    },
    enabled: Boolean(threadId) && !activePending,
  });

  const { data: capsuleRow } = useQuery({
    queryKey: [...queryKeys.capsules.detail(threadId), activeAccount?.id ?? "none"],
    queryFn: async () => {
      if (!threadId || !activeAccount?.id) return null;
      return capsulesRepo.getByIdForAccount(activeAccount.id, threadId);
    },
    enabled: Boolean(threadId) && !activePending,
  });

  messagesRef.current = messages;

  useFocusEffect(
    useCallback(() => {
      if (threadId) void refetchThreadRow();
    }, [refetchThreadRow, threadId]),
  );

  const loadInitialMessages = useCallback(async () => {
    if (!threadId) return;
    setLoadingInitial(true);
    try {
      const total = await messagesRepo.countForThread(threadId);
      const data = await messagesRepo.listRecentForThread(
        threadId,
        MESSAGES_PAGE_SIZE,
      );
      setMessages(data);
      const more = data.length === MESSAGES_PAGE_SIZE && total > data.length;
      hasMoreOlderRef.current = more;
    } finally {
      setLoadingInitial(false);
    }
  }, [threadId]);

  const loadOlderMessages = useCallback(async () => {
    if (!threadId || loadingOlderRef.current || !hasMoreOlderRef.current) {
      return;
    }
    const list = messagesRef.current;
    if (list.length === 0) return;
    const oldest = list[0];

    loadingOlderRef.current = true;
    setLoadingOlder(true);
    try {
      const data = await messagesRepo.listBeforeCursorForThread(
        threadId,
        { sentAt: oldest.sentAt, id: oldest.id },
        MESSAGES_PAGE_SIZE,
      );
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
  }, [threadId]);

  useEffect(() => {
    if (!threadId) {
      setMessages([]);
      hasMoreOlderRef.current = false;
      return;
    }
    void loadInitialMessages();
  }, [threadId, loadInitialMessages]);

  const geminiTls = useMemo(() => {
    const acc = activeAccount;
    if (!acc) return undefined;
    const b64 = acc.geminiClientP12Base64?.trim();
    if (!b64) return undefined;
    return {
      identityLabel: `geminyx.gemini.identity.${acc.id}`,
      pkcs12Base64: b64,
      passphrase: acc.geminiClientP12Passphrase ?? "",
    };
  }, [activeAccount]);

  const capsuleUrl = useMemo(() => {
    const fromThread = threadRow?.capsule?.url?.trim() ?? "";
    if (fromThread.length > 0) return fromThread;
    const fromCapsule = capsuleRow?.url?.trim() ?? "";
    if (fromCapsule.length > 0) return fromCapsule;
    const fromParam = urlParam?.trim() ?? "";
    if (fromParam.length > 0) {
      return normalizeGeminiCapsuleRootUrl(fromParam) || fromParam;
    }
    return "";
  }, [threadRow?.capsule?.url, capsuleRow?.url, urlParam]);

  const [visitTargetFromQuery, setVisitTargetFromQuery] = useState(() =>
    (urlParam?.trim() ?? "").trim(),
  );

  useEffect(() => {
    setVisitTargetFromQuery((urlParam?.trim() ?? "").trim());
  }, [urlParam]);

  const visitFooterPrimaryLabel = useMemo(() => {
    const raw = visitTargetFromQuery;
    if (!raw) return t("thread.visit");
    const path = geminiPathnameForVisitButton(raw);
    if (!path) return t("thread.visit");
    return t("thread.visitWithPath", {
      path: truncateForVisitButtonLabel(path),
    });
  }, [visitTargetFromQuery, t]);

  const scheduleScrollToEnd = useCallback(() => {
    requestAnimationFrame(() =>
      listRef.current?.scrollToEnd({ animated: true }),
    );
  }, []);

  const refreshThreadContext = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: queryKeys.accounts.active(),
    });
    await queryClient.invalidateQueries({
      queryKey: queryKeys.threads.detail(threadId),
    });
    await loadInitialMessages();
  }, [queryClient, threadId, loadInitialMessages]);

  const { flowPending, submitMessageFlow } = useMessageCreate({
    threadId,
    capsuleUrl,
    activeAccountId: activeAccount?.id,
    activeAccountName: activeAccount?.name,
    activeAccountHasClientCert: !!activeAccount?.geminiClientP12Base64?.trim(),
    threadClientCertShareAllowed: threadRow?.clientCertShareAllowed ?? false,
    geminiTls,
    onClientCertGenerateStart: () => {
      if (certGenTimerRef.current) {
        clearInterval(certGenTimerRef.current);
        certGenTimerRef.current = null;
      }
      setCertGenVisible(true);
      const startedAt = Date.now();
      certGenStartedAtRef.current = startedAt;
      setCertGenProgressKey((k) => k + 1);
    },
    onClientCertGenerateEnd: ({ ok }) => {
      if (certGenTimerRef.current) {
        clearInterval(certGenTimerRef.current);
        certGenTimerRef.current = null;
      }
      certGenStartedAtRef.current = null;
      setTimeout(
        () => {
          setCertGenVisible(false);
        },
        ok ? 450 : 0,
      );
    },
    messagesRef,
    setMessages,
    scheduleScrollToEnd,
    onLocalDataChanged: refreshThreadContext,
    bootstrapGeminiUrl:
      isCapsulesCreateRoute && !threadId && urlParam?.trim()
        ? urlParam.trim()
        : undefined,
    onBootstrapThreadId: setResolvedCapsuleId,
  });

  useEffect(() => {
    return () => {
      if (certGenTimerRef.current) {
        clearInterval(certGenTimerRef.current);
        certGenTimerRef.current = null;
      }
    };
  }, []);

  const onMessageRefetch = useCallback(
    (message: ThreadMessage) => {
      if (flowPending) {
        Alert.alert(t("common.busy"), t("thread.busyMsg"));
        return;
      }
      if (!capsuleUrl.trim()) {
        Alert.alert(
          t("thread.noCapsuleUrlTitle"),
          t("thread.noCapsuleUrlBody"),
        );
        return;
      }
      const fetchUrl = geminiDocumentBaseUrlForMessage(capsuleUrl, message);
      const isRevisit = isCapsuleRootRequestPath(capsuleUrl, message);
      void submitMessageFlow("", {
        fetchUrl,
        ...(isRevisit ? {} : { displayText: t("thread.revisit") }),
      });
    },
    [capsuleUrl, flowPending, submitMessageFlow, t],
  );

  const getMessageRefetchMenuAction = useCallback(
    (message: ThreadMessage) =>
      isCapsuleRootRequestPath(capsuleUrl, message)
        ? {
            title: t("thread.revisitHome"),
            systemIcon: "house" as const,
          }
        : {
            title: t("thread.revisit"),
            systemIcon: "arrow.clockwise" as const,
          },
    [capsuleUrl, t],
  );

  const onGemtextLink = useCallback(
    (action: GemtextLinkAction, linkLabel: string) => {
      if (action.type === "open_browser") {
        void (async () => {
          try {
            const supported = await Linking.canOpenURL(action.url);
            if (supported) {
              await Linking.openURL(action.url);
            } else {
              Alert.alert(t("thread.cannotOpenLink"), action.url);
            }
          } catch (e) {
            alertError(e, t("thread.openLinkError"), t("thread.openLinkError"));
          }
        })();
        return;
      }

      const target = action.url.trim();
      if (capsuleUrl.length > 0 && geminiOriginsMatch(target, capsuleUrl)) {
        void submitMessageFlow(linkLabel, { fetchUrl: target });
        return;
      }

      void (async () => {
        try {
          const active = await queryClient.fetchQuery({
            queryKey: queryKeys.accounts.active(),
            queryFn: () => accountsRepo.getActive(),
          });
          if (!active?.id) {
            Alert.alert(t("thread.noAccountTitle"), t("thread.noAccountBody"));
            return;
          }
          const existing = await capsulesRepo.findByGeminiOriginForAccount(
            active.id,
            target,
          );
          if (existing) {
            router.replace({
              pathname: "/thread/[id]",
              params: {
                id: existing.id,
                name: existing.name,
                // Preserve full URL (path/query/hash) for the initial Visit.
                // Capsule identity still comes from origin matching in the repo lookup.
                url: target,
              },
            } as unknown as Href);
            return;
          }
          router.replace({
            pathname: "/capsules/create",
            params: {
              url: target,
              name: suggestedCapsuleNameFromGeminiUrl(target),
            },
          } as unknown as Href);
        } catch (e) {
          logThreadMessage("gemini.link.cross_capsule.error", {
            target: target.slice(0, 120),
            error: formatError(e, t("common.unknownError")),
          });
          alertError(e, t("thread.openCapsuleError"), t("thread.openCapsuleError"));
        }
      })();
    },
    [capsuleUrl, queryClient, router, submitMessageFlow, t],
  );

  const title = useMemo(() => {
    if (nameParam && nameParam.length > 0) return nameParam;
    if (threadRow?.capsule?.name) return threadRow.capsule.name;
    if (capsuleRow?.name) return capsuleRow.name;
    const raw = urlParam?.trim();
    if (raw) return suggestedCapsuleNameFromGeminiUrl(raw);
    return t("thread.fallbackTitle");
  }, [nameParam, threadRow?.capsule?.name, capsuleRow?.name, urlParam, t]);

  const confirmDeleteThread = useCallback(() => {
    if (!threadId || flowPending) return;
    const display = title.trim();
    Alert.alert(
      t("thread.deleteTitle"),
      display.length > 0
        ? t("thread.deleteMsgNamed", { name: display })
        : t("thread.deleteMsgGeneric"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: () => {
            void (async () => {
              try {
                await threadsRepo.deleteConversation(threadId);
                await queryClient.invalidateQueries({
                  queryKey: queryKeys.threads.listForActive(),
                });
                await queryClient.invalidateQueries({
                  queryKey: queryKeys.capsules.listForActive(),
                });
                await queryClient.invalidateQueries({
                  queryKey: queryKeys.threads.detail(threadId),
                });
                await queryClient.invalidateQueries({
                  queryKey: queryKeys.capsules.detail(threadId),
                });
                router.back();
              } catch (e) {
                console.error(e);
                Alert.alert(
                  t("thread.deleteErrorTitle"),
                  t("thread.deleteErrorBody"),
                );
              }
            })();
          },
        },
      ],
    );
  }, [flowPending, queryClient, router, threadId, title, t]);

  const capsuleHeaderMeta = useMemo(() => {
    const cap = threadRow?.capsule ?? capsuleRow;
    const id = threadId;
    const displayName = title;
    return {
      id,
      name: displayName,
      avatarIcon: cap?.avatarIcon,
    };
  }, [threadId, threadRow?.capsule, capsuleRow, title]);

  const openCapsuleDetail = useCallback(() => {
    if (!capsuleHeaderMeta.id) return;
    router.push({
      pathname: "/capsule/[id]",
      params: { id: capsuleHeaderMeta.id },
    } as unknown as Href);
  }, [capsuleHeaderMeta.id, router]);

  const emptyCapsuleForList = useMemo(():
    | MessageListEmptyCapsule
    | undefined => {
    const cap = threadRow?.capsule ?? capsuleRow;
    if (cap) {
      const desc = cap.description?.trim();
      return {
        capsuleId: cap.id,
        name: cap.name,
        avatarIcon: cap.avatarIcon,
        ...(desc ? { description: desc } : {}),
      };
    }
    if (nameParam && nameParam.length > 0 && threadId) {
      return {
        capsuleId: threadId,
        name: nameParam,
      };
    }
    const rawUrl = urlParam?.trim();
    if (rawUrl) {
      return {
        capsuleId: `url-${rawUrl.slice(0, 48)}`,
        name: suggestedCapsuleNameFromGeminiUrl(rawUrl),
      };
    }
    return undefined;
  }, [threadId, threadRow?.capsule, capsuleRow, nameParam, urlParam]);

  const headerTitleColor = headerTitleColorForScheme(scheme);

  useLayoutEffect(() => {
    const deleteIconSize = 24;
    navigation.setOptions({
      headerRightContainerStyle: { paddingRight: 8 },
      headerRight:
        threadId.length > 0
          ? () => (
              <HeaderButton
                onPress={confirmDeleteThread}
                disabled={flowPending}
                accessibilityLabel={t("thread.a11yDeleteChat")}
              >
                <Ionicons
                  name="trash-outline"
                  size={deleteIconSize}
                  color={destructiveTintColor()}
                  style={[
                    Platform.OS === "ios"
                      ? { lineHeight: deleteIconSize }
                      : undefined,
                    flowPending ? { opacity: 0.45 } : undefined,
                  ]}
                />
              </HeaderButton>
            )
          : undefined,
      headerTitle: () => (
        <Pressable
          onPress={openCapsuleDetail}
          disabled={!capsuleHeaderMeta.id}
          style={({ pressed }) => [
            styles.headerTitleRow,
            !capsuleHeaderMeta.id ? { opacity: 0.5 } : null,
            pressed && capsuleHeaderMeta.id ? { opacity: 0.65 } : null,
          ]}
          accessibilityRole="button"
          accessibilityLabel={t("thread.a11yCapsuleDetails", {
            name: capsuleHeaderMeta.name,
          })}
        >
          <CapsuleAvatar
            capsuleId={capsuleHeaderMeta.id || threadId || "capsule"}
            name={capsuleHeaderMeta.name}
            emoji={capsuleHeaderMeta.avatarIcon}
            size={28}
          />
          <Text
            numberOfLines={1}
            style={[
              styles.headerTitleText,
              {
                color: headerTitleColor,
              },
            ]}
          >
            {capsuleHeaderMeta.name}
          </Text>
        </Pressable>
      ),
    });
  }, [
    capsuleHeaderMeta.avatarIcon,
    capsuleHeaderMeta.id,
    capsuleHeaderMeta.name,
    confirmDeleteThread,
    flowPending,
    threadId,
    headerTitleColor,
    navigation,
    openCapsuleDetail,
    t,
  ]);

  const lastMessage =
    messages.length > 0 ? messages[messages.length - 1] : undefined;

  const composerPlaceholder = useMemo(() => {
    const raw = lastMessage?.body?.trim();
    if (!raw) return t("messageForm.placeholderDefault");
    const max = 80;
    if (raw.length <= max) return raw;
    return `${raw.slice(0, max)}…`;
  }, [lastMessage?.body, t]);

  const requestHomeAsRefresh = useMemo(() => {
    if (lastMessage == null) return false;
    return isCapsuleRootRequestPath(capsuleUrl, lastMessage);
  }, [lastMessage, capsuleUrl]);

  const visitHomeFooterLabel = useMemo(() => {
    if (visitTargetFromQuery) return visitFooterPrimaryLabel;
    return requestHomeAsRefresh ? t("thread.revisitHome") : t("thread.visitHome");
  }, [visitTargetFromQuery, visitFooterPrimaryLabel, requestHomeAsRefresh, t]);

  const lastExpectsInput =
    lastMessage != null &&
    (lastMessage.status === 10 || lastMessage.status === 11);
  const canVisit =
    Boolean(activeAccount?.id) &&
    Boolean(capsuleUrl.trim()) &&
    (Boolean(threadId) ||
      (isCapsulesCreateRoute && Boolean(urlParam?.trim())));
  const showStart = !loadingInitial && messages.length === 0 && canVisit;
  const showTextComposer = !!threadId && !loadingInitial && lastExpectsInput;
  /** Capsule root fetch when the server is not waiting for INPUT (10 / SENSITIVE_INPUT 11). */
  const showHome =
    !!threadId && !loadingInitial && lastMessage != null && !lastExpectsInput;

  const bottomInset = Math.max(insets.bottom, 8);

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: palette.screenBg }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={headerHeight}
    >
      <BlockingProgressModal
        visible={certGenVisible}
        blocking
        title={t("thread.certGenTitle")}
        message={t("thread.certGenMessage")}
        progressDurationMs={CERT_GEN_TIMEOUT_MS}
        progressKey={certGenProgressKey}
      />
      <MessageList
        ref={listRef}
        resetScrollKey={threadId}
        messages={messages}
        loadingInitial={loadingInitial}
        loadingOlder={loadingOlder}
        palette={palette}
        incomingGemtextChrome={scheme === "dark" ? "dark" : "light"}
        onRequestLoadOlder={() => void loadOlderMessages()}
        geminiLinkBaseUrl={capsuleUrl}
        onGemtextLink={onGemtextLink}
        geminiLinksDisabled={flowPending}
        emptyCapsule={emptyCapsuleForList}
        onMessageRefetch={onMessageRefetch}
        getMessageRefetchMenuAction={getMessageRefetchMenuAction}
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
              logThreadMessage("start_button.press", {
                threadId,
                hasCapsuleUrl: Boolean(capsuleUrl),
                flowPending,
              });
              void (async () => {
                await submitMessageFlow("", {
                  ...(visitTargetFromQuery ? { fetchUrl: visitTargetFromQuery } : {}),
                  requestText: "",
                  displayText: visitFooterPrimaryLabel,
                });
                if (visitTargetFromQuery) setVisitTargetFromQuery("");
              })();
            }}
            style={({ pressed }) => [
              styles.startButton,
              {
                backgroundColor: palette.iconSend,
                opacity: !capsuleUrl || flowPending ? 0.45 : pressed ? 0.85 : 1,
              },
            ]}
            accessibilityLabel={visitFooterPrimaryLabel}
          >
            {flowPending ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text
                numberOfLines={3}
                style={[styles.startButtonLabel, styles.footerButtonLabelMultiline]}
              >
                {visitFooterPrimaryLabel}
              </Text>
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
              logThreadMessage("home_button.press", {
                threadId,
                hasCapsuleUrl: Boolean(capsuleUrl),
                flowPending,
                asRefresh: requestHomeAsRefresh,
              });
              void (async () => {
                await submitMessageFlow("", {
                  ...(visitTargetFromQuery ? { fetchUrl: visitTargetFromQuery } : {}),
                  fromHome: true,
                  requestText: "",
                  displayText: visitHomeFooterLabel,
                });
                if (visitTargetFromQuery) setVisitTargetFromQuery("");
              })();
            }}
            style={({ pressed }) => [
              styles.homeButton,
              {
                backgroundColor: palette.composerFieldBg,
                borderColor: palette.composerBorder,
                opacity: !capsuleUrl || flowPending ? 0.45 : pressed ? 0.72 : 1,
              },
            ]}
            accessibilityLabel={visitHomeFooterLabel}
          >
            {flowPending ? (
              <ActivityIndicator color={palette.iconSend} />
            ) : (
              <View style={styles.homeButtonContent}>
                <Ionicons
                  name={
                    requestHomeAsRefresh ? "refresh-outline" : "home-outline"
                  }
                  size={18}
                  color={palette.composerText}
                  style={styles.homeButtonIcon}
                />
                <Text
                  numberOfLines={3}
                  style={[
                    styles.homeButtonLabel,
                    styles.footerButtonLabelMultiline,
                    { color: palette.composerText },
                  ]}
                >
                  {visitHomeFooterLabel}
                </Text>
              </View>
            )}
          </Pressable>
        </View>
      ) : null}
      {showTextComposer ? (
        <MessageForm
          key={threadId || "none"}
          palette={palette}
          bottomInset={bottomInset}
          isPending={flowPending}
          disabled={!threadId || !capsuleUrl}
          placeholder={composerPlaceholder}
          onSubmitBody={submitMessageFlow}
          onRequestHome={() => {
            logThreadMessage("composer.home.submit", {
              threadId,
              hasCapsuleUrl: Boolean(capsuleUrl),
              asRefresh: requestHomeAsRefresh,
            });
            void (async () => {
              await submitMessageFlow("", {
                ...(visitTargetFromQuery ? { fetchUrl: visitTargetFromQuery } : {}),
                fromHome: true,
                requestText: "",
                displayText: visitHomeFooterLabel,
              });
              if (visitTargetFromQuery) setVisitTargetFromQuery("");
            })();
          }}
          requestHomeAsRefresh={requestHomeAsRefresh}
        />
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    maxWidth: 260,
  },
  headerTitleText: {
    marginLeft: 8,
    fontSize: 17,
    fontWeight: "600",
    flexShrink: 1,
  },
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
  footerButtonLabelMultiline: {
    textAlign: "center",
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
