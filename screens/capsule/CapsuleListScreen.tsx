import { HeaderButton } from "@react-navigation/elements";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, type Href } from "expo-router";
import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  useColorScheme,
  View,
  type ColorValue,
} from "react-native";
import { useTranslation } from "react-i18next";
import { usePopupManager } from "react-popup-manager";
import type { SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";
import { CapsuleAvatar } from "components/capsule/CapsuleAvatar";
import { CategoryManageModal } from "components/capsule/CategoryManageModal";
import {
  selectCapsuleUiPalette,
  type CapsuleListRowPalette,
} from "components/capsule/capsuleUiPalette";
import { SwipeToDeleteRow } from "components/ui/SwipeToDeleteRow";
import { useAccountActive } from "hooks/account/useAccountActive";
import type { Capsule } from "lib/models/capsule";
import { queryKeys } from "lib/queryKeys";
import {
  destructiveTintColor,
  headerTitleColorForScheme,
  systemBlueForScheme,
} from "lib/theme/appColors";
import type { TFunction } from "i18next";
import { capsulesRepo, type CapsuleListSection } from "repositories";

const LONG_PRESS_MS = 450;

export function CapsuleListScreen() {
  const { t } = useTranslation();
  const router = useRouter();
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
  const [listRefreshing, setListRefreshing] = useState(false);

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
    await queryClient.invalidateQueries({
      queryKey: queryKeys.threads.listForActive(),
    });
  }, [queryClient]);

  const onPullToRefresh = useCallback(async () => {
    setListRefreshing(true);
    try {
      await refreshLists();
      await refetchCapsules();
    } finally {
      setListRefreshing(false);
    }
  }, [refreshLists, refetchCapsules]);

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
      const title =
        count === 1
          ? t("capsules.deleteTitleOne")
          : t("capsules.deleteTitleMany", { count });
      const message =
        count === 1
          ? firstName
            ? t("capsules.deleteMsgSingleNamed", { name: firstName })
            : t("capsules.deleteMsgSingleGeneric")
          : t("capsules.deleteMsgMany");

      Alert.alert(title, message, [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
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

  const openCategoryManageModal = useCallback(async () => {
    if (!activeAccount?.id) {
      Alert.alert(
        t("capsules.noAccountTitle"),
        t("capsules.noAccountBody"),
      );
      return;
    }
    const { response } = popupManager.open(CategoryManageModal, {
      accountId: activeAccount.id,
    });
    await response;
  }, [popupManager, activeAccount?.id, t]);

  const onAddCapsulePress = useCallback(async () => {
    if (!activeAccount?.id) {
      Alert.alert(
        t("capsules.noAccountTitle"),
        t("capsules.addNoAccountBody"),
      );
      return;
    }
    try {
      const created = await capsulesRepo.insertCapsuleOnly({
        accountId: activeAccount.id,
        name: t("capsules.defaultNewCapsuleName"),
      });
      router.push(`/capsule/edit/${created.id}` as Href);
      void queryClient.invalidateQueries({ queryKey: queryKeys.capsules.all });
    } catch (e) {
      console.error(e);
      Alert.alert(
        t("capsules.addCapsuleErrorTitle"),
        t("capsules.addCapsuleError"),
      );
    }
  }, [activeAccount?.id, queryClient, router, t]);

  const tint = systemBlueForScheme(scheme);
  const headerTint = headerTitleColorForScheme(scheme);

  useLayoutEffect(() => {
    const folderIconSize = 28;
    const addIconSize = 28;
    const deleteIconSize = 24;

    navigation.setOptions({
      title: selecting
        ? selectedIds.length > 0
          ? String(selectedIds.length)
          : t("common.select")
        : t("capsules.headerTitle"),
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
        : () => (
            <HeaderButton
              onPress={() => void openCategoryManageModal()}
              accessibilityLabel={t("capsules.a11yManageCategories")}
            >
              <Ionicons
                name="folder-outline"
                size={folderIconSize}
                color={headerTint}
                style={
                  Platform.OS === "ios"
                    ? { lineHeight: folderIconSize }
                    : undefined
                }
              />
            </HeaderButton>
          ),
      headerRight: () =>
        selecting ? (
          <HeaderButton
            onPress={() => {
              if (selectedIds.length === 0) return;
              const first = capsules.find((c) => c.id === selectedIds[0]);
              confirmDeleteIds(
                selectedIds,
                selectedIds.length === 1 ? first?.name : undefined,
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
            onPress={() => void onAddCapsulePress()}
            accessibilityLabel={t("capsules.a11yAddCapsule")}
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
    capsules,
    confirmDeleteIds,
    exitSelectMode,
    headerTint,
    navigation,
    onAddCapsulePress,
    openCategoryManageModal,
    selecting,
    selectedIds,
    tint,
    t,
  ]);

  const showEmptyState =
    !activeAccountPending && !capsulesPending && capsules.length === 0;

  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      <SectionList<Capsule, CapsuleListSection>
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled
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
            <CapsulesEmptyState palette={palette} tint={tint} t={t} />
          ) : null
        }
        extraData={{ selecting, selectedIds }}
        renderSectionHeader={({ section: { title, categoryId } }) => (
          <View
            style={[styles.sectionHeader, { backgroundColor: palette.background }]}
          >
            <Text
              style={[styles.sectionHeaderText, { color: palette.textSecondary }]}
            >
              {categoryId === null ? t("capsules.sectionGeneral") : title}
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
  t,
}: {
  palette: CapsuleListRowPalette;
  tint: ColorValue;
  t: TFunction;
}) {
  return (
    <View
      style={styles.emptyWrap}
      accessibilityLabel={t("capsules.emptyA11y")}
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
        <Ionicons name="cube-outline" size={36} color={tint} />
      </View>
      <Text style={[styles.emptyTitle, { color: palette.textPrimary }]}>
        {t("capsules.emptyTitle")}
      </Text>
      <Text style={[styles.emptyBody, { color: palette.textSecondary }]}>
        {t("capsules.emptyBody")}
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
