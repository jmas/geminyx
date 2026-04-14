import { HeaderButton } from "@react-navigation/elements";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { router, type Href } from "expo-router";
import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
  type ColorValue,
} from "react-native";
import { useTranslation } from "react-i18next";
import type { SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";
import { CapsuleAvatar } from "components/capsule/CapsuleAvatar";
import { SwipeToDeleteRow } from "components/ui/SwipeToDeleteRow";
import { useAccountActive } from "hooks/account/useAccountActive";
import type { Thread } from "lib/models/thread";
import { queryKeys } from "lib/queryKeys";
import {
  destructiveTintColor,
  headerTitleColorForScheme,
  systemBlueForScheme,
} from "lib/theme/appColors";
import { threadListPaletteForScheme } from "lib/theme/semanticUi";
import type { TFunction } from "i18next";
import { threadsRepo } from "repositories";
import { formatLastMessageDate } from "utils/formatLastMessageDate";
import { geminiUrlForThreadNavigationOrAlert } from "utils/geminiUrlNavigation";

const LONG_PRESS_MS = 450;

type ListPalette = ReturnType<typeof threadListPaletteForScheme>;

export function ThreadListScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const scheme = useColorScheme();
  const palette = useMemo(
    () => threadListPaletteForScheme(scheme),
    [scheme],
  );
  const tint = systemBlueForScheme(scheme);
  const headerTint = headerTitleColorForScheme(scheme);
  const openSwipeRef = useRef<SwipeableMethods | null>(null);

  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  /** Android only — iOS uses `Alert.prompt`. */
  const [openUrlModal, setOpenUrlModal] = useState(false);
  const [openUrlDraft, setOpenUrlDraft] = useState("");
  const [listRefreshing, setListRefreshing] = useState(false);

  const queryClient = useQueryClient();
  const {
    data: activeAccount,
    isPending: activeAccountPending,
  } = useAccountActive();
  const {
    data: threads = [],
    isPending: threadsPending,
    refetch: refetchThreads,
  } = useQuery({
    queryKey: [...queryKeys.threads.listForActive(), activeAccount?.id ?? "none"],
    queryFn: async () => {
      if (!activeAccount?.id) return [];
      return threadsRepo.listForAccount(activeAccount.id);
    },
    enabled: !activeAccountPending,
  });

  useFocusEffect(
    useCallback(() => {
      void refetchThreads();
    }, [refetchThreads]),
  );

  const refreshLists = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: queryKeys.threads.listForActive(),
    });
    await queryClient.invalidateQueries({
      queryKey: queryKeys.capsules.listForActive(),
    });
  }, [queryClient]);

  const onPullToRefresh = useCallback(async () => {
    setListRefreshing(true);
    try {
      await refreshLists();
      await refetchThreads();
    } finally {
      setListRefreshing(false);
    }
  }, [refreshLists, refetchThreads]);

  const exitSelectMode = useCallback(() => {
    setSelecting(false);
    setSelectedIds([]);
    openSwipeRef.current?.close();
    openSwipeRef.current = null;
  }, []);

  const pushOpenGeminiThread = useCallback((url: string) => {
    router.push({
      pathname: "/capsules/create",
      params: { url },
    } as unknown as Href);
  }, []);

  const openGeminiUrlModal = useCallback(() => {
    if (Platform.OS === "ios") {
      Alert.prompt(
        t("threads.openUrlPromptTitle"),
        t("threads.openUrlPromptMsg"),
        [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("common.open"),
            onPress: (value?: string) => {
              const ok = geminiUrlForThreadNavigationOrAlert(value);
              if (ok) pushOpenGeminiThread(ok);
            },
          },
        ],
        "plain-text",
        "",
        "url",
      );
      return;
    }
    setOpenUrlDraft("");
    setOpenUrlModal(true);
  }, [pushOpenGeminiThread, t]);

  const submitOpenGeminiUrl = useCallback(() => {
    const ok = geminiUrlForThreadNavigationOrAlert(openUrlDraft);
    if (!ok) return;
    setOpenUrlModal(false);
    pushOpenGeminiThread(ok);
  }, [openUrlDraft, pushOpenGeminiThread]);

  const enterSelectMode = useCallback((id: string) => {
    openSwipeRef.current?.close();
    openSwipeRef.current = null;
    setSelecting(true);
    setSelectedIds([id]);
  }, []);

  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  const confirmDeleteIds = useCallback(
    (ids: string[], firstName?: string) => {
      const count = ids.length;
      const title =
        count === 1
          ? t("threads.deleteTitleOne")
          : t("threads.deleteTitleMany", { count });
      const message =
        count === 1
          ? firstName
            ? t("threads.deleteMsgSingleNamed", { name: firstName })
            : t("threads.deleteMsgSingleGeneric")
          : t("threads.deleteMsgMany");

      Alert.alert(title, message, [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: () => {
            void (async () => {
              try {
                for (const id of ids) {
                  await threadsRepo.deleteConversation(id);
                }
                await refreshLists();
                exitSelectMode();
              } catch (e) {
                console.error(e);
                Alert.alert(
                  t("capsules.deleteErrorTitle"),
                  t("capsules.deleteErrorBody"),
                );
              }
            })();
          },
        },
      ]);
    },
    [exitSelectMode, refreshLists, t],
  );

  useLayoutEffect(() => {
    const addIconSize = 28;
    const deleteIconSize = 24;

    navigation.setOptions({
      title: selecting
        ? selectedIds.length > 0
          ? String(selectedIds.length)
          : t("common.select")
        : t("threads.headerTitle"),
      headerLeftContainerStyle: { paddingLeft: 8 },
      headerRightContainerStyle: { paddingRight: 8 },
      headerLeft: selecting
        ? () => (
            <HeaderButton
              onPress={exitSelectMode}
              accessibilityLabel={t("common.cancel")}
            >
              <Text style={[styles.headerAction, { color: headerTint }]}>
                {t("common.cancel")}
              </Text>
            </HeaderButton>
          )
        : undefined,
      headerRight: () =>
        selecting ? (
          <HeaderButton
            onPress={() => {
              if (selectedIds.length === 0) return;
              const first = threads.find((d) => d.id === selectedIds[0]);
              confirmDeleteIds(
                selectedIds,
                selectedIds.length === 1 ? first?.capsule.name : undefined,
              );
            }}
            disabled={selectedIds.length === 0}
            accessibilityLabel={t("capsules.a11yDeleteSelected")}
          >
            <Ionicons
              name="trash-outline"
              size={deleteIconSize}
              color={destructiveTintColor()}
              style={
                Platform.OS === "ios"
                  ? { lineHeight: deleteIconSize }
                  : undefined
              }
            />
          </HeaderButton>
        ) : (
          <HeaderButton
            onPress={openGeminiUrlModal}
            accessibilityLabel={t("threads.a11yOpenGeminiUrl")}
          >
            <Ionicons
              name="add"
              size={addIconSize}
              color={headerTint}
              style={
                Platform.OS === "ios"
                  ? { lineHeight: addIconSize }
                  : undefined
              }
            />
          </HeaderButton>
        ),
    });
  }, [
    confirmDeleteIds,
    openGeminiUrlModal,
    threads,
    exitSelectMode,
    headerTint,
    navigation,
    selecting,
    selectedIds,
    tint,
    t,
  ]);

  const showEmptyState =
    !activeAccountPending && !threadsPending && threads.length === 0;

  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      {Platform.OS === "android" ? (
        <Modal
          visible={openUrlModal}
          transparent
          animationType="fade"
          onRequestClose={() => setOpenUrlModal(false)}
        >
          <View style={styles.androidUrlBackdrop}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => setOpenUrlModal(false)}
              accessibilityLabel={t("common.dismiss")}
            />
            <KeyboardAvoidingView
              behavior="padding"
              style={styles.androidUrlOuter}
            >
              <View
                style={[
                  styles.androidUrlCard,
                  {
                    backgroundColor: palette.listRowSurface,
                    borderColor: palette.separator,
                  },
                ]}
              >
                <Text
                  style={[styles.androidUrlTitle, { color: palette.textPrimary }]}
                >
                  {t("threads.androidUrlTitle")}
                </Text>
                <Text
                  style={[styles.androidUrlHint, { color: palette.textSecondary }]}
                >
                  {t("threads.androidUrlHint")}
                </Text>
                <TextInput
                  value={openUrlDraft}
                  onChangeText={setOpenUrlDraft}
                  placeholder={t("threads.androidUrlPlaceholder")}
                  placeholderTextColor={palette.textSecondary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  returnKeyType="go"
                  onSubmitEditing={submitOpenGeminiUrl}
                  style={[
                    styles.androidUrlInput,
                    {
                      color: palette.textPrimary,
                      borderColor: palette.separator,
                    },
                  ]}
                />
                <View
                  style={[
                    styles.androidUrlFooter,
                    { borderTopColor: palette.separator },
                  ]}
                >
                  <Pressable
                    onPress={() => setOpenUrlModal(false)}
                    style={({ pressed }) => [
                      styles.androidUrlActionBtn,
                      pressed && { opacity: 0.55 },
                    ]}
                    accessibilityLabel={t("threads.close")}
                  >
                    <Text
                      style={[
                        styles.androidUrlActionLabel,
                        { color: palette.textSecondary },
                      ]}
                    >
                      {t("threads.close")}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={submitOpenGeminiUrl}
                    style={({ pressed }) => [
                      styles.androidUrlActionBtn,
                      pressed && { opacity: 0.55 },
                    ]}
                  >
                    <Text
                      style={[
                        styles.androidUrlActionLabel,
                        { color: tint, fontWeight: "600" },
                      ]}
                    >
                      {t("common.open")}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </KeyboardAvoidingView>
          </View>
        </Modal>
      ) : null}
      <FlatList
        data={threads}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={listRefreshing}
            onRefresh={() => void onPullToRefresh()}
            tintColor={tint as string}
            colors={[tint as string]}
          />
        }
        contentContainerStyle={[
          styles.listContent,
          showEmptyState && styles.listContentEmpty,
        ]}
        ListEmptyComponent={
          showEmptyState ? (
            <ThreadsEmptyState palette={palette} tint={tint} t={t} />
          ) : null
        }
        extraData={{ selecting, selectedIds }}
        ItemSeparatorComponent={() => (
          <View
            style={[
              styles.separator,
              {
                backgroundColor: palette.separator,
                marginLeft: 16 + (selecting ? 36 : 0) + 52 + 12,
              },
            ]}
          />
        )}
        renderItem={({ item }) => {
          const row = (
            <ThreadRow
              thread={item}
              palette={palette}
              selecting={selecting}
              selected={selectedIds.includes(item.id)}
              tint={tint}
              onPress={() => {
                if (selecting) {
                  toggleSelected(item.id);
                  return;
                }
                router.push({
                  pathname: "/thread/[id]",
                  params: { id: item.id, name: item.capsule.name },
                } as unknown as Href);
              }}
              onLongPress={
                selecting
                  ? undefined
                  : () => {
                      enterSelectMode(item.id);
                    }
              }
            />
          );

          if (selecting) {
            return row;
          }

          return (
            <SwipeToDeleteRow
              openRegistryRef={openSwipeRef}
              onDeletePress={() =>
                confirmDeleteIds([item.id], item.capsule.name)
              }
            >
              {row}
            </SwipeToDeleteRow>
          );
        }}
      />
    </View>
  );
}

