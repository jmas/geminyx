import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { selectCapsuleUiPalette } from "components/capsule/capsuleUiPalette";
import type { Account } from "lib/models/account";
import { queryKeys } from "lib/queryKeys";
import {
  iosAccountSwitchPalette,
  systemBlueForScheme,
} from "lib/theme/appColors";
import { accountsRepo } from "repositories";
import { avatarHueFromId, initialsFromName } from "utils/avatar";

const colors = {
  light: {
    textPrimary: "#000000",
    textSecondary: "#8e8e93",
    cardBg: "rgba(120, 120, 128, 0.12)",
  },
  dark: {
    textPrimary: "#f2f2f7",
    textSecondary: "rgba(235, 235, 245, 0.55)",
    cardBg: "rgba(120, 120, 128, 0.24)",
  },
} as const;

type SwitchPalette =
  | (typeof colors)[keyof typeof colors]
  | ReturnType<typeof iosAccountSwitchPalette>;

export type AccountSwitchModalProps = {
  visible: boolean;
  onClose: () => void;
};

export function AccountSwitchModal({ visible, onClose }: AccountSwitchModalProps) {
  const queryClient = useQueryClient();
  const scheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const sheet = selectCapsuleUiPalette(scheme);
  const palette: SwitchPalette =
    Platform.OS === "ios"
      ? iosAccountSwitchPalette()
      : scheme === "dark"
        ? colors.dark
        : colors.light;
  const blue = systemBlueForScheme(scheme);

  const { data: accountsRaw = [], isFetching: loading } = useQuery({
    queryKey: queryKeys.accounts.list(),
    queryFn: () => accountsRepo.list(),
    enabled: visible,
  });

  const accounts = useMemo(() => {
    return [...accountsRaw].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    );
  }, [accountsRaw]);

  const [switchingId, setSwitchingId] = useState<string | null>(null);

  const handleSelect = useCallback(
    async (account: Account) => {
      if (account.isActive) {
        onClose();
        return;
      }
      setSwitchingId(account.id);
      try {
        await accountsRepo.patch(account.id, { isActive: true });
        await queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all });
        await queryClient.invalidateQueries({ queryKey: queryKeys.capsules.all });
        await queryClient.invalidateQueries({ queryKey: queryKeys.threads.all });
        onClose();
      } catch (e) {
        console.error("AccountSwitchModal switch failed", e);
      } finally {
        setSwitchingId(null);
      }
    },
    [onClose, queryClient],
  );

  const handleCreateNew = useCallback(() => {
    onClose();
    router.push("/account/create" as any);
  }, [onClose]);


  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === "ios" ? "pageSheet" : "fullScreen"}
      onRequestClose={onClose}
    >
      <View style={[styles.root, { backgroundColor: sheet.background }]}>
        <View style={styles.grabberWrap}>
          <View style={[styles.grabber, { backgroundColor: sheet.sheetHandle }]} />
        </View>
        <Text style={[styles.title, { color: sheet.sheetTitle }]} accessibilityRole="header">
          Accounts
        </Text>

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator />
          </View>
        ) : (
          <FlatList
            style={styles.list}
            data={accounts}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const busy = switchingId === item.id;
              return (
                <Pressable
                  onPress={() => void handleSelect(item)}
                  disabled={busy}
                  style={({ pressed }) => [
                    styles.accountRow,
                    {
                      backgroundColor: palette.cardBg,
                    },
                    pressed && !busy && { opacity: 0.92 },
                  ]}
                >
                  <AccountRowAvatar account={item} />
                  <View style={styles.accountText}>
                    <Text
                      style={[styles.accountName, { color: palette.textPrimary }]}
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                    {item.email ? (
                      <Text
                        style={[styles.accountEmail, { color: palette.textSecondary }]}
                        numberOfLines={1}
                      >
                        {item.email}
                      </Text>
                    ) : null}
                  </View>
                  {busy ? (
                    <ActivityIndicator size="small" />
                  ) : item.isActive ? (
                    <Ionicons name="checkmark-circle" size={22} color={blue} />
                  ) : null}
                </Pressable>
              );
            }}
            ListFooterComponent={
              <Pressable
                onPress={handleCreateNew}
                style={({ pressed }) => [
                  styles.createRow,
                  { borderColor: blue },
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Ionicons name="add-circle-outline" size={22} color={blue} />
                <Text style={[styles.createLabel, { color: blue }]}>
                  Create new account
                </Text>
              </Pressable>
            }
          />
        )}

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
            onPress={onClose}
            style={({ pressed }) => [
              styles.doneBtn,
              pressed && { opacity: 0.55 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Done"
          >
            <Text style={[styles.doneLabel, { color: sheet.cancelLabel }]}>Done</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function AccountRowAvatar({ account }: { account: Account }) {
  const hue = avatarHueFromId(account.id);
  const initials = initialsFromName(account.name);
  return (
    <View
      style={[
        styles.rowAvatar,
        { backgroundColor: `hsl(${hue}, 42%, 46%)` },
      ]}
    >
      <Text style={styles.rowAvatarInitials}>{initials}</Text>
    </View>
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
  },
  list: {
    flex: 1,
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  accountRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    minHeight: 56,
    marginBottom: 8,
  },
  rowAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  rowAvatarInitials: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600",
  },
  accountText: {
    flex: 1,
    minWidth: 0,
  },
  accountName: {
    fontSize: 17,
    fontWeight: "600",
  },
  accountEmail: {
    fontSize: 14,
    marginTop: 2,
  },
  createRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 20,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  createLabel: {
    fontSize: 17,
    fontWeight: "600",
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
});
