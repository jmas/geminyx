import { HeaderButton } from "@react-navigation/elements";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useCallback, useLayoutEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePopupManager } from "react-popup-manager";
import { CapsuleAvatar } from "components/capsule/CapsuleAvatar";
import { selectCapsuleUiPalette } from "components/capsule/capsuleUiPalette";
import { BlobViewModal } from "components/message/BlobViewModal";
import { MessageAttachmentBubble } from "components/message/MessageAttachmentBubble";
import { useAccountActive } from "hooks/account/useAccountActive";
import { useDateFormatter } from "hooks/useDateFormatter";
import type { ThreadMessage } from "lib/models/threadMessage";
import { queryKeys } from "lib/queryKeys";
import {
  headerTitleColorForScheme,
  rootScreenBackgroundForScheme,
  systemBlueForScheme,
} from "lib/theme/appColors";
import { threadConversationPaletteForScheme } from "lib/theme/semanticUi";
import { capsulesRepo, messagesRepo } from "repositories";
import { alertError } from "utils/error";
import { firstParam } from "utils/searchParams";

const CAPSULE_VIEW_EDIT_ICON_SIZE = 24;

const BLOB_REF_BODY = /^\[blob: ([^\]]+)\]$/;

function blobPointerReady(message: ThreadMessage): boolean {
  const bodyTrim = message.body?.trim() ?? "";
  const m = BLOB_REF_BODY.exec(bodyTrim);
  return Boolean(message.blobId && m && m[1] === message.blobId);
}

