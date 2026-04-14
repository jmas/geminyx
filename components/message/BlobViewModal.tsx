import { Audio, ResizeMode, Video } from "expo-av";
import {
  cacheDirectory,
  EncodingType,
  writeAsStringAsync,
} from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { useCallback, useEffect, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  useWindowDimensions,
  View,
  type ColorValue,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { selectCapsuleUiPalette } from "components/capsule/capsuleUiPalette";
import { ZoomableFullscreenImage } from "components/message/ZoomableFullscreenImage";
import { uint8ArrayToBase64 } from "lib/db/utils";
import { blobMediaKind, extensionForBlobMime } from "lib/models/blobMedia";
import { blobsRepo, type BlobViewPayload } from "repositories";
import { formatByteCount } from "utils/formatBytes";
import { alertError } from "utils/error";

function formatPlaybackTime(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "0:00";
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export type BlobViewModalProps = {
  isOpen: boolean;
  onClose?: () => void;
  blobId: string;
};

function AudioBlobPlayer({
  fileUri,
  labelColor,
  accentColor,
  trackBgColor,
}: {
  fileUri: string;
  labelColor: ColorValue;
  accentColor: ColorValue;
  trackBgColor: ColorValue;
}) {
  const soundRef = useRef<Audio.Sound | null>(null);
  const trackWidthRef = useRef(0);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [playing, setPlaying] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    Audio.setAudioModeAsync({ playsInSilentModeIOS: true }).catch(() => {});
    (async () => {
      try {
        const { sound } = await Audio.Sound.createAsync(
          { uri: fileUri },
          { progressUpdateIntervalMillis: 250 },
        );
        if (cancelled) {
          await sound.unloadAsync();
          return;
        }
        soundRef.current = sound;
        sound.setOnPlaybackStatusUpdate((s) => {
          if (!s.isLoaded) return;
          setPositionMs(s.positionMillis);
          if (s.durationMillis != null && s.durationMillis > 0) {
            setDurationMs(s.durationMillis);
          }
          setPlaying(s.isPlaying);
          if (s.didJustFinish) {
            setPlaying(false);
            setPositionMs(0);
          }
        });
        setPhase("ready");
      } catch {
        if (!cancelled) setPhase("error");
      }
    })();
    return () => {
      cancelled = true;
      const s = soundRef.current;
      soundRef.current = null;
      s?.unloadAsync().catch(() => {});
    };
  }, [fileUri]);

  const toggle = useCallback(async () => {
    const s = soundRef.current;
    if (!s) return;
    const st = await s.getStatusAsync();
    if (!st.isLoaded) return;
    if (st.isPlaying) {
      // expo-av Sound declares uninitialized `pauseAsync`/`playAsync` fields that shadow
      // PlaybackMixin on the prototype; use setStatusAsync instead.
      await s.setStatusAsync({ shouldPlay: false });
    } else {
      await s.setStatusAsync({ shouldPlay: true });
    }
  }, []);

  const onTrackLayout = useCallback((e: LayoutChangeEvent) => {
    trackWidthRef.current = e.nativeEvent.layout.width;
  }, []);

  const onSeekPress = useCallback(
    (e: GestureResponderEvent) => {
      const s = soundRef.current;
      const dur = durationMs;
      const w = trackWidthRef.current;
      if (!s || dur == null || dur <= 0 || w <= 0) return;
      const x = e.nativeEvent.locationX;
      const ratio = Math.max(0, Math.min(1, x / w));
      const pos = Math.round(ratio * dur);
      void (async () => {
        const st = await s.getStatusAsync();
        if (!st.isLoaded) return;
        await s.setStatusAsync({
          positionMillis: pos,
          shouldPlay: st.isPlaying,
        });
      })();
    },
    [durationMs],
  );

  const progress =
    durationMs != null && durationMs > 0
      ? Math.min(1, Math.max(0, positionMs / durationMs))
      : 0;

  if (phase === "loading") {
    return <ActivityIndicator color={accentColor} />;
  }
  if (phase === "error") {
    return (
      <Text style={[styles.audioError, { color: labelColor }]}>
        Could not load audio.
      </Text>
    );
  }

  return (
    <View style={styles.audioPlayer}>
      <View style={styles.audioTimeRow}>
        <Text
          style={[styles.audioTime, { color: labelColor }]}
          numberOfLines={1}
        >
          {formatPlaybackTime(positionMs)}
        </Text>
        <Text
          style={[styles.audioTime, { color: labelColor }]}
          numberOfLines={1}
        >
          {durationMs != null ? formatPlaybackTime(durationMs) : "—"}
        </Text>
      </View>
      <Pressable
        accessibilityRole="adjustable"
        accessibilityLabel="Seek audio"
        onLayout={onTrackLayout}
        onPress={onSeekPress}
        style={({ pressed }) => [
          styles.progressHitArea,
          { opacity: pressed ? 0.92 : 1 },
        ]}
      >
        <View
          style={[styles.progressTrackOuter, { backgroundColor: trackBgColor }]}
        >
          <View
            style={[
              styles.progressFill,
              { width: `${progress * 100}%`, backgroundColor: accentColor },
            ]}
          />
        </View>
      </Pressable>
      <Pressable
        onPress={toggle}
        style={({ pressed }) => [
          styles.playBtn,
          { borderColor: accentColor, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Ionicons
          name={playing ? "pause" : "play"}
          size={22}
          color={accentColor}
        />
        <Text style={[styles.playBtnLabel, { color: accentColor }]}>
          {playing ? "Pause" : "Play"}
        </Text>
      </Pressable>
    </View>
  );
}

const SHEET_CHROME_ESTIMATE = 200;

export function BlobViewModal({ isOpen, onClose, blobId }: BlobViewModalProps) {
  const scheme = useColorScheme();
  const sheet = selectCapsuleUiPalette(scheme);
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const dismiss = onClose ?? (() => {});

  const windowH =
    windowHeight > 0 ? windowHeight : Dimensions.get("window").height;
  const sheetMaxHeight = Math.max(320, windowH * 0.92);
  const scrollMaxHeight = Math.max(160, sheetMaxHeight - SHEET_CHROME_ESTIMATE);

  const [phase, setPhase] = useState<"idle" | "loading" | "error" | "ready">(
    "idle",
  );
  const [payload, setPayload] = useState<BlobViewPayload | null>(null);
  const [cacheUri, setCacheUri] = useState<string | null>(null);
  const [imageFullscreen, setImageFullscreen] = useState(false);

  useEffect(() => {
    if (!isOpen || !blobId.trim()) {
      setPhase("idle");
      setPayload(null);
      setCacheUri(null);
      return;
    }

    let cancelled = false;
    setPhase("loading");
    setPayload(null);
    setCacheUri(null);

    (async () => {
      try {
        const p = await blobsRepo.getBlobViewPayload(blobId.trim());
        if (cancelled) return;
        if (!p) {
          setPhase("error");
          return;
        }
        setPayload(p);
        const kind = blobMediaKind(p.mimeType);
        if (kind === "image") {
          setPhase("ready");
          return;
        }
        const ext = extensionForBlobMime(p.mimeType);
        const base = cacheDirectory;
        if (!base) {
          setPhase("error");
          return;
        }
        const path = `${base}blob-view-${blobId}.${ext}`;
        await writeAsStringAsync(path, uint8ArrayToBase64(p.body), {
          encoding: EncodingType.Base64,
        });
        if (cancelled) return;
        setCacheUri(path);
        setPhase("ready");
      } catch (e) {
        if (!cancelled) {
          setPhase("error");
          console.error(e);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, blobId]);

  useEffect(() => {
    if (!isOpen) setImageFullscreen(false);
  }, [isOpen]);

  const onShareFile = useCallback(async () => {
    if (!payload) return;
    try {
      const ext = extensionForBlobMime(payload.mimeType);
      const base = cacheDirectory;
      if (!base) {
        alertError(null, "File cache is not available on this device.");
        return;
      }
      const path = `${base}blob-share-${blobId}.${ext}`;
      await writeAsStringAsync(path, uint8ArrayToBase64(payload.body), {
        encoding: EncodingType.Base64,
      });
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        alertError(null, "Sharing is not available on this device.");
        return;
      }
      await Sharing.shareAsync(path, {
        mimeType: payload.mimeType,
        dialogTitle: "Share file",
      });
    } catch (e) {
      alertError(e, "Could not share file.");
    }
  }, [blobId, payload]);

  const label = sheet.textPrimary as ColorValue;
  const secondary = sheet.textSecondary as ColorValue;
  const accent = sheet.addLabel as ColorValue;

  const kind = payload ? blobMediaKind(payload.mimeType) : "other";
  const base64 =
    payload && kind === "image"
      ? uint8ArrayToBase64(payload.body)
      : null;
  const dataUri =
    base64 && payload
      ? `data:${payload.mimeType};base64,${base64}`
      : null;

  if (!isOpen) {
    return null;
  }

  const onModalRequestClose = useCallback(() => {
    if (imageFullscreen) {
      setImageFullscreen(false);
      return;
    }
    dismiss();
  }, [dismiss, imageFullscreen]);

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="fade"
      onRequestClose={onModalRequestClose}
    >
      <View style={styles.backdropContainer}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close attachment"
          onPress={dismiss}
          style={styles.backdrop}
        />
        <View
          style={[
            styles.sheet,
            {
              maxHeight: sheetMaxHeight,
              backgroundColor: sheet.background,
            },
          ]}
        >
          <View style={styles.grabberWrap}>
            <View
              style={[styles.grabber, { backgroundColor: sheet.sheetHandle }]}
            />
          </View>
          <Text
            style={[styles.title, { color: label }]}
            accessibilityRole="header"
          >
            Attachment
          </Text>

          <ScrollView
            style={{ maxHeight: scrollMaxHeight }}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="always"
            bounces
          >
            {phase === "loading" ? (
              <ActivityIndicator color={accent} style={styles.loader} />
            ) : null}
            {phase === "error" ? (
              <Text style={[styles.err, { color: sheet.error }]}>
                Could not load this attachment.
              </Text>
            ) : null}
            {phase === "ready" && payload ? (
              <View style={styles.body}>
                <Text style={[styles.meta, { color: secondary }]}>
                  {payload.fileName
                    ? `${payload.fileName} · ${payload.mimeType} · ${formatByteCount(payload.contentLength)}`
                    : `${payload.mimeType} · ${formatByteCount(payload.contentLength)}`}
                </Text>
                {kind === "image" && dataUri ? (
                  <Pressable
                    accessibilityRole="imagebutton"
                    accessibilityLabel="View image full screen"
                    onPress={() => setImageFullscreen(true)}
                    style={({ pressed }) => [
                      styles.imagePressable,
                      { opacity: pressed ? 0.92 : 1 },
                    ]}
                  >
                    <Image
                      source={{ uri: dataUri }}
                      style={styles.image}
                      resizeMode="contain"
                    />
                  </Pressable>
                ) : null}
                {kind === "video" && cacheUri ? (
                  <Video
                    style={styles.video}
                    source={{ uri: cacheUri }}
                    useNativeControls
                    resizeMode={ResizeMode.CONTAIN}
                  />
                ) : null}
                {kind === "audio" && cacheUri ? (
                  <View style={styles.audioWrap}>
                    <AudioBlobPlayer
                      fileUri={cacheUri}
                      labelColor={label}
                      accentColor={accent}
                      trackBgColor={sheet.separator}
                    />
                  </View>
                ) : null}
                {kind === "other" ? (
                  <Text style={[styles.otherHint, { color: secondary }]}>
                    Preview is not available for this type. Use Share file to
                    open or save it in another app.
                  </Text>
                ) : null}
                <Pressable
                  onPress={onShareFile}
                  accessibilityRole="button"
                  accessibilityLabel="Share file"
                  style={({ pressed }) => [
                    styles.shareFileBtn,
                    {
                      backgroundColor: sheet.listRowSurface,
                      borderColor: accent,
                      opacity: pressed ? 0.92 : 1,
                    },
                  ]}
                  android_ripple={{ color: accent, foreground: true }}
                >
                  <Ionicons name="share-outline" size={20} color={accent} />
                  <Text style={[styles.shareFileBtnLabel, { color: accent }]}>
                    Share file
                  </Text>
                </Pressable>
              </View>
            ) : null}
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
                styles.doneBtn,
                pressed && { opacity: 0.55 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Done"
            >
              <Text style={[styles.doneLabel, { color: accent }]}>Done</Text>
            </Pressable>
          </View>
        </View>
      </View>
      <ZoomableFullscreenImage
        embedded
        visible={imageFullscreen && !!dataUri}
        uri={dataUri ?? ""}
        onClose={() => setImageFullscreen(false)}
        onSharePress={onShareFile}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdropContainer: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    width: "100%",
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 18,
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
  title: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
    paddingHorizontal: 20,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    paddingTop: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  doneBtn: {
    minHeight: 44,
    minWidth: 120,
    justifyContent: "center",
    alignItems: "center",
  },
  doneLabel: {
    fontSize: 17,
    fontWeight: "600",
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingBottom: 24,
  },
  loader: {
    marginTop: 32,
  },
  err: {
    marginTop: 16,
    fontSize: 16,
  },
  body: {
    marginTop: 8,
  },
  meta: {
    fontSize: 14,
    marginBottom: 14,
  },
  imagePressable: {
    width: "100%",
    borderRadius: 12,
    overflow: "hidden",
  },
  image: {
    width: "100%",
    minHeight: 200,
    maxHeight: 480,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.06)",
  },
  video: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: 12,
    backgroundColor: "#000",
  },
  audioWrap: {
    paddingVertical: 24,
    alignSelf: "stretch",
  },
  audioPlayer: {
    width: "100%",
    gap: 12,
    alignItems: "center",
  },
  audioTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
  },
  audioTime: {
    fontSize: 13,
    fontWeight: "500",
    fontVariant: ["tabular-nums"],
  },
  progressHitArea: {
    width: "100%",
    paddingVertical: 12,
    justifyContent: "center",
  },
  progressTrackOuter: {
    width: "100%",
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
  },
  playBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  playBtnLabel: {
    fontSize: 17,
    fontWeight: "600",
  },
  audioError: {
    fontSize: 15,
  },
  otherHint: {
    fontSize: 15,
    lineHeight: 21,
    marginBottom: 4,
  },
  shareFileBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignSelf: "stretch",
    gap: 10,
  },
  shareFileBtnLabel: {
    fontSize: 17,
    fontWeight: "600",
    letterSpacing: -0.25,
  },
});
