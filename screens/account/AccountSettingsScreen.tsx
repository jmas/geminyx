import { useList, useUpdate } from "@refinedev/core";
import * as DocumentPicker from "expo-document-picker";
import { readAsStringAsync } from "expo-file-system/legacy";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Account } from "lib/models/account";
import { notifyLocalDatabaseErased } from "lib/localDatabaseErase";
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
  const insets = useSafeAreaInsets();
  const palette = scheme === "dark" ? colors.dark : colors.light;
  /** SQLite lives on native; web build has no file-backed DB to erase here. */
  const showEraseLocalDatabase = Platform.OS !== "web";

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

  const { mutateAsync: updateAccount, mutation: certMutation } = useUpdate<Account>({
    resource: RESOURCES.accounts,
  });
  const certBusy = certMutation.isPending;

  const [passphraseDraft, setPassphraseDraft] = useState("");
  useEffect(() => {
    setPassphraseDraft(activeAccount?.geminiClientP12Passphrase ?? "");
  }, [activeAccount?.geminiClientP12Passphrase]);

  const handleImportPkcs12 = useCallback(async () => {
    if (!activeAccount) return;
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (picked.canceled) return;
      const uri = picked.assets?.[0]?.uri;
      if (!uri) {
        Alert.alert("Certificate", "Could not read the selected file.");
        return;
      }
      const base64 = await readAsStringAsync(uri, { encoding: "base64" });
      await updateAccount({
        id: activeAccount.id,
        values: { geminiClientP12Base64: base64 },
      });
      await query.refetch();
      Alert.alert("Certificate", "PKCS#12 saved. It will be used for Gemini requests from this account.");
    } catch (e) {
      console.error("handleImportPkcs12", e);
      Alert.alert(
        "Certificate",
        e instanceof Error ? e.message : String(e),
      );
    }
  }, [activeAccount, query, updateAccount]);

  const handleSavePassphrase = useCallback(async () => {
    if (!activeAccount) return;
    try {
      await updateAccount({
        id: activeAccount.id,
        values: { geminiClientP12Passphrase: passphraseDraft },
      });
      await query.refetch();
      Alert.alert("Certificate", "Passphrase saved.");
    } catch (e) {
      Alert.alert(
        "Certificate",
        e instanceof Error ? e.message : String(e),
      );
    }
  }, [activeAccount, passphraseDraft, query, updateAccount]);

  const handleClearCert = useCallback(() => {
    if (!activeAccount) return;
    Alert.alert(
      "Remove client certificate?",
      "Gemini requests will no longer use a client certificate for this account.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await updateAccount({
                id: activeAccount.id,
                values: {
                  geminiClientP12Base64: null,
                  geminiClientP12Passphrase: null,
                },
              });
              setPassphraseDraft("");
              await query.refetch();
            } catch (e) {
              Alert.alert(
                "Certificate",
                e instanceof Error ? e.message : String(e),
              );
            }
          },
        },
      ],
    );
  }, [activeAccount, query, updateAccount]);

  function confirmEraseLocalData() {
    Alert.alert(
      "Erase local database?",
      "All accounts, capsules, dialogs, and messages on this device will be removed. You will return to onboarding.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Erase",
          style: "destructive",
          onPress: async () => {
            try {
              await resetLocalDatabase();
              notifyLocalDatabaseErased();
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

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: palette.textPrimary }]}>
          Gemini client certificate
        </Text>
        <Text style={[styles.hint, { color: palette.textSecondary }]}>
          Optional PKCS#12 (.p12) for servers that require TLS client authentication. On other
          platforms, the file is stored for this account; native Gemini fetch with a certificate
          is implemented on iOS.
        </Text>
        {activeAccount?.geminiClientP12Base64 ? (
          <Text style={[styles.certStatus, { color: palette.textSecondary }]}>
            A certificate is configured for this account.
          </Text>
        ) : (
          <Text style={[styles.certStatus, { color: palette.textTertiary }]}>
            No certificate configured.
          </Text>
        )}
        <Pressable
          onPress={handleImportPkcs12}
          disabled={profileLoading || !activeAccount || certBusy}
          style={({ pressed }) => [
            styles.secondaryButton,
            {
              borderColor: palette.textSecondary,
              opacity: profileLoading || !activeAccount || certBusy ? 0.45 : 1,
            },
            pressed && { backgroundColor: palette.profilePressed },
          ]}
        >
          {certBusy ? (
            <ActivityIndicator />
          ) : (
            <Text style={[styles.secondaryLabel, { color: palette.textPrimary }]}>
              Import PKCS#12 file…
            </Text>
          )}
        </Pressable>
        <Text style={[styles.fieldLabel, { color: palette.textSecondary }]}>
          Passphrase (if the archive is encrypted)
        </Text>
        <TextInput
          value={passphraseDraft}
          onChangeText={setPassphraseDraft}
          placeholder="Optional"
          placeholderTextColor={palette.textTertiary}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          editable={!!activeAccount && !certBusy}
          style={[
            styles.passphraseInput,
            {
              borderColor: palette.textTertiary,
              color: palette.textPrimary,
            },
          ]}
        />
        <Pressable
          onPress={handleSavePassphrase}
          disabled={profileLoading || !activeAccount || certBusy}
          style={({ pressed }) => [
            styles.secondaryButton,
            {
              borderColor: palette.textSecondary,
              marginTop: 8,
              opacity: profileLoading || !activeAccount || certBusy ? 0.45 : 1,
            },
            pressed && { backgroundColor: palette.profilePressed },
          ]}
        >
          <Text style={[styles.secondaryLabel, { color: palette.textPrimary }]}>
            Save passphrase
          </Text>
        </Pressable>
        {activeAccount?.geminiClientP12Base64 ? (
          <Pressable
            onPress={handleClearCert}
            disabled={certBusy}
            style={({ pressed }) => [
              styles.dangerButton,
              { borderColor: palette.danger, marginTop: 12 },
              pressed && { backgroundColor: palette.dangerPressed },
            ]}
          >
            <Text style={[styles.dangerLabel, { color: palette.danger }]}>
              Remove certificate
            </Text>
          </Pressable>
        ) : null}
      </View>

      {showEraseLocalDatabase ? (
        <View style={[styles.section, styles.eraseSection]}>
          <Text style={[styles.hint, { color: palette.textSecondary }]}>
            Remove all local data stored in this app’s database (same as deleting
            the app’s data for this build). You will return to onboarding.
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
      </ScrollView>
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
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
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
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "600",
  },
  certStatus: {
    fontSize: 14,
  },
  secondaryButton: {
    alignSelf: "flex-start",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    minWidth: 200,
    alignItems: "center",
  },
  secondaryLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    marginTop: 8,
  },
  passphraseInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 12 : 10,
    fontSize: 16,
    marginTop: 6,
  },
  eraseSection: {
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
