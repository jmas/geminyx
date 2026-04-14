import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { router, type Href } from "expo-router";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  Alert,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";
import type { SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";
import { SwipeToDeleteRow } from "components/ui/SwipeToDeleteRow";
import { useAccountActive } from "hooks/account/useAccountActive";
import type { Thread } from "lib/models/thread";
import { queryKeys } from "lib/queryKeys";
import {
  appColors,
  navigationChromeForScheme,
  systemBlueForScheme,
} from "lib/theme/appColors";
import { capsulesRepo, threadsRepo } from "repositories";
import { avatarHueFromId, initialsFromName } from "utils/avatar";
import { formatLastMessageDate } from "utils/formatLastMessageDate";

const LONG_PRESS_MS = 450;

const colors = {
  light: {
    background: appColors.screenLight,
    textPrimary: "#000000",
    textSecondary: "#8e8e93",
    separator: "rgba(60, 60, 67, 0.29)",
    rowPressed: "rgba(0, 0, 0, 0.04)",
  },
  dark: {
    background: appColors.screenDark,
    textPrimary: "#f2f2f7",
    textSecondary: "rgba(235, 235, 245, 0.55)",
    separator: "rgba(84, 84, 88, 0.55)",
    rowPressed: "rgba(255, 255, 255, 0.06)",
  },
} as const;

type ListPalette = (typeof colors)[keyof typeof colors];

export function ThreadListScreen() {
  const navigation = useNavigation();
  const scheme = useColorScheme();
  const palette = scheme === "dark" ? colors.dark : colors.light;
  const tint = systemBlueForScheme(scheme);
  const openSwipeRef = useRef<SwipeableMethods | null>(null);

  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const queryClient = useQueryClient();
  const { data: activeAccount, isPending: activePending } = useAccountActive();
  const {
    data: threads = [],
    refetch: refetchThreads,
  } = useQuery({
    queryKey: [...queryKeys.threads.listForActive(), activeAccount?.id ?? "none"],
    queryFn: async () => {
      if (!activeAccount?.id) return [];
      return threadsRepo.listForAccount(activeAccount.id);
    },
    enabled: !activePending,
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
            ? `Delete “${firstName}” and all messages? This cannot be undone.`
            : "This will remove the capsule, thread, and all messages. This cannot be undone."
          : "This will remove the selected chats and all messages. This cannot be undone.";

      Alert.alert(title, message, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void (async () => {
              try {
                for (const id of ids) {
                  await capsulesRepo.deleteCascade(id);
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
      ...navigationChromeForScheme(scheme),
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
            <Ionicons name="trash-outline" size={24} color="#ff3b30" />
          </Pressable>
        ) : undefined,
    });
  }, [
    confirmDeleteIds,
    threads,
    exitSelectMode,
    navigation,
    scheme,
    selecting,
    selectedIds,
    tint,
  ]);

  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      <FlatList
        data={threads}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
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
  tint: string;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  const { capsule } = thread;
  const subtitle = formatLastMessageDate(thread.lastMessageAt);
  const hue = avatarHueFromId(capsule.id);
  const initials = initialsFromName(capsule.name);

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={LONG_PRESS_MS}
      style={({ pressed }) => [
        styles.row,
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
      <Avatar
        name={capsule.name}
        uri={capsule.avatarUrl}
        hue={hue}
        initials={initials}
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

function Avatar({
  uri,
  hue,
  initials,
  name,
}: {
  uri?: string;
  hue: number;
  initials: string;
  name: string;
}) {
  const [failed, setFailed] = useState(!uri);

  useEffect(() => {
    setFailed(!uri);
  }, [uri]);

  if (!failed && uri) {
    return (
      <Image
        accessibilityLabel={`${name} avatar`}
        source={{ uri }}
        style={styles.avatarImage}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <View
      style={[styles.avatarFallback, { backgroundColor: `hsl(${hue}, 42%, 46%)` }]}
      accessibilityLabel={`${name} avatar`}
    >
      <Text style={styles.avatarInitials}>{initials}</Text>
    </View>
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
  avatarImage: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  avatarFallback: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "600",
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
