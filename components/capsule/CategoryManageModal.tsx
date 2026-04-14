import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { selectCapsuleUiPalette } from "components/capsule/capsuleUiPalette";
import { useAccountActive } from "hooks/account/useAccountActive";
import type { Category } from "lib/models/category";
import { queryKeys } from "lib/queryKeys";
import {
  destructiveTintColor,
  systemBlueForScheme,
} from "lib/theme/appColors";
import { categoriesRepo } from "repositories";
import { alertError } from "utils/error";

export type CategoryManageModalProps = {
  isOpen: boolean;
  /** Injected by react-popup-manager; optional in `open()` options typing. */
  onClose?: () => void;
  /**
   * Set by `popupManager.open(CategoryManageModal, { accountId })` so this modal
   * works above the navigator: `useAccountActive()` alone can be unset here, and
   * `isOpen` is false on the popup manager’s first render.
   */
  accountId?: string;
};

function arrayMove<T>(arr: T[], from: number, to: number): T[] {
  if (from === to) return arr;
  const next = [...arr];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function CategoryManageModal({
  isOpen,
  onClose,
  accountId: accountIdProp,
}: CategoryManageModalProps) {
  const dismiss = onClose ?? (() => {});
  const scheme = useColorScheme();
  const palette = selectCapsuleUiPalette(scheme);
  const insets = useSafeAreaInsets();
  const tint = systemBlueForScheme(scheme);
  const queryClient = useQueryClient();
  const { data: activeAccount } = useAccountActive({ refetchOnFocus: false });
  const resolvedAccountId = accountIdProp ?? activeAccount?.id ?? "";

  const [draftName, setDraftName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");

  const {
    data: categories = [],
    isPending,
  } = useQuery({
    queryKey: [
      ...queryKeys.categories.listForActive(),
      resolvedAccountId || "none",
    ],
    queryFn: async () => {
      if (!resolvedAccountId) return [];
      return categoriesRepo.listOrdered(resolvedAccountId);
    },
    enabled: Boolean(resolvedAccountId),
  });

  const invalidate = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: queryKeys.categories.listForActive(),
    });
    await queryClient.invalidateQueries({
      queryKey: queryKeys.capsules.listForActive(),
    });
  }, [queryClient]);

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      if (!resolvedAccountId) throw new Error("No account");
      return categoriesRepo.create(resolvedAccountId, name);
    },
    onSuccess: async () => {
      setDraftName("");
      await invalidate();
    },
  });

  const renameMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      if (!resolvedAccountId) throw new Error("No account");
      await categoriesRepo.updateName(resolvedAccountId, id, name);
    },
    onSuccess: async () => {
      setEditingId(null);
      await invalidate();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!resolvedAccountId) throw new Error("No account");
      await categoriesRepo.deleteAndClearCapsules(resolvedAccountId, id);
    },
    onSuccess: async () => {
      await invalidate();
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async (ordered: Category[]) => {
      if (!resolvedAccountId) return;
      await categoriesRepo.setOrder(
        resolvedAccountId,
        ordered.map((c) => c.id),
      );
    },
    onSuccess: async () => {
      await invalidate();
    },
  });

  const busy =
    createMutation.isPending ||
    renameMutation.isPending ||
    deleteMutation.isPending ||
    reorderMutation.isPending;

  const onAdd = useCallback(() => {
    const name = draftName.trim();
    if (!name.length) return;
    createMutation.mutate(name, {
      onError: (e) => {
        console.error(e);
        alertError(e, "Could not add category.", "Add category");
      },
    });
  }, [createMutation, draftName]);

  const startEdit = useCallback((c: Category) => {
    setEditingId(c.id);
    setEditingText(c.name);
  }, []);

  const saveEdit = useCallback(() => {
    if (!editingId) return;
    const name = editingText.trim();
    if (!name.length) return;
    renameMutation.mutate(
      { id: editingId, name },
      {
        onError: (e) => {
          console.error(e);
          alertError(e, "Could not save.", "Rename category");
        },
      },
    );
  }, [editingId, editingText, renameMutation]);

  const confirmDelete = useCallback(
    (c: Category) => {
      Alert.alert(
        "Delete category?",
        `“${c.name}” will be removed. Capsules in this category move to General.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => {
              deleteMutation.mutate(c.id, {
                onError: (e) => {
                  console.error(e);
                  alertError(e, "Could not delete.", "Delete category");
                },
              });
            },
          },
        ],
      );
    },
    [deleteMutation],
  );

  const move = useCallback(
    (index: number, dir: -1 | 1) => {
      const next = index + dir;
      if (next < 0 || next >= categories.length) return;
      const ordered = arrayMove(categories, index, next);
      reorderMutation.mutate(ordered, {
        onError: (e) => {
          console.error(e);
          alertError(e, "Could not reorder.", "Reorder");
        },
      });
    },
    [categories, reorderMutation],
  );

  return (
    <Modal
      visible={isOpen}
      animationType="slide"
      presentationStyle={Platform.OS === "ios" ? "pageSheet" : "fullScreen"}
      onRequestClose={dismiss}
    >
      <View
        style={[styles.root, { backgroundColor: palette.background }]}
      >
        <View style={styles.grabberWrap}>
          <View
            style={[styles.grabber, { backgroundColor: palette.sheetHandle }]}
          />
        </View>
        <Text
          style={[styles.title, { color: palette.sheetTitle }]}
          accessibilityRole="header"
        >
          Categories
        </Text>

        <View style={styles.body}>
        <Text style={[styles.hint, { color: palette.textSecondary }]}>
          General is the default for capsules without a category. It is not listed
          here.
        </Text>

        <View style={[styles.addRow, { borderColor: palette.fieldBorder }]}>
          <TextInput
            value={draftName}
            onChangeText={setDraftName}
            placeholder="New category name"
            placeholderTextColor={palette.placeholder}
            editable={!busy}
            onSubmitEditing={onAdd}
            style={[
              styles.addInput,
              {
                backgroundColor: palette.fieldBg,
                borderColor: palette.fieldBorder,
                color: palette.fieldText,
              },
            ]}
          />
          <Pressable
            onPress={onAdd}
            disabled={busy || !draftName.trim().length}
            style={({ pressed }) => [
              styles.addBtn,
              pressed && { opacity: 0.55 },
              (busy || !draftName.trim().length) && { opacity: 0.35 },
            ]}
            accessibilityLabel="Add category"
          >
            <Ionicons name="add-circle" size={32} color={tint} />
          </Pressable>
        </View>

        {isPending ? (
          <View style={styles.loadingArea}>
            <ActivityIndicator color={tint} />
          </View>
        ) : (
          <FlatList
            style={styles.list}
            data={categories}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            extraData={{ editingId, busy }}
            renderItem={({ item, index }) => {
              const isEditing = editingId === item.id;
              return (
                <View
                  style={[
                    styles.row,
                    { borderBottomColor: palette.separator },
                  ]}
                >
                  {isEditing ? (
                    <TextInput
                      value={editingText}
                      onChangeText={setEditingText}
                      autoFocus
                      editable={!busy}
                      onSubmitEditing={saveEdit}
                      style={[
                        styles.editInput,
                        {
                          backgroundColor: palette.fieldBg,
                          borderColor: palette.fieldBorder,
                          color: palette.fieldText,
                        },
                      ]}
                    />
                  ) : (
                    <Pressable
                      onPress={() => startEdit(item)}
                      style={({ pressed }) => [
                        styles.namePress,
                        pressed && { opacity: 0.7 },
                      ]}
                      disabled={busy}
                    >
                      <Text
                        style={[styles.name, { color: palette.textPrimary }]}
                        numberOfLines={2}
                      >
                        {item.name}
                      </Text>
                    </Pressable>
                  )}
                  <View style={styles.rowActions}>
                    {isEditing ? (
                      <Pressable
                        onPress={saveEdit}
                        disabled={busy}
                        hitSlop={8}
                        style={({ pressed }) => [pressed && { opacity: 0.55 }]}
                      >
                        <Text style={{ color: tint, fontSize: 16 }}>Save</Text>
                      </Pressable>
                    ) : (
                      <>
                        <Pressable
                          onPress={() => move(index, -1)}
                          disabled={busy || index === 0}
                          hitSlop={8}
                          style={({ pressed }) => [
                            pressed && { opacity: 0.55 },
                            (busy || index === 0) && { opacity: 0.3 },
                          ]}
                          accessibilityLabel="Move up"
                        >
                          <Ionicons
                            name="chevron-up"
                            size={22}
                            color={tint}
                          />
                        </Pressable>
                        <Pressable
                          onPress={() => move(index, 1)}
                          disabled={busy || index === categories.length - 1}
                          hitSlop={8}
                          style={({ pressed }) => [
                            pressed && { opacity: 0.55 },
                            (busy || index === categories.length - 1) && {
                              opacity: 0.3,
                            },
                          ]}
                          accessibilityLabel="Move down"
                        >
                          <Ionicons
                            name="chevron-down"
                            size={22}
                            color={tint}
                          />
                        </Pressable>
                        <Pressable
                          onPress={() => confirmDelete(item)}
                          disabled={busy}
                          hitSlop={8}
                          style={({ pressed }) => [
                            pressed && { opacity: 0.55 },
                            busy && { opacity: 0.35 },
                          ]}
                          accessibilityLabel="Delete category"
                        >
                          <Ionicons
                            name="trash-outline"
                            size={22}
                            color={destructiveTintColor()}
                          />
                        </Pressable>
                      </>
                    )}
                  </View>
                </View>
              );
            }}
          />
        )}
        </View>

        <View
          style={[
            styles.footer,
            {
              borderTopColor: palette.separator,
              paddingBottom: Math.max(insets.bottom, 12),
              backgroundColor: palette.background,
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
            <Text style={[styles.doneLabel, { color: tint }]}>Done</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
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
  body: {
    flex: 1,
    minHeight: 0,
  },
  loadingArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
  },
  list: {
    flex: 1,
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
  hint: {
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 8,
    gap: 8,
  },
  addInput: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 12 : 10,
    fontSize: 16,
  },
  addBtn: {
    padding: 4,
  },
  listContent: {
    paddingBottom: 24,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 10,
    minHeight: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  namePress: {
    flex: 1,
    marginRight: 8,
  },
  name: {
    fontSize: 17,
  },
  editInput: {
    flex: 1,
    marginRight: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 16,
  },
  rowActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
});
