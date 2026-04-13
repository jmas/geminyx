import Ionicons from "@expo/vector-icons/Ionicons";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { usePopupManager } from "react-popup-manager";
import type { DialogMessage } from "lib/models/dialogMessage";
import { MessageBodyFullModal } from "components/message/MessageBodyFullModal";
import {
  GemtextMessageBody,
  type GemtextLinkAction,
  type IncomingGemtextChrome,
} from "components/message/GemtextMessageBody";
import { geminiDocumentBaseUrlForMessage } from "lib/models/gemini";
import { formatMessageTime } from "utils/formatMessageTime";
import {
  prepareTruncatedGemtextPreview,
  truncateMessageToLines,
} from "utils/truncateMessageLines";

export type MessageListPalette = {
  bubbleIncoming: string;
  bubbleOutgoing: string;
  textIncoming: string;
  textOutgoing: string;
  timeIncoming: string;
  timeOutgoing: string;
  icon: string;
  linkIncoming: string;
  linkOutgoing: string;
  /** Outlined secondary control under truncated bubbles (full width = bubble). */
  viewFullBtnBg: string;
  viewFullBtnBorder: string;
  viewFullBtnLabel: string;
};

export type MessageListProps = {
  /** When this changes (e.g. dialog id), scroll/pagination refs reset. */
  resetScrollKey: string;
  messages: DialogMessage[];
  loadingInitial: boolean;
  loadingOlder: boolean;
  palette: MessageListPalette;
  /** Quote/code blocks on incoming bubbles (dark surface vs white bubble). */
  incomingGemtextChrome?: IncomingGemtextChrome;
  onRequestLoadOlder: () => void;
  /** Base URL for resolving relative `=>` links in Gemtext (usually capsule URL). */
  geminiLinkBaseUrl: string;
  onGemtextLink?: (
    action: GemtextLinkAction,
    linkLabel: string,
  ) => void;
  geminiLinksDisabled?: boolean;
};

export type MessageListHandle = {
  scrollToEnd: (options?: { animated?: boolean }) => void;
};

const BLOB_REF_BODY = /^\[blob: ([^\]]+)\]$/;

/** Pixels from the bottom of content to still count as "at bottom" (Telegram-like). */
const NEAR_BOTTOM_THRESHOLD_PX = 80;

type ViewFullMessageContext = {
  body: string;
  baseUrl: string;
};

