import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { TFunction } from "i18next";
import { useLayoutEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
  type ColorValue,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AccountSwitchModal } from "components/account/AccountSwitchModal";
import { useAccountActive } from "hooks/account/useAccountActive";
import { syncLanguageFromSettings } from "lib/i18n";
import type { Account } from "lib/models/account";
import { queryKeys } from "lib/queryKeys";
import {
  systemBlueForScheme,
  systemGreenColor,
  systemOrangeColor,
} from "lib/theme/appColors";
import {
  screenContentListPaletteForScheme,
} from "lib/theme/semanticUi";
import { avatarHueFromId, initialsFromName } from "utils/avatar";
import {
  parseAppLanguagePreference,
  settingsRepo,
  SETTINGS_UI_LANGUAGE_KEY,
  type AppLanguagePreference,
} from "repositories";

type SettingsPalette = ReturnType<typeof screenContentListPaletteForScheme>;

const LANGUAGE_OPTIONS: AppLanguagePreference[] = ["system", "en", "uk"];

const LANGUAGE_ICON_BG = "#5856D6";

function labelForLanguagePreference(
  pref: AppLanguagePreference,
  t: TFunction,
): string {
  switch (pref) {
    case "system":
      return t("settings.languageSystem");
    case "en":
      return t("settings.languageEnglish");
    case "uk":
      return t("settings.languageUkrainian");
  }
}

