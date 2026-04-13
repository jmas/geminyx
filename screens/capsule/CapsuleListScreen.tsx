import { useDelete, useInvalidate, useList } from "@refinedev/core";
import { Ionicons } from "@expo/vector-icons";
import { router, type Href } from "expo-router";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
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
import { useNavigation } from "@react-navigation/native";
import { usePopupManager } from "react-popup-manager";
import type { SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";
import { CapsuleFormModal } from "components/capsule/CapsuleFormModal";
import {
  selectCapsuleUiPalette,
  type CapsuleListRowPalette,
} from "components/capsule/capsuleUiPalette";
import { SwipeToDeleteRow } from "components/ui/SwipeToDeleteRow";
import type { Capsule } from "lib/models/capsule";
import { RESOURCES } from "lib/refineDataProvider";
import {
  navigationChromeForScheme,
  systemBlueForScheme,
} from "lib/theme/appColors";
import { avatarHueFromId, initialsFromName } from "utils/avatar";

const LONG_PRESS_MS = 450;

export function CapsuleListScreen() {
  const navigation = useNavigation();
  const scheme = useColorScheme();
  const palette = selectCapsuleUiPalette(scheme);
  const popupManager = usePopupManager();
  const openSwipeRef = useRef<SwipeableMethods | null>(null);

  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const invalidate = useInvalidate();
  const { mutateAsync: removeCapsule } = useDelete();

  const refreshLists = useCallback(async () => {
    await invalidate({ resource: RESOURCES.capsules, invalidates: ["list"] });
    await invalidate({ resource: RESOURCES.dialogs, invalidates: ["list"] });
  }, [invalidate]);

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
            : "This will remove the capsule, dialog, and all messages. This cannot be undone."
          : "This will remove the selected capsules, dialogs, and all messages. This cannot be undone.";

      Alert.alert(title, message, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void (async () => {
              try {
                for (const id of ids) {
                  await removeCapsule({ resource: RESOURCES.capsules, id });
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
    [exitSelectMode, refreshLists, removeCapsule],
  );

  const { result } = useList<Capsule>({
    resource: RESOURCES.capsules,
    pagination: { mode: "off" },
  });
  const capsules = useMemo(() => result.data ?? [], [result.data]);

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
        pathname: "/dialog/[id]",
        params: { id: c.id, name: c.name },
      } as unknown as Href);
    }
  }, [popupManager]);

  const tint = systemBlueForScheme(scheme);

  useLayoutEffect(() => {
    navigation.setOptions({
      ...navigationChromeForScheme(scheme),
      title: selecting
        ? selectedIds.length > 0
          ? String(selectedIds.length)
          : "Select"
        : "Capsules",
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
            <Ionicons name="trash-outline" size={24} color="#ff3b30" />
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
    scheme,
    selecting,
    selectedIds,
    tint,
  ]);

  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      <FlatList
        data={capsules}
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
            <CapsuleRow
              capsule={item}
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
                  pathname: "/dialog/[id]",
                  params: { id: item.id, name: item.name },
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
  tint: string;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  const description = capsule.description?.trim();
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
