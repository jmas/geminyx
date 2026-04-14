import { useMemo } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { resolveGeminiLinkHref } from "lib/models/gemini";
import { parseGemtext, type GemtextSegment } from "utils/parseGemtext";
import { parseAnsiSgrToRuns } from "utils/parseAnsiSgr";

const mono = Platform.select({
  ios: "JetBrainsMono_400Regular",
  android: "JetBrainsMono_400Regular",
  default: "monospace",
});

/** Telegram-like body size (iOS ~17pt chat text). */
const BODY_SIZE = Platform.select({ ios: 17, default: 16 });
/** Slightly generous for readable paragraph rhythm in bubbles. */
const BODY_LH = Math.round(BODY_SIZE * 1.42);

/**
 * Bubble stack uses `alignItems: flex-start`, so the bubble shrink-wraps. A short
 * heading can become the only width hint; `flex: 1` list rows then stay that
 * narrow. Match MessageList row `maxWidth: 80%` and horizontal padding so the
 * body always has a sensible minimum width for wrapping.
 */
const MESSAGE_LIST_CONTENT_PADDING_H = 10;
const BUBBLE_PADDING_H = 11;
const ROW_MAX_WIDTH_FRAC = 0.8;

/** Outside the tinted pre chip; pairs with a smaller `marginTop` on the following segment. */
const PRE_MARGIN_BOTTOM = 14;
/** Top spacing before a pre block (after previous segment). */
const PRE_MARGIN_TOP = 16;

/** Outside the heading line; following segment uses a small `marginTop` (like pre). */
const HEADING_MARGIN_BOTTOM = 12;
/** Space before a heading after normal body / link / list / quote. */
const HEADING_MARGIN_TOP = 16;
/** Heading immediately after another heading (rare in Gemtext). */
const HEADING_MARGIN_TOP_CHAIN = 10;
/** Heading after a pre block. */
const HEADING_MARGIN_TOP_AFTER_PRE = 10;
/** Gap after heading + `HEADING_MARGIN_BOTTOM` before next block’s top margin. */
const GAP_AFTER_HEADING = 6;

function messageBodyMinWidth(windowWidth: number): number {
  const contentInner = windowWidth - MESSAGE_LIST_CONTENT_PADDING_H * 2;
  const maxRow = contentInner * ROW_MAX_WIDTH_FRAC;
  const inner = maxRow - BUBBLE_PADDING_H * 2;
  return Math.max(120, Math.floor(inner));
}

export type GemtextLinkAction =
  | { type: "gemini_fetch"; url: string }
  | { type: "open_browser"; url: string };

export type IncomingGemtextChrome = "light" | "dark";

export type CodeBlockTheme = "bubble" | "terminal";

export type GemtextMessageBodyProps = {
  body: string;
  textColor: string;
  /** Link accent (bubble-aware from parent). */
  linkColor: string;
  baseUrl: string;
  /** Shapes quote / code chrome for incoming vs outgoing bubbles. */
  isOutgoing?: boolean;
  /**
   * When `isOutgoing` is false, whether the incoming bubble is a light or dark surface
   * (affects quote bar and pre background).
   */
  incomingChrome?: IncomingGemtextChrome;
  /** Visual style for ``` pre ``` blocks. */
  codeBlockTheme?: CodeBlockTheme;
  linksDisabled?: boolean;
  onGemtextLink?: (action: GemtextLinkAction, linkLabel: string) => void;
};

/**
 * Vertical gap before each segment (after the first). Uniform 4px made code blocks
 * and headings feel stuck to the following / preceding line; spacing depends on
 * what came before.
 */
function segmentBlockTopMargin(
  prev: GemtextSegment | undefined,
  curr: GemtextSegment,
): number {
  if (!prev) return 0;

  if (curr.type === "heading") {
    if (prev.type === "heading") return HEADING_MARGIN_TOP_CHAIN;
    if (prev.type === "pre") return HEADING_MARGIN_TOP_AFTER_PRE;
    return HEADING_MARGIN_TOP;
  }
  if (curr.type === "pre") {
    if (prev.type === "heading") return 10;
    return PRE_MARGIN_TOP;
  }
  if (curr.type === "quote") {
    if (prev.type === "pre") return 6;
    if (prev.type === "heading") return GAP_AFTER_HEADING;
    return prev.type === "quote" ? 5 : 8;
  }
  if (curr.type === "list") {
    if (prev.type === "pre") return 6;
    if (prev.type === "heading") return GAP_AFTER_HEADING;
    return prev.type === "list" ? 3 : 7;
  }

  // text or link
  if (prev.type === "pre") return 6;
  if (prev.type === "heading") return GAP_AFTER_HEADING;
  if (prev.type === "quote") return 7;
  if (prev.type === "list") return 6;
  return 6;
}