function MessageBubble({
  message,
  palette,
  incomingGemtextChrome,
  showTailSpacing,
  geminiLinkBaseUrl,
  onGemtextLink,
  geminiLinksDisabled,
  onViewFull,
}: {
  message: DialogMessage;
  palette: MessageListPalette;
  incomingGemtextChrome: IncomingGemtextChrome;
  showTailSpacing: boolean;
  geminiLinkBaseUrl: string;
  onGemtextLink?: (action: GemtextLinkAction, linkLabel: string) => void;
  geminiLinksDisabled?: boolean;
  onViewFull: (ctx: ViewFullMessageContext) => void;
}) {
  const outgoing = message.isOutgoing;
  const bubbleBg = outgoing ? palette.bubbleOutgoing : palette.bubbleIncoming;
  const textColor = outgoing ? palette.textOutgoing : palette.textIncoming;
  const linkColor = outgoing ? palette.linkOutgoing : palette.linkIncoming;
  const timeColor = outgoing ? palette.timeOutgoing : palette.timeIncoming;
  const bodyTrim = message.body?.trim() ?? "";
  const blobRefMatch = BLOB_REF_BODY.exec(bodyTrim);
  const isBlobPointer =
    Boolean(
      message.blobId &&
        blobRefMatch &&
        blobRefMatch[1] === message.blobId,
    );
  const placeholder =
    message.blobId && !isBlobPointer
      ? message.contentLength > 0
        ? `[Attachment · ${message.contentLength} bytes]`
        : "[Attachment]"
      : message.contentLength > 0 && bodyTrim.length === 0
        ? `(${message.contentLength} bytes)`
        : "";

  const docBaseUrl = geminiDocumentBaseUrlForMessage(
    geminiLinkBaseUrl,
    message,
  );
  const { preview: gemtextPreview, truncated: gemtextTruncated } =
    truncateMessageToLines(message.body ?? "");
  const gemtextDisplayBody = gemtextTruncated
    ? prepareTruncatedGemtextPreview(gemtextPreview, true)
    : (message.body ?? "");

  const showViewFullUnderBubble =
    !isBlobPointer && bodyTrim.length > 0 && gemtextTruncated;

  return (
    <View
      style={[
        styles.row,
        outgoing ? styles.rowOutgoing : styles.rowIncoming,
        showTailSpacing && styles.rowGroupedGap,
      ]}
    >
      <View
        style={[
          styles.bubbleStack,
          outgoing ? styles.bubbleStackOutgoing : styles.bubbleStackIncoming,
        ]}
      >
        <View style={[styles.bubble, { backgroundColor: bubbleBg }]}>
          {isBlobPointer ? (
            <Text selectable style={[styles.messageText, { color: textColor }]}>
              [blob: {message.blobId}] · {message.contentLength} bytes
            </Text>
          ) : bodyTrim.length > 0 ? (
            <GemtextMessageBody
              body={gemtextDisplayBody}
              textColor={textColor}
              linkColor={linkColor}
              baseUrl={docBaseUrl}
              isOutgoing={outgoing}
              incomingChrome={incomingGemtextChrome}
              linksDisabled={geminiLinksDisabled}
              onGemtextLink={onGemtextLink}
            />
          ) : placeholder.length > 0 ? (
            <Text selectable style={[styles.messageText, { color: textColor }]}>
              {placeholder}
            </Text>
          ) : null}
          <Text selectable style={[styles.timeText, { color: timeColor }]}>
            {formatMessageTime(message.sentAt)}
          </Text>
        </View>
        {showViewFullUnderBubble ? (
          <Pressable
            onPress={() =>
              onViewFull({
                body: message.body ?? "",
                baseUrl: docBaseUrl,
              })
            }
            style={({ pressed }) => [
              styles.viewFullBtn,
              {
                backgroundColor: palette.viewFullBtnBg,
                borderColor: palette.viewFullBtnBorder,
                opacity: pressed ? 0.88 : 1,
              },
            ]}
            android_ripple={{
              color: palette.viewFullBtnBorder,
              foreground: true,
            }}
          >
            <Text
              style={[styles.viewFullBtnLabel, { color: palette.viewFullBtnLabel }]}
            >
              Read more
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export const MessageList = forwardRef<MessageListHandle, MessageListProps>(
  function MessageList(
    {
      resetScrollKey,
      messages,
      loadingInitial,
      loadingOlder,
      palette,
      incomingGemtextChrome = "light",
      onRequestLoadOlder,
      geminiLinkBaseUrl,
      onGemtextLink,
      geminiLinksDisabled,
    },
    ref,
  ) {
    const listRef = useRef<ScrollView | null>(null);
    const initialScrollDoneRef = useRef(false);
    const sawScrollBelowTopRef = useRef(false);
    const loadingInitialRef = useRef(loadingInitial);
    const loadingOlderRef = useRef(loadingOlder);
    loadingInitialRef.current = loadingInitial;
    loadingOlderRef.current = loadingOlder;

    /** Avoid iOS `maintainVisibleContentPosition` overlap bugs; keep scroll stable when prepending older messages. */
    const scrollYRef = useRef(0);
    const contentHeightRef = useRef(0);
    const prevFirstMessageIdRef = useRef<string | undefined>(undefined);
    const prevMessageCountRef = useRef(0);
    const pendingPrependScrollAdjustRef = useRef(false);
    const [showScrollToBottom, setShowScrollToBottom] = useState(false);

    const popupManager = usePopupManager();

    const openFullMessageModal = useCallback(
      (ctx: ViewFullMessageContext) => {
        popupManager.open(MessageBodyFullModal, {
          body: ctx.body,
          baseUrl: ctx.baseUrl,
          textColor: palette.textIncoming,
          linkColor: palette.linkIncoming,
          incomingGemtextChrome,
          geminiLinksDisabled,
          onLinkFollow: onGemtextLink,
        });
      },
      [
        geminiLinksDisabled,
        incomingGemtextChrome,
        onGemtextLink,
        palette.linkIncoming,
        palette.textIncoming,
        popupManager,
      ],
    );

    useImperativeHandle(
      ref,
      () => ({
        scrollToEnd: (options) => {
          setShowScrollToBottom(false);
          listRef.current?.scrollToEnd({
            animated: options?.animated ?? true,
          });
        },
      }),
      [],
    );

    useEffect(() => {
      initialScrollDoneRef.current = false;
      sawScrollBelowTopRef.current = false;
      scrollYRef.current = 0;
      contentHeightRef.current = 0;
      prevFirstMessageIdRef.current = undefined;
      prevMessageCountRef.current = 0;
      pendingPrependScrollAdjustRef.current = false;
      setShowScrollToBottom(false);
    }, [resetScrollKey]);

    useLayoutEffect(() => {
      const firstId = messages[0]?.id;
      const len = messages.length;
      const prevFirst = prevFirstMessageIdRef.current;
      const prevLen = prevMessageCountRef.current;
      if (prevLen > 0 && len > prevLen && firstId !== prevFirst) {
        pendingPrependScrollAdjustRef.current = true;
      }
      prevFirstMessageIdRef.current = firstId;
      prevMessageCountRef.current = len;
    }, [messages]);

    useEffect(() => {
      if (
        loadingInitial ||
        messages.length === 0 ||
        initialScrollDoneRef.current
      ) {
        return;
      }
      initialScrollDoneRef.current = true;
      const id = requestAnimationFrame(() =>
        listRef.current?.scrollToEnd({ animated: false }),
      );
      return () => cancelAnimationFrame(id);
    }, [loadingInitial, messages.length]);

    const onListScroll = useCallback(
      (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        const { contentOffset, contentSize, layoutMeasurement } =
          e.nativeEvent;
        const y = Math.max(0, contentOffset.y);
        scrollYRef.current = y;
        if (y > 80) {
          sawScrollBelowTopRef.current = true;
        }

        const contentH = contentSize.height;
        const viewH = layoutMeasurement.height;
        const visibleBottom = y + viewH;
        const scrollable = contentH > viewH + 2;
        const atBottom =
          !scrollable ||
          visibleBottom >= contentH - NEAR_BOTTOM_THRESHOLD_PX;
        const canShowFab =
          !loadingInitialRef.current &&
          initialScrollDoneRef.current &&
          messages.length > 0;
        const nextShow = canShowFab && scrollable && !atBottom;
        setShowScrollToBottom((prev) => (prev === nextShow ? prev : nextShow));

        if (
          loadingInitialRef.current ||
          !initialScrollDoneRef.current ||
          loadingOlderRef.current ||
          !sawScrollBelowTopRef.current
        ) {
          return;
        }
        if (y <= 56) {
          onRequestLoadOlder();
        }
      },
      [messages.length, onRequestLoadOlder],
    );

    const onScrollToBottomPress = useCallback(() => {
      setShowScrollToBottom(false);
      listRef.current?.scrollToEnd({ animated: true });
    }, []);

    const onContentSizeChange = useCallback(
      (_w: number, h: number) => {
        const prevH = contentHeightRef.current;
        if (
          pendingPrependScrollAdjustRef.current &&
          prevH > 0 &&
          h > prevH
        ) {
          const delta = h - prevH;
          const nextY = scrollYRef.current + delta;
          listRef.current?.scrollTo({ y: nextY, animated: false });
          scrollYRef.current = nextY;
          pendingPrependScrollAdjustRef.current = false;
        }
        contentHeightRef.current = h;
      },
      [],
    );

    return (
      <View style={styles.listWrap}>
        <ScrollView
          ref={listRef}
          style={styles.listScroll}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          onContentSizeChange={onContentSizeChange}
          onScroll={onListScroll}
          scrollEventThrottle={100}
        >
          {loadingOlder ? (
            <View style={styles.listHeaderLoading}>
              <ActivityIndicator color={palette.icon} />
            </View>
          ) : null}
          {messages.map((item, index) => (
            <MessageBubble
              key={item.id}
              message={item}
              palette={palette}
              incomingGemtextChrome={incomingGemtextChrome}
              showTailSpacing={
                index === 0 ||
                messages[index - 1]?.isOutgoing !== item.isOutgoing
              }
              geminiLinkBaseUrl={geminiLinkBaseUrl}
              onGemtextLink={onGemtextLink}
              geminiLinksDisabled={geminiLinksDisabled}
              onViewFull={openFullMessageModal}
            />
          ))}
        </ScrollView>
        {showScrollToBottom ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Scroll to bottom"
            onPress={onScrollToBottomPress}
            style={({ pressed }) => [
              styles.scrollToBottomFab,
              {
                backgroundColor: palette.bubbleIncoming,
                borderColor: palette.viewFullBtnBorder,
                opacity: pressed ? 0.92 : 1,
              },
            ]}
            android_ripple={{
              color: palette.viewFullBtnBorder,
              foreground: true,
            }}
          >
            <Ionicons name="chevron-down" size={22} color={palette.icon} />
          </Pressable>
        ) : null}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  listWrap: {
    flex: 1,
  },
  listScroll: {
    flex: 1,
  },
  scrollToBottomFab: {
    position: "absolute",
    right: 12,
    bottom: 12,
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 3,
    elevation: 3,
  },
  listContent: {
    paddingHorizontal: 10,
    paddingVertical: 12,
    paddingBottom: 20,
    flexGrow: 1,
  },
  listHeaderLoading: {
    paddingVertical: 8,
    alignItems: "center",
  },
  row: {
    maxWidth: "80%",
    marginBottom: 2,
  },
  rowGroupedGap: {
    marginTop: 10,
  },
  rowIncoming: {
    alignSelf: "flex-start",
  },
  rowOutgoing: {
    alignSelf: "flex-end",
  },
  bubbleStack: {
    maxWidth: "100%",
  },
  bubbleStackIncoming: {
    alignItems: "flex-start",
  },
  bubbleStackOutgoing: {
    alignItems: "flex-end",
  },
  bubble: {
    borderRadius: 16,
    paddingHorizontal: 11,
    paddingTop: 6,
    paddingBottom: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 0.5 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 1,
  },
  messageText: {
    fontSize: 17,
    lineHeight: 23,
    letterSpacing: -0.24,
  },
  timeText: {
    fontSize: 12,
    marginTop: 5,
    alignSelf: "flex-end",
  },
  viewFullBtn: {
    alignSelf: "stretch",
    marginTop: 6,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: "center",
    justifyContent: "center",
  },
  viewFullBtnLabel: {
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
});