export function AccountSettingsScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const scheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const palette = useMemo(
    () => screenContentListPaletteForScheme(scheme),
    [scheme],
  );

  const {
    data: activeAccount,
    isFetching: profileLoading,
  } = useAccountActive();

  const [languageModalOpen, setLanguageModalOpen] = useState(false);

  const { data: languagePref = "system" } = useQuery({
    queryKey: queryKeys.settings.uiLanguage(),
    queryFn: async () => {
      const raw = await settingsRepo.getForActiveAccount(
        SETTINGS_UI_LANGUAGE_KEY,
      );
      return parseAppLanguagePreference(raw) ?? "system";
    },
    enabled: Boolean(activeAccount?.id),
  });

  const setLanguageMutation = useMutation({
    mutationFn: async (pref: AppLanguagePreference) => {
      await settingsRepo.setForActiveAccount(SETTINGS_UI_LANGUAGE_KEY, pref);
      await syncLanguageFromSettings();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.settings.uiLanguage(),
      });
    },
  });

  const certStatus = useMemo(() => {
    if (profileLoading) return "";
    if (!activeAccount) return t("settings.noActiveAccount");
    return activeAccount.geminiClientP12Base64
      ? t("settings.certConfigured")
      : t("settings.certNotConfigured");
  }, [activeAccount, profileLoading, t]);

  const developerSubtitle = t("settings.developerTools");

  const [accountSwitchOpen, setAccountSwitchOpen] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ title: t("settings.title") });
  }, [navigation, t]);

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
                  {t("settings.loadingProfile")}
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
                      {t("settings.noEmail")}
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
                {t("settings.noActiveAccount")}
              </Text>
            )}
          </Pressable>
        </View>

        <View style={[styles.menuSection, { backgroundColor: palette.cardBg }]}>
          <MenuRow
            label={t("settings.language")}
            subtitle={labelForLanguagePreference(languagePref, t)}
            iconName="language-outline"
            iconBg={LANGUAGE_ICON_BG}
            palette={palette}
            onPress={() => {
              if (!activeAccount?.id) return;
              setLanguageModalOpen(true);
            }}
            disabled={profileLoading || !activeAccount}
          />
          <MenuSeparator palette={palette} />
          <MenuRow
            label={t("settings.switchAccount")}
            subtitle={t("settings.switchAccountSubtitle")}
            iconName="swap-horizontal"
            iconBg={systemBlueForScheme(scheme)}
            palette={palette}
            onPress={() => setAccountSwitchOpen(true)}
          />
          <MenuSeparator palette={palette} />
          <MenuRow
            label={t("stack.certificate")}
            subtitle={certStatus}
            iconName="shield-checkmark"
            iconBg={systemGreenColor()}
            palette={palette}
            onPress={() => router.push("/account/certificate" as any)}
          />
          <MenuSeparator palette={palette} />
          <MenuRow
            label={t("stack.developer")}
            subtitle={developerSubtitle}
            iconName="hammer"
            iconBg={systemOrangeColor()}
            palette={palette}
            onPress={() => router.push("/account/developer" as any)}
          />
        </View>
      </ScrollView>

      <AccountSwitchModal
        visible={accountSwitchOpen}
        onClose={() => setAccountSwitchOpen(false)}
      />

      <Modal
        visible={languageModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setLanguageModalOpen(false)}
      >
        <View style={styles.langModalRoot}>
          <Pressable
            style={styles.langModalBackdrop}
            onPress={() => setLanguageModalOpen(false)}
            accessibilityLabel={t("common.dismiss")}
          />
          <View
            style={[
              styles.langModalSheet,
              {
                backgroundColor: palette.cardBg,
                borderColor: palette.separator,
                marginBottom: Math.max(insets.bottom, 12),
              },
            ]}
          >
            <Text
              style={[styles.langModalTitle, { color: palette.textPrimary }]}
              accessibilityRole="header"
            >
              {t("settings.languagePickerTitle")}
            </Text>
            {LANGUAGE_OPTIONS.map((opt, index) => (
              <Pressable
                key={opt}
                onPress={() => {
                  void (async () => {
                    try {
                      await setLanguageMutation.mutateAsync(opt);
                      setLanguageModalOpen(false);
                    } catch (e) {
                      console.error("set language failed", e);
                    }
                  })();
                }}
                disabled={setLanguageMutation.isPending}
                style={({ pressed }) => [
                  styles.langModalRow,
                  index > 0 && {
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: palette.separator,
                  },
                  pressed && { opacity: 0.75 },
                ]}
              >
                <Text
                  style={[styles.langModalRowLabel, { color: palette.textPrimary }]}
                >
                  {labelForLanguagePreference(opt, t)}
                </Text>
                {languagePref === opt ? (
                  <Ionicons
                    name="checkmark"
                    size={22}
                    color={systemBlueForScheme(scheme)}
                  />
                ) : (
                  <View style={{ width: 22 }} />
                )}
              </Pressable>
            ))}
            {setLanguageMutation.isPending ? (
              <View style={styles.langModalPending}>
                <ActivityIndicator />
              </View>
            ) : null}
            <View
              style={[
                styles.langModalFooter,
                { borderTopColor: palette.separator },
              ]}
            >
              <Pressable
                onPress={() => setLanguageModalOpen(false)}
                style={({ pressed }) => [
                  styles.langModalDoneBtn,
                  pressed && { opacity: 0.55 },
                ]}
                accessibilityRole="button"
                accessibilityLabel={t("common.cancel")}
              >
                <Text
                  style={[styles.langModalDoneLabel, { color: palette.textSecondary }]}
                >
                  {t("common.cancel")}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function MenuSeparator({ palette }: { palette: SettingsPalette }) {
  return <View style={[styles.menuSeparator, { backgroundColor: palette.separator }]} />;
}

function MenuRow({
  label,
  subtitle,
  iconName,
  iconBg,
  palette,
  onPress,
  disabled,
}: {
  label: string;
  subtitle?: string;
  iconName: keyof typeof Ionicons.glyphMap;
  iconBg: ColorValue;
  palette: SettingsPalette;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.menuRow,
        pressed && !disabled && { backgroundColor: palette.rowPressed },
        disabled && { opacity: 0.45 },
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
  langModalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  langModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  langModalSheet: {
    marginHorizontal: 16,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  langModalTitle: {
    fontSize: 17,
    fontWeight: "600",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  langModalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  langModalRowLabel: {
    fontSize: 17,
    flex: 1,
    marginRight: 12,
  },
  langModalPending: {
    paddingVertical: 8,
    alignItems: "center",
  },
  langModalFooter: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  langModalDoneBtn: {
    paddingVertical: 14,
    alignItems: "center",
  },
  langModalDoneLabel: {
    fontSize: 17,
    fontWeight: "600",
  },
});