type GemtextInlineSegment = Extract<
  GemtextSegment,
  { type: "text" } | { type: "link" }
>;

type GemtextRow =
  | { kind: "inline"; segments: GemtextInlineSegment[] }
  | {
      kind: "block";
      segment: Exclude<GemtextSegment, GemtextInlineSegment>;
    };

/** One outer `Text selectable` per run so iOS shows selection handles, not only “Copy” per fragment. */
function groupGemtextRows(segments: GemtextSegment[]): GemtextRow[] {
  const rows: GemtextRow[] = [];
  let run: GemtextInlineSegment[] = [];
  const flush = () => {
    if (run.length > 0) {
      rows.push({ kind: "inline", segments: [...run] });
      run = [];
    }
  };
  for (const s of segments) {
    // Gemtext links are line-based (`=> ...`) so they should not merge into a
    // single inline run; otherwise consecutive links can appear on one row.
    if (s.type === "text") {
      run.push(s);
      continue;
    }
    if (s.type === "link") {
      flush();
      rows.push({ kind: "inline", segments: [s] });
      continue;
    }

    flush();
    rows.push({ kind: "block", segment: s });
  }
  flush();
  return rows;
}

function segmentKey(segment: GemtextSegment, index: number): string {
  switch (segment.type) {
    case "link":
      return `l-${index}-${segment.href}`;
    case "heading":
      return `h-${index}-${segment.level}`;
    case "text":
      return `t-${index}-${segment.text.slice(0, 24)}`;
    default:
      return `${segment.type}-${index}`;
  }
}

export function GemtextMessageBody({
  body,
  textColor,
  linkColor,
  baseUrl,
  isOutgoing = false,
  incomingChrome = "light",
  codeBlockTheme = "bubble",
  linksDisabled,
  onGemtextLink,
}: GemtextMessageBodyProps) {
  const segments = useMemo(() => parseGemtext(body), [body]);
  const { width: windowWidth } = useWindowDimensions();
  const needsWidthFloor = useMemo(
    () =>
      segments.some(
        (s) =>
          s.type === "list" || s.type === "pre" || s.type === "quote",
      ),
    [segments],
  );
  const rootLayout = useMemo(
    () =>
      needsWidthFloor
        ? { minWidth: messageBodyMinWidth(windowWidth) }
        : null,
    [needsWidthFloor, windowWidth],
  );

  const rowLayout = useMemo(() => {
    const grouped = groupGemtextRows(segments);
    const out: Array<{ row: GemtextRow; marginTop: number }> = [];
    let prevSeg: GemtextSegment | undefined;
    for (let ri = 0; ri < grouped.length; ri++) {
      const row = grouped[ri];
      const firstSeg = row.kind === "inline" ? row.segments[0] : row.segment;
      const marginTop = segmentBlockTopMargin(prevSeg, firstSeg);
      out.push({ row, marginTop });
      prevSeg =
        row.kind === "inline"
          ? row.segments[row.segments.length - 1]
          : row.segment;
    }
    return out;
  }, [segments]);

  return (
    <View style={[styles.root, rootLayout]}>
      {rowLayout.map(({ row, marginTop }, ri) => (
        <View key={`row-${ri}`} style={[styles.segmentWrap, { marginTop }]}>
          {row.kind === "inline" ? (
            <Text selectable style={[styles.bodyText, { color: textColor }]}>
              {row.segments.map((seg, si) => (
                <NestedInlinePiece
                  key={`${ri}-${si}-${segmentKey(seg, si)}`}
                  segment={seg}
                  textColor={textColor}
                  linkColor={linkColor}
                  baseUrl={baseUrl}
                  linksDisabled={linksDisabled}
                  onGemtextLink={onGemtextLink}
                />
              ))}
            </Text>
          ) : (
            <BlockSegment
              segment={row.segment}
              textColor={textColor}
              linkColor={linkColor}
              baseUrl={baseUrl}
              isOutgoing={isOutgoing}
              incomingChrome={incomingChrome}
              codeBlockTheme={codeBlockTheme}
              linksDisabled={linksDisabled}
              onGemtextLink={onGemtextLink}
            />
          )}
        </View>
      ))}
    </View>
  );
}

