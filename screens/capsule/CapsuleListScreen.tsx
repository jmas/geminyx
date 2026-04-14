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
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  useColorScheme,
  View,
  type ColorValue,
} from "react-native";
import { usePopupManager } from "react-popup-manager";
import type { SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";
import { CapsuleAvatar } from "components/capsule/CapsuleAvatar";
import { CategoryManageModal } from "components/capsule/CategoryManageModal";
import { CapsuleFormModal } from "components/capsule/CapsuleFormModal";
import {
  selectCapsuleUiPalette,
  type CapsuleListRowPalette,
} from "components/capsule/capsuleUiPalette";
import { SwipeToDeleteRow } from "components/ui/SwipeToDeleteRow";
import { useAccountActive } from "hooks/account/useAccountActive";
import type { Capsule } from "lib/models/capsule";
import { queryKeys } from "lib/queryKeys";
import { destructiveTintColor, systemBlueForScheme } from "lib/theme/appColors";
import { capsulesRepo, type CapsuleListSection } from "repositories";

const LONG_PRESS_MS = 450;

export function CapsuleListScreen() {
  const navigation = useNavigation();
  const scheme = useColorScheme();
  const palette = selectCapsuleUiPalette(scheme);
  const popupManager = usePopupManager();
  const openSwipeRef = useRef<SwipeableMethods | null>(null);
  const suppressNextRowPressRef = useRef<{ id: string; untilMs: number } | null>(
    null,
  );

  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const queryClient = useQueryClient();
  const {
    data: activeAccount,
    isPending: activeAccountPending,
  } = useAccountActive();
  const {
    data: sections = [],
    isPending: capsulesPending,
    refetch: refetchCapsules,
  } = useQuery({
    queryKey: [...queryKeys.capsules.listForActive(), activeAccount?.id ?? "none"],
    queryFn: async () => {
      if (!activeAccount?.id) return [];
      return capsulesRepo.listSectionsForAccount(activeAccount.id);
    },
    enabled: !activeAccountPending,
  });

  const capsules = useMemo(
    () => sections.flatMap((s) => s.data),
    [sections],
  );

  useFocusEffect(
    useCallback(() => {
      void refetchCapsules();
    }, [refetchCapsules]),
  );

  const refreshLists = useCallback(async () => {
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
          : "This will remove the selected capsules, threads, and all messages. This cannot be undone.";

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

  const openCategoryManageModal = useCallback(async () => {
    if (!activeAccount?.id) {
      Alert.alert("No account", "Select an account before managing categories.");
      return;
    }
    const { response } = popupManager.open(CategoryManageModal, {
      accountId: activeAccount.id,
    });
    await response;
  }, [popupManager, activeAccount?.id]);

  const openAddCapsuleSheet = useCallback(async () => {
    const { response } = popupManager.open(CapsuleFormModal);
    const closeResult = await response;
    if (
      closeResult &&
      typeof closeResult === "object" &&
      "created" in closeResult &&
      closeResult.created
    ) {
      const c = closeResult.created;
      router.push({
        pathname: "/thread/[id]",
        params: { id: c.id, name: c.name },
      } as unknown as Href);
    }
  }, [popupManager]);

  const tint = systemBlueForScheme(scheme);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: selecting
        ? selectedIds.length > 0
          ? String(selectedIds.length)
          : "Select"
        : "Capsules",
      headerLeftContainerStyle: { paddingLeft: 16 },
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
        : () => (
            <Pressable
              onPress={() => void openCategoryManageModal()}
              hitSlop={12}
              style={({ pressed }) => [pressed && { opacity: 0.55 }]}
              accessibilityLabel="Manage categories"
            >
              <Ionicons name="folder-outline" size={28} color={tint} />
            </Pressable>
          ),
      headerRight: () =>
        selecting ? (
          <Pressable
            onPress={() => {
              if (selectedIds.length === 0) return;
              const first = capsules.find((c) => c.id === selectedIds[0]);
              confirmDeleteIds(
                selectedIds,
                selectedIds.length === 1 ? first?.name : undefined,
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
        ) : (
          <Pressable
            onPress={() => void openAddCapsuleSheet()}
            hitSlop={12}
            style={({ pressed }) => [pressed && { opacity: 0.55 }]}
            accessibilityLabel="Add capsule"
          >
            <Ionicons name="add" size={28} color={tint} />
          </Pressable>
        ),
    });
  }, [
    capsules,
    confirmDeleteIds,
    exitSelectMode,
    navigation,
    openAddCapsuleSheet,
    openCategoryManageModal,
    selecting,
    selectedIds,
    tint,
  ]);

  const showEmptyState =
    !activeAccountPending && !capsulesPending && capsules.length === 0;

  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      <SectionList<Capsule, CapsuleListSection>
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled
        contentContainerStyle={[
          styles.listContent,
          showEmptyState && styles.listContentEmpty,
        ]}
        ListEmptyComponent={
          showEmptyState ? (
            <CapsulesEmptyState palette={palette} tint={tint} />
          ) : null
        }
        extraData={{ selecting, selectedIds }}
        renderSectionHeader={({ section: { title } }) => (
          <View
            style={[styles.sectionHeader, { backgroundColor: palette.background }]}
          >
            <Text
              style={[styles.sectionHeaderText, { color: palette.textSecondary }]}
            >
              {title}
            </Text>
          </View>
        )}
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
            <CapsuleRow
              capsule={item}
              palette={palette}
              selecting={selecting}
              selected={selectedIds.includes(item.id)}
              tint={tint}
              onPress={() => {
                const sup = suppressNextRowPressRef.current;
                if (sup && sup.id === item.id && Date.now() < sup.untilMs) {
                  suppressNextRowPressRef.current = null;
                  return;
                }
                if (selecting) {
                  toggleSelected(item.id);
                  return;
                }
                router.push({
                  pathname: "/capsule/[id]",
                  params: { id: item.id },
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
              onEditPress={() => {
                suppressNextRowPressRef.current = {
                  id: item.id,
                  untilMs: Date.now() + 800,
                };
                router.push({
                  pathname: "/capsule/edit/[id]",
                  params: { id: item.id },
                } as unknown as Href);
              }}
              onDeletePress={() =>
                confirmDeleteIds([item.id], item.name)
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

function CapsulesEmptyState({
  palette,
  tint,
}: {
  palette: CapsuleListRowPalette;
  tint: ColorValue;
}) {
  return (
    <View
      style={styles.emptyWrap}
      accessibilityLabel="No capsules yet. Capsules are named spaces for your chats. Tap add in the header to create one."
    >
      <View
        style={[styles.emptyIconCircle, { borderColor: palette.separator }]}
      >
        <Ionicons name="cube-outline" size={36} color={tint} />
      </View>
      <Text style={[styles.emptyTitle, { color: palette.textPrimary }]}>
        No capsules yet
      </Text>
      <Text style={[styles.emptyBody, { color: palette.textSecondary }]}>
        Capsules are named spaces for your chats—each keeps its own thread and
        history. Tap + above to create one and start a conversation.
      </Text>
    </View>
  );
}

function CapsuleRow({
  capsule,
  palette,
  selecting,
  selected,
  tint,
  onPress,
  onLongPress,
}: {
  capsule: Capsule;
  palette: CapsuleListRowPalette;
  selecting: boolean;
  selected: boolean;
  tint: ColorValue;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  const description = capsule.description?.trim();

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
        {description ? (
          <Text
            style={[styles.subtitle, { color: palette.textSecondary }]}
            numberOfLines={2}
          >
            {description}
          </Text>
        ) : null}
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
  sectionHeader: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 6,
    backgroundColor: "transparent",
  },
  sectionHeaderText: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.3,
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
