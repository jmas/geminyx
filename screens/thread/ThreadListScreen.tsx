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
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
  type ColorValue,
} from "react-native";
import type { SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";
import { CapsuleAvatar } from "components/capsule/CapsuleAvatar";
import { SwipeToDeleteRow } from "components/ui/SwipeToDeleteRow";
import { useAccountActive } from "hooks/account/useAccountActive";
import type { Thread } from "lib/models/thread";
import { queryKeys } from "lib/queryKeys";
import { destructiveTintColor, systemBlueForScheme } from "lib/theme/appColors";
import { threadListPaletteForScheme } from "lib/theme/semanticUi";
import { threadsRepo } from "repositories";
import { formatLastMessageDate } from "utils/formatLastMessageDate";

const LONG_PRESS_MS = 450;

type ListPalette = ReturnType<typeof threadListPaletteForScheme>;

export function ThreadListScreen() {
  const navigation = useNavigation();
  const scheme = useColorScheme();
  const palette = useMemo(
    () => threadListPaletteForScheme(scheme),
    [scheme],
  );
  const tint = systemBlueForScheme(scheme);
  const openSwipeRef = useRef<SwipeableMethods | null>(null);

  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

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

  const exitSelectMode = useCallback(() => {
    setSelecting(false);
    setSelectedIds([]);
    openSwipeRef.current?.close();
    openSwipeRef.current = null;
  }, []);

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
      const title = count === 1 ? "Delete chat?" : `Delete ${count} chats?`;
      const message =
        count === 1
          ? firstName
            ? `Delete “${firstName}” and all messages? The capsule stays in your library. This cannot be undone.`
            : "This will remove the thread and all messages. The capsule stays in your library. This cannot be undone."
          : "This will remove the selected threads and all messages. Capsules stay in your library. This cannot be undone.";

      Alert.alert(title, message, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
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
                Alert.alert("Could not delete", "Please try again.");
              }
            })();
          },
        },
      ]);
    },
    [exitSelectMode, refreshLists],
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      title: selecting
        ? selectedIds.length > 0
          ? String(selectedIds.length)
          : "Select"
        : "Threads",
      headerLeftContainerStyle: selecting
        ? { paddingLeft: 16 }
        : undefined,
      headerRightContainerStyle: {
        paddingRight: 16,
      },
      headerLeft: selecting
        ? () => (
            <Pressable
              onPress={exitSelectMode}
              hitSlop={12}
              style={({ pressed }) => [pressed && { opacity: 0.55 }]}
            >
              <Text style={[styles.headerAction, { color: tint }]}>Cancel</Text>
            </Pressable>
          )
        : undefined,
      headerRight: () =>
        selecting ? (
          <Pressable
            onPress={() => {
              if (selectedIds.length === 0) return;
              const first = threads.find((d) => d.id === selectedIds[0]);
              confirmDeleteIds(
                selectedIds,
                selectedIds.length === 1 ? first?.capsule.name : undefined,
              );
            }}
            hitSlop={12}
            disabled={selectedIds.length === 0}
            style={({ pressed }) => [
              pressed && selectedIds.length > 0 && { opacity: 0.55 },
              selectedIds.length === 0 && { opacity: 0.35 },
            ]}
            accessibilityLabel="Delete selected"
          >
            <Ionicons name="trash-outline" size={24} color={destructiveTintColor()} />
          </Pressable>
        ) : undefined,
    });
  }, [
    confirmDeleteIds,
    threads,
    exitSelectMode,
    navigation,
    selecting,
    selectedIds,
    tint,
  ]);

  const showEmptyState =
    !activeAccountPending && !threadsPending && threads.length === 0;

  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      <FlatList
        data={threads}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          showEmptyState && styles.listContentEmpty,
        ]}
        ListEmptyComponent={
          showEmptyState ? (
            <ThreadsEmptyState palette={palette} tint={tint} />
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
}: {
  palette: ListPalette;
  tint: ColorValue;
}) {
  return (
    <View
      style={styles.emptyWrap}
      accessibilityLabel="No threads yet. Open a capsule to chat; recent threads appear here."
    >
      <View
        style={[styles.emptyIconCircle, { borderColor: palette.separator }]}
      >
        <Ionicons name="chatbubbles-outline" size={34} color={tint} />
      </View>
      <Text style={[styles.emptyTitle, { color: palette.textPrimary }]}>
        No threads yet
      </Text>
      <Text style={[styles.emptyBody, { color: palette.textSecondary }]}>
        Threads are your ongoing conversations with each capsule. Open a
        capsule to start chatting—recent threads will show up here for quick
        access.
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