function NestedInlinePiece({
  segment,
  textColor,
  linkColor,
  baseUrl,
  linksDisabled,
  onGemtextLink,
}: {
  segment: GemtextInlineSegment;
  textColor: string;
  linkColor: string;
  baseUrl: string;
  linksDisabled?: boolean;
  onGemtextLink?: (action: GemtextLinkAction, linkLabel: string) => void;
}) {
  if (segment.type === "text") {
    return (
      <Text style={[styles.bodyText, { color: textColor }]}>
        {segment.text}
      </Text>
    );
  }

  let resolved: string;
  try {
    resolved = resolveGeminiLinkHref(segment.href, baseUrl).trim();
  } catch {
    return (
      <Text style={[styles.bodyText, styles.muted, { color: textColor }]}>
        {segment.label}
      </Text>
    );
  }

  if (/^https?:\/\//i.test(resolved)) {
    const canPress = Boolean(onGemtextLink && !linksDisabled);
    return (
      <Text
        style={[
          styles.bodyText,
          styles.link,
          { color: linkColor },
          !canPress && styles.muted,
        ]}
        {...(canPress && onGemtextLink
          ? {
              onPress: () =>
                onGemtextLink(
                  { type: "open_browser", url: resolved },
                  segment.label,
                ),
            }
          : {})}
      >
        {segment.label}
      </Text>
    );
  }

  if (/^gemini:\/\//i.test(resolved)) {
    const canPress = Boolean(onGemtextLink && !linksDisabled);
    return (
      <Text
        style={[
          styles.bodyText,
          styles.link,
          { color: linkColor },
          !canPress && styles.muted,
        ]}
        {...(canPress && onGemtextLink
          ? {
              onPress: () =>
                onGemtextLink(
                  { type: "gemini_fetch", url: resolved },
                  segment.label,
                ),
            }
          : {})}
      >
        {segment.label}
      </Text>
    );
  }

  return (
    <Text style={[styles.bodyText, styles.muted, { color: textColor }]}>
      {segment.label}
    </Text>
  );
}

function BlockSegment({
  segment,
  textColor,
  linkColor,
  baseUrl,
  isOutgoing,
  incomingChrome,
  codeBlockTheme,
  linksDisabled,
  onGemtextLink,
}: {
  segment: Exclude<GemtextSegment, GemtextInlineSegment>;
  textColor: string;
  linkColor: string;
  baseUrl: string;
  isOutgoing: boolean;
  incomingChrome: IncomingGemtextChrome;
  codeBlockTheme: CodeBlockTheme;
  linksDisabled?: boolean;
  onGemtextLink?: (action: GemtextLinkAction, linkLabel: string) => void;
}) {
  switch (segment.type) {
    case "heading": {
      const step = segment.level === 1 ? 1 : segment.level === 2 ? 0 : -1;
      const size = BODY_SIZE + step;
      const lh = Math.round(size * 1.38);
      return (
        <Text
          selectable
          style={[
            styles.heading,
            styles.headingWrap,
            {
              color: textColor,
              fontSize: size,
              lineHeight: lh,
            },
          ]}
        >
          {segment.text}
        </Text>
      );
    }
    case "quote":
      return (
        <Text
          selectable
          style={[
            styles.bodyText,
            styles.quoteText,
            styles.quoteBar,
            styles.segmentWidth,
            isOutgoing
              ? styles.quoteBarOutgoing
              : incomingChrome === "dark"
                ? styles.quoteBarIncomingDark
                : styles.quoteBarIncoming,
            { color: textColor },
          ]}
        >
          {segment.text}
        </Text>
      );
    case "list":
      return (
        <Text
          selectable
          style={[styles.bodyText, styles.listRowText, { color: textColor }]}
        >
          <Text style={[styles.listBulletInline, { color: textColor }]}>
            {"\u2022 "}
          </Text>
          <Text style={[styles.bodyText, styles.listContent]}>
            {segment.text}
          </Text>
        </Text>
      );
    case "pre": {
      const lines = segment.text.split("\n");
      const terminal = codeBlockTheme === "terminal";
      const preTextColor = terminal
        ? "rgba(255, 255, 255, 0.92)"
        : textColor;
      return (
        <View
          style={[
            styles.preWrap,
            styles.segmentWidth,
            terminal
              ? styles.preWrapTerminal
              : isOutgoing
                ? styles.preWrapOutgoing
                : incomingChrome === "dark"
                  ? styles.preWrapIncomingDark
                  : styles.preWrapIncoming,
          ]}
        >
          <ScrollView
            horizontal
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            showsHorizontalScrollIndicator
            style={styles.preHorizontalScroll}
            contentContainerStyle={styles.preHorizontalScrollContent}
          >
            <View style={styles.preTextColumn}>
              {lines.map((line, li) => (
                <Text
                  key={li}
                  selectable
                  numberOfLines={1}
                  {...(Platform.OS === "android"
                    ? { textBreakStrategy: "simple" as const }
                    : {})}
                  style={[styles.preText, { color: preTextColor }]}
                >
                  {parseAnsiSgrToRuns(line, preTextColor).map((run, ri) => (
                    <Text key={ri} style={run.style}>
                      {run.text}
                    </Text>
                  ))}
                </Text>
              ))}
            </View>
          </ScrollView>
        </View>
      );
    }
    default:
      return null;
  }
}

