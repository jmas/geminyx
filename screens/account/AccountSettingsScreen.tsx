import { useList } from "@refinedev/core";
import { useEffect, useState } from "react";
import {
  Alert,
  DevSettings,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";
import type { Account } from "lib/models/account";
import { RESOURCES } from "lib/refineDataProvider";
import { resetLocalDatabase } from "lib/sqlite";
import { appColors } from "lib/theme/appColors";
import { avatarHueFromId, initialsFromName } from "utils/avatar";

const colors = {
  light: {
    background: appColors.screenLight,
    textPrimary: "#000000",
    textSecondary: "#8e8e93",
    textTertiary: "#aeaeb2",
    danger: "#c62828",
    dangerPressed: "rgba(198, 40, 40, 0.12)",
    profilePressed: "rgba(0, 0, 0, 0.04)",
  },
  dark: {
    background: appColors.screenDark,
    textPrimary: "#f2f2f7",
    textSecondary: "rgba(235, 235, 245, 0.55)",
    textTertiary: "rgba(235, 235, 245, 0.35)",
    danger: "#ff6b6b",
    dangerPressed: "rgba(255, 107, 107, 0.15)",
    profilePressed: "rgba(255, 255, 255, 0.06)",
  },
} as const;

export function AccountSettingsScreen() {
  const scheme = useColorScheme();
  const palette = scheme === "dark" ? colors.dark : colors.light;
  const showDevReset =
    __DEV__ && Platform.OS !== "web" && DevSettings.reload != null;

  const { result, query } = useList<Account>({
    resource: RESOURCES.accounts,
    filters: [
      {
        field: "is_active",
        operator: "eq",
        value: true,
      },
    ],
    pagination: { mode: "off" },
  });

  const activeAccount = result.data?.[0];
  const profileLoading = query.isLoading || query.isFetching;

  function confirmEraseLocalData() {
    Alert.alert(
      "Erase local database?",
      "All accounts, capsules, dialogs, and messages on this device will be removed. Demo seed data will be recreated on next launch.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Erase",
          style: "destructive",
          onPress: async () => {
            try {
              await resetLocalDatabase();
              DevSettings.reload();
            } catch (e) {
              console.error("resetLocalDatabase failed", e);
              Alert.alert(
                "Could not erase database",
                e instanceof Error ? e.message : String(e),
              );
            }
          },
        },
      ],
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      <Pressable
        disabled={profileLoading || !activeAccount}
        style={({ pressed }) => [
          styles.profileRow,
          pressed &&
            activeAccount &&
            !profileLoading && {
              backgroundColor: palette.profilePressed,
            },
        ]}
      >
        {profileLoading ? (
          <View style={styles.profileLoading}>
            <Text style={[styles.loadingText, { color: palette.textSecondary }]}>
              Loading profile…
            </Text>
          </View>
        ) : activeAccount ? (
          <>
            <ProfileAvatar account={activeAccount} />
            <View style={styles.profileText}>
              <Text
                style={[styles.profileName, { color: palette.textPrimary }]}
                numberOfLines={1}
              >
                {activeAccount.name}
              </Text>
              {activeAccount.email ? (
                <Text
                  style={[styles.profileSubtitle, { color: palette.textSecondary }]}
                  numberOfLines={1}
                >
                  {activeAccount.email}
                </Text>
              ) : (
                <Text
                  style={[styles.profileSubtitle, { color: palette.textTertiary }]}
                  numberOfLines={1}
                >
                  No email on this account
                </Text>
              )}
            </View>
          </>
        ) : (
          <Text style={[styles.loadingText, { color: palette.textSecondary }]}>
            No active account
          </Text>
        )}
      </Pressable>

      {showDevReset ? (
        <View style={[styles.section, styles.devSection]}>
          <Text style={[styles.hint, { color: palette.textSecondary }]}>
            Development: wipe SQLite and reload (same effect as deleting the app’s
            data for this build).
          </Text>
          <Pressable
            onPress={confirmEraseLocalData}
            style={({ pressed }) => [
              styles.dangerButton,
              { borderColor: palette.danger },
              pressed && { backgroundColor: palette.dangerPressed },
            ]}
          >
            <Text style={[styles.dangerLabel, { color: palette.danger }]}>
              Erase local database
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function ProfileAvatar({ account }: { account: Account }) {
  const hue = avatarHueFromId(account.id);
  const initials = initialsFromName(account.name);
  const uri = account.avatarUrl;
  const [failed, setFailed] = useState(!uri);

  useEffect(() => {
    setFailed(!uri);
  }, [uri]);

  if (!failed && uri) {
    return (
      <Image
        accessibilityLabel={`${account.name} profile photo`}
        source={{ uri }}
        style={styles.profileAvatarImage}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <View
      style={[
        styles.profileAvatarFallback,
        { backgroundColor: `hsl(${hue}, 42%, 46%)` },
      ]}
      accessibilityLabel={`${account.name} profile photo`}
    >
      <Text style={styles.profileAvatarInitials}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderRadius: 12,
    minHeight: 88,
  },
  profileLoading: {
    flex: 1,
    justifyContent: "center",
    minHeight: 72,
  },
  loadingText: {
    fontSize: 15,
  },
  profileAvatarImage: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  profileAvatarFallback: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  profileAvatarInitials: {
    color: "#ffffff",
    fontSize: 26,
    fontWeight: "600",
  },
  profileText: {
    flex: 1,
    marginLeft: 16,
    justifyContent: "center",
  },
  profileName: {
    fontSize: 22,
    fontWeight: "600",
    letterSpacing: -0.3,
  },
  profileSubtitle: {
    fontSize: 16,
    marginTop: 4,
  },
  section: {
    gap: 12,
  },
  devSection: {
    marginTop: 28,
  },
  hint: {
    fontSize: 13,
    lineHeight: 18,
  },
  dangerButton: {
    alignSelf: "flex-start",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  dangerLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
});