export function CapsuleViewScreen() {
  const { t } = useTranslation();
  const dateFmt = useDateFormatter();
  const navigation = useNavigation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const palette = selectCapsuleUiPalette(scheme);
  const threadPalette = useMemo(
    () => threadConversationPaletteForScheme(scheme),
    [scheme],
  );
  const popupManager = usePopupManager();
  const bg = rootScreenBackgroundForScheme(scheme);
  const tint = systemBlueForScheme(scheme);
  const titleColor = headerTitleColorForScheme(scheme);

  const params = useLocalSearchParams<{ id: string }>();
  const capsuleId = firstParam(params.id) ?? "";

  const queryClient = useQueryClient();
  const { data: activeAccount, isPending: activePending } = useAccountActive();
  const [addToLibraryPending, setAddToLibraryPending] = useState(false);

  const {
    data: capsule,
    isLoading: loading,
    refetch: refetchCapsule,
  } = useQuery({
    queryKey: [...queryKeys.capsules.detail(capsuleId), activeAccount?.id ?? "none"],
    queryFn: async () => {
      if (!activeAccount?.id) return null;
      try {
        return await capsulesRepo.getByIdForAccount(activeAccount.id, capsuleId);
      } catch {
        return null;
      }
    },
    enabled: Boolean(capsuleId) && !activePending,
  });

  const {
    data: blobMessages = [],
    refetch: refetchBlobMedia,
    isPending: blobMediaPending,
  } = useQuery({
    queryKey: [
      ...queryKeys.capsules.blobMedia(capsuleId),
      activeAccount?.id ?? "none",
    ],
    queryFn: async () => {
      if (!activeAccount?.id || !capsuleId) return [];
      return messagesRepo.listBlobMessagesForThreadDesc(capsuleId);
    },
    enabled: Boolean(capsuleId) && !activePending && Boolean(activeAccount?.id),
  });

  const openBlobModal = useCallback(
    (message: ThreadMessage) => {
      const id = message.blobId?.trim();
      if (!id) return;
      popupManager.open(BlobViewModal, { blobId: id });
    },
    [popupManager],
  );

  useFocusEffect(
    useCallback(() => {
      if (!capsuleId) return;
      void refetchCapsule();
      void refetchBlobMedia();
    }, [capsuleId, refetchCapsule, refetchBlobMedia]),
  );

  const notFound = !loading && !capsule;

  const onOpenThread = useCallback(() => {
    if (!capsule) return;
    router.push({
      pathname: "/thread/[id]",
      params: { id: capsule.id, name: capsule.name },
    } as unknown as Href);
  }, [capsule, router]);

  const onEdit = useCallback(() => {
    if (!capsule) return;
    router.push({
      pathname: "/capsule/edit/[id]",
      params: { id: capsule.id },
    } as unknown as Href);
  }, [capsule, router]);

  const isHiddenFromLibrary = capsule?.libraryVisible === false;

  useLayoutEffect(() => {
    const showEditInHeader = Boolean(capsule) && !isHiddenFromLibrary;
    if (!showEditInHeader) {
      navigation.setOptions({
        title: t("capsules.viewTitle"),
        headerRight: undefined,
        headerRightContainerStyle: undefined,
      });
      return;
    }
    navigation.setOptions({
      title: t("capsules.viewTitle"),
      headerRightContainerStyle: { paddingRight: 8 },
      headerRight: () => (
        <HeaderButton
          onPress={onEdit}
          accessibilityLabel={t("capsules.a11yEditCapsule")}
        >
          <Ionicons
            name="create-outline"
            size={CAPSULE_VIEW_EDIT_ICON_SIZE}
            color={titleColor}
            style={
              Platform.OS === "ios"
                ? { lineHeight: CAPSULE_VIEW_EDIT_ICON_SIZE }
                : undefined
            }
          />
        </HeaderButton>
      ),
    });
  }, [capsule, isHiddenFromLibrary, navigation, onEdit, titleColor, t]);

  const onAddCapsuleToLibrary = useCallback(() => {
    if (!capsule) return;
    void (async () => {
      try {
        setAddToLibraryPending(true);
        await capsulesRepo.patch(capsule.id, { libraryVisible: true });
        void queryClient.invalidateQueries({
          queryKey: queryKeys.capsules.all,
        });
        void queryClient.invalidateQueries({
          queryKey: queryKeys.threads.all,
        });
        router.push(`/capsule/edit/${capsule.id}` as Href);
      } catch (e) {
        console.error(e);
        alertError(
          e,
          t("capsules.errorAddToLibrary"),
          t("capsules.errorAddToLibraryTitle"),
        );
      } finally {
        setAddToLibraryPending(false);
      }
    })();
  }, [capsule, queryClient, router, t]);

  const description = useMemo(
    () => capsule?.description?.trim() ?? "",
    [capsule?.description],
  );

  const bottomPad = Math.max(insets.bottom, 24);

  if (!capsuleId) {
    return (
      <View style={[styles.centered, { backgroundColor: bg }]}>
        <Text style={{ color: palette.textPrimary }}>
          {t("capsuleEdit.missingId")}
        </Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: bg }]}>
        <ActivityIndicator />
      </View>
    );
  }

  if (notFound || !capsule) {
    return (
      <View style={[styles.centered, { backgroundColor: bg }]}>
        <Text style={{ color: palette.textPrimary }}>
          {t("capsuleEdit.notFound")}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: bg }]}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: bottomPad, paddingTop: 24 },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.hero}>
        <CapsuleAvatar
          capsuleId={capsule.id}
          name={capsule.name}
          emoji={capsule.avatarIcon}
          size={112}
        />
        <Text style={[styles.name, { color: titleColor }]}>{capsule.name}</Text>
        {description ? (
          <Text
            style={[styles.description, { color: palette.textSecondary }]}
          >
            {description}
          </Text>
        ) : null}
      </View>

      <Pressable
        onPress={onOpenThread}
        style={({ pressed }) => [
          styles.primaryBtn,
          {
            backgroundColor: tint,
            opacity: pressed ? 0.88 : 1,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={t("capsules.openThread")}
      >
        <Ionicons name="chatbubbles-outline" size={22} color="#ffffff" />
        <Text style={styles.primaryBtnLabel}>{t("capsules.openThread")}</Text>
      </Pressable>

      {isHiddenFromLibrary ? (
        <Pressable
          onPress={onAddCapsuleToLibrary}
          disabled={addToLibraryPending}
          style={({ pressed }) => [
            styles.editBtn,
            {
              borderColor: tint,
              opacity: addToLibraryPending ? 0.55 : pressed ? 0.75 : 1,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={t("capsules.a11yAddToLibrary")}
        >
          {addToLibraryPending ? (
            <ActivityIndicator color={tint} />
          ) : (
            <>
              <Ionicons name="add-outline" size={22} color={tint} />
              <Text style={[styles.editBtnLabel, { color: tint }]}>
                {t("capsules.addCapsuleToLibraryButton")}
              </Text>
            </>
          )}
        </Pressable>
      ) : null}

      {!blobMediaPending && blobMessages.length > 0 ? (
        <View
          style={[
            styles.mediaFullBleed,
            { backgroundColor: palette.listRowSurface },
          ]}
        >
          <Text
            style={[styles.mediaSectionTitle, { color: titleColor }]}
            accessibilityRole="header"
          >
            {t("capsules.mediaSectionTitle")}
          </Text>
          {blobMessages.map((message, index) => {
            const outgoing = message.isOutgoing;
            const textColor = outgoing
              ? threadPalette.textOutgoing
              : threadPalette.textIncoming;
            const mutedColor = outgoing
              ? threadPalette.timeOutgoing
              : threadPalette.timeIncoming;
            const pointerOk = blobPointerReady(message);
            const blobByteLen =
              message.blobContentLength ?? message.contentLength;
            return (
              <View key={message.id}>
                {index > 0 ? (
                  <View
                    style={[
                      styles.mediaSeparator,
                      { backgroundColor: palette.separator },
                    ]}
                  />
                ) : null}
                <View style={styles.mediaRow}>
                  <Text
                    style={[styles.mediaDate, { color: palette.textSecondary }]}
                  >
                    {dateFmt.formatLastMessageDate(message.sentAt)}
                  </Text>
                  <MessageAttachmentBubble
                    mimeType={message.blobMimeType}
                    byteLength={blobByteLen}
                    fileName={message.blobFileName}
                    outgoing={outgoing}
                    textColor={textColor}
                    mutedColor={mutedColor}
                    pending={!pointerOk}
                    onPress={
                      pointerOk
                        ? () => openBlobModal(message)
                        : undefined
                    }
                  />
                </View>
              </View>
            );
          })}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    paddingHorizontal: 24,
  },
  hero: {
    alignItems: "center",
    marginBottom: 32,
  },
  name: {
    marginTop: 16,
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
  },
  description: {
    marginTop: 10,
    fontSize: 16,
    lineHeight: 22,
    textAlign: "center",
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    paddingVertical: 14,
    minHeight: 48,
    gap: 10,
  },
  primaryBtnLabel: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "600",
  },
  editBtn: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    paddingVertical: 14,
    minHeight: 48,
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  editBtnLabel: {
    fontSize: 17,
    fontWeight: "600",
  },
  mediaFullBleed: {
    marginHorizontal: -24,
    marginTop: 24,
    alignSelf: "stretch",
    paddingTop: 16,
    paddingBottom: 8,
  },
  mediaSectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.2,
    textTransform: "uppercase",
    paddingHorizontal: 24,
    marginBottom: 12,
  },
  mediaSeparator: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 24,
  },
  mediaRow: {
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  mediaDate: {
    fontSize: 13,
    marginBottom: 8,
    fontVariant: ["tabular-nums"],
  },
});