const styles = StyleSheet.create({
  root: {
    alignSelf: "stretch",
    alignItems: "stretch",
    flexGrow: 0,
  },
  segmentWrap: {
    alignSelf: "stretch",
  },
  segmentWidth: {
    alignSelf: "stretch",
  },
  bodyText: {
    fontSize: BODY_SIZE,
    lineHeight: BODY_LH,
    letterSpacing: Platform.OS === "ios" ? -0.24 : 0,
  },
  /** Telegram-style links: colored, medium weight, no underline. */
  link: {
    fontWeight: Platform.OS === "ios" ? "400" : "normal",
    textDecorationLine: "none",
  },
  muted: {
    opacity: 0.72,
  },
  headingWrap: {
    alignSelf: "stretch",
    marginBottom: HEADING_MARGIN_BOTTOM,
  },
  heading: {
    fontWeight: "600",
    letterSpacing: Platform.OS === "ios" ? -0.35 : 0,
  },
  quoteBar: {
    borderLeftWidth: 3,
    paddingLeft: 10,
    paddingVertical: 4,
  },
  quoteBarIncoming: {
    borderLeftColor: "rgba(0, 0, 0, 0.22)",
  },
  quoteBarIncomingDark: {
    borderLeftColor: "rgba(255, 255, 255, 0.28)",
  },
  quoteBarOutgoing: {
    borderLeftColor: "rgba(255, 255, 255, 0.45)",
  },
  quoteText: {
    fontStyle: "italic",
    opacity: 0.95,
  },
  /** Outer selectable `Text` for list rows (bullet + line as nested runs). */
  listRowText: {
    alignSelf: "stretch",
  },
  listBulletInline: {
    fontSize: BODY_SIZE,
    lineHeight: BODY_LH,
    opacity: 0.85,
  },
  listContent: {
    flex: 1,
  },
  preWrap: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 10,
    marginBottom: PRE_MARGIN_BOTTOM,
  },
  preWrapIncoming: {
    backgroundColor: "rgba(0, 0, 0, 0.06)",
  },
  preWrapIncomingDark: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  preWrapOutgoing: {
    backgroundColor: "rgba(255, 255, 255, 0.18)",
  },
  preWrapTerminal: {
    backgroundColor: "#0b0f14",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  /**
   * Nested in the dialog `ScrollView`, horizontal `ScrollView` defaults to `flexGrow: 1`
   * and expands to the viewport height — empty space inside the bubble and timestamp
   * pushed off-screen. Shrink-wrap vertically instead.
   */
  preHorizontalScroll: {
    flexGrow: 0,
    flexShrink: 0,
    alignSelf: "stretch",
  },
  preHorizontalScrollContent: {
    flexGrow: 0,
  },
  /** Intrinsic width = widest line; avoids underestimating width (RN wraps when `width` is too small). */
  preTextColumn: {
    alignSelf: "flex-start",
    flexShrink: 0,
  },
  preText: {
    fontFamily: mono,
    fontSize: Platform.OS === "ios" ? 14 : 13,
    lineHeight: Platform.OS === "ios" ? 21 : 20,
    ...(Platform.OS === "android" ? { includeFontPadding: false as const } : {}),
  },
});
