import { router } from "expo-router";
import { useList } from "@refinedev/core";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { AccountSwitchModal } from "components/account/AccountSwitchModal";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Account } from "lib/models/account";
import { RESOURCES } from "lib/refineDataProvider";
import { appColors, systemBlueForScheme } from "lib/theme/appColors";
import { avatarHueFromId, initialsFromName } from "utils/avatar";

const colors = {
  light: {
    background: appColors.screenLight,
    textPrimary: "#000000",
    textSecondary: "#8e8e93",
    textTertiary: "#aeaeb2",
    profilePressed: "rgba(0, 0, 0, 0.04)",
    cardBg: "rgba(120, 120, 128, 0.12)",
    separator: "rgba(60, 60, 67, 0.29)",
    rowPressed: "rgba(0, 0, 0, 0.04)",
  },
  dark: {
    background: appColors.screenDark,
    textPrimary: "#f2f2f7",
    textSecondary: "rgba(235, 235, 245, 0.55)",
    textTertiary: "rgba(235, 235, 245, 0.35)",
    profilePressed: "rgba(255, 255, 255, 0.06)",
    cardBg: "rgba(120, 120, 128, 0.24)",
    separator: "rgba(255, 255, 255, 0.12)",
    rowPressed: "rgba(255, 255, 255, 0.06)",
  },
} as const;

export function AccountSettingsScreen() {
  const scheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const palette = scheme === "dark" ? colors.dark : colors.light;

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
  const certStatus = useMemo(() => {
    if (profileLoading) return "";
    if (!activeAccount) return "No active account";
    return activeAccount.geminiClientP12Base64 ? "Configured" : "Not configured";
  }, [activeAccount, profileLoading]);

  const [developerSubtitle, setDeveloperSubtitle] = useState<string>("Developer tools");
  useEffect(() => {
    setDeveloperSubtitle("Developer tools");
  }, []);

  const [accountSwitchOpen, setAccountSwitchOpen] = useState(false);

  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(24, insets.bottom + 16) },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator
      >
        <View style={[styles.profileCard, { backgroundColor: palette.cardBg }]}>
          <Pressable
            onPress={() => router.push("/account/edit" as any)}
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
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={palette.textTertiary}
                  style={{ marginLeft: 8 }}
                />
              </>
            ) : (
              <Text style={[styles.loadingText, { color: palette.textSecondary }]}>
                No active account
              </Text>
            )}
          </Pressable>
        </View>

        <View style={[styles.menuSection, { backgroundColor: palette.cardBg }]}>
          <MenuRow
            label="Switch account"
            subtitle="Choose another profile or add one"
            iconName="swap-horizontal"
            iconBg={systemBlueForScheme(scheme)}
            palette={palette}
            onPress={() => setAccountSwitchOpen(true)}
          />
          <MenuSeparator palette={palette} />
          <MenuRow
            label="Certificate"
            subtitle={certStatus}
            iconName="shield-checkmark"
            iconBg="#34C759"
            palette={palette}
            onPress={() => router.push("/account/certificate" as any)}
          />
          <MenuSeparator palette={palette} />
          <MenuRow
            label="Developer"
            subtitle={developerSubtitle}
            iconName="hammer"
            iconBg="#FF9500"
            palette={palette}
            onPress={() => router.push("/account/developer" as any)}
          />
        </View>
      </ScrollView>

      <AccountSwitchModal
        visible={accountSwitchOpen}
        onClose={() => setAccountSwitchOpen(false)}
      />
    </View>
  );
}

function MenuSeparator({ palette }: { palette: (typeof colors)["light"] | (typeof colors)["dark"] }) {
  return <View style={[styles.menuSeparator, { backgroundColor: palette.separator }]} />;
}

function MenuRow({
  label,
  subtitle,
  iconName,
  iconBg,
  palette,
  onPress,
}: {
  label: string;
  subtitle?: string;
  iconName: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  palette: (typeof colors)["light"] | (typeof colors)["dark"];
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.menuRow,
        pressed && { backgroundColor: palette.rowPressed },
      ]}
    >
      <View style={[styles.menuIconWrap, { backgroundColor: iconBg }]}>
        <Ionicons name={iconName} size={18} color="#ffffff" />
      </View>
      <View style={styles.menuText}>
        <Text style={[styles.menuLabel, { color: palette.textPrimary }]}>
          {label}
        </Text>
        {subtitle ? (
          <Text
            style={[styles.menuSubtitle, { color: palette.textSecondary }]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Ionicons
        name="chevron-forward"
        size={18}
        color={palette.textTertiary}
      />
    </Pressable>
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
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  profileCard: {
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 16,
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 14,
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
  menuSection: {
    borderRadius: 14,
    overflow: "hidden",
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  menuSeparator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 56,
  },
  menuIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  menuText: {
    flex: 1,
    gap: 2,
  },
  menuLabel: {
    fontSize: 17,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  menuSubtitle: {
    fontSize: 13,
  },
});