function ThreadsEmptyState({
  palette,
  tint,
  t,
}: {
  palette: ListPalette;
  tint: ColorValue;
  t: TFunction;
}) {
  return (
    <View
      style={styles.emptyWrap}
      accessibilityLabel={t("threads.emptyA11y")}
    >
      <View
        style={[
          styles.emptyIconCircle,
          {
            borderColor: palette.separator,
            backgroundColor: palette.listRowSurface,
          },
        ]}
      >
        <Ionicons name="chatbubbles-outline" size={34} color={tint} />
      </View>
      <Text style={[styles.emptyTitle, { color: palette.textPrimary }]}>
        {t("threads.emptyTitle")}
      </Text>
      <Text style={[styles.emptyBody, { color: palette.textSecondary }]}>
        {t("threads.emptyBody")}
      </Text>
    </View>
  );
}

function ThreadRow({
  thread,
  palette,
  selecting,
  selected,
  tint,
  onPress,
  onLongPress,
}: {
  thread: Thread;
  palette: ListPalette;
  selecting: boolean;
  selected: boolean;
  tint: ColorValue;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  const { capsule } = thread;
  const subtitle = formatLastMessageDate(thread.lastMessageAt);

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={LONG_PRESS_MS}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: palette.listRowSurface },
        pressed && { backgroundColor: palette.rowPressed },
      ]}
    >
      {selecting ? (
        <View style={styles.selectMark}>
          <Ionicons
            name={selected ? "checkmark-circle" : "ellipse-outline"}
            size={26}
            color={selected ? tint : palette.textSecondary}
          />
        </View>
      ) : null}
      <CapsuleAvatar
        capsuleId={capsule.id}
        name={capsule.name}
        emoji={capsule.avatarIcon}
        size={52}
      />
      <View style={styles.rowText}>
        <Text
          style={[styles.name, { color: palette.textPrimary }]}
          numberOfLines={1}
        >
          {capsule.name}
        </Text>
        <Text
          style={[styles.subtitle, { color: palette.textSecondary }]}
          numberOfLines={1}
        >
          {subtitle}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  androidUrlBackdrop: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
  },
  androidUrlOuter: {
    width: "100%",
    maxWidth: 400,
    zIndex: 1,
  },
  androidUrlCard: {
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 4,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  androidUrlTitle: {
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
  },
  androidUrlHint: {
    fontSize: 14,
    marginTop: 6,
    lineHeight: 20,
  },
  androidUrlInput: {
    marginTop: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  androidUrlFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    marginTop: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  androidUrlActionBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    minWidth: 64,
    alignItems: "center",
  },
  androidUrlActionLabel: {
    fontSize: 15,
  },
  headerAction: {
    fontSize: 17,
  },
  listContent: {
    paddingBottom: 24,
  },
  listContentEmpty: {
    flexGrow: 1,
    justifyContent: "center",
  },
  emptyWrap: {
    alignItems: "center",
    paddingHorizontal: 32,
    paddingVertical: 24,
    maxWidth: 400,
    alignSelf: "center",
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginTop: 20,
    textAlign: "center",
  },
  emptyBody: {
    fontSize: 15,
    marginTop: 10,
    textAlign: "center",
    lineHeight: 22,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 72,
  },
  selectMark: {
    width: 32,
    marginRight: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  separator: {
    height: StyleSheet.hairlineWidth,
  },
  rowText: {
    flex: 1,
    marginLeft: 12,
    justifyContent: "center",
  },
  name: {
    fontSize: 17,
    fontWeight: "600",
  },
  subtitle: {
    fontSize: 14,
    marginTop: 2,
  },
});
