import { useQueryClient } from "@tanstack/react-query";
import * as DocumentPicker from "expo-document-picker";
import { readAsStringAsync } from "expo-file-system/legacy";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAccountActive } from "hooks/account/useAccountActive";
import { queryKeys } from "lib/queryKeys";
import { certificateScreenPaletteForScheme } from "lib/theme/semanticUi";
import { accountsRepo } from "repositories";
import { alertError } from "utils/error";

export function AccountCertificateScreen() {
  const scheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const palette = useMemo(
    () => certificateScreenPaletteForScheme(scheme),
    [scheme],
  );

  const queryClient = useQueryClient();
  const {
    data: activeAccount,
    isFetching: profileLoading,
  } = useAccountActive();
  const [busy, setBusy] = useState(false);

  const [passphraseDraft, setPassphraseDraft] = useState("");
  useEffect(() => {
    setPassphraseDraft(activeAccount?.geminiClientP12Passphrase ?? "");
  }, [activeAccount?.geminiClientP12Passphrase]);

  const certStatus = useMemo(() => {
    if (profileLoading) return "Loading…";
    if (!activeAccount) return "No active account";
    return activeAccount.geminiClientP12Base64
      ? "A certificate is configured for this account."
      : "No certificate configured.";
  }, [activeAccount, profileLoading]);

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
      setBusy(true);
      try {
        await accountsRepo.patch(activeAccount.id, {
          geminiClientP12Base64: base64,
        });
        await queryClient.invalidateQueries({
          queryKey: queryKeys.accounts.active(),
        });
      } finally {
        setBusy(false);
      }
      Alert.alert(
        "Certificate",
        "PKCS#12 saved. It will be used for Gemini requests from this account.",
      );
    } catch (e) {
      console.error("handleImportPkcs12", e);
      alertError(e, "Could not import certificate.", "Certificate");
    }
  }, [activeAccount, queryClient]);

  const handleSavePassphrase = useCallback(async () => {
    if (!activeAccount) return;
    try {
      setBusy(true);
      await accountsRepo.patch(activeAccount.id, {
        geminiClientP12Passphrase: passphraseDraft,
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.accounts.active(),
      });
      Alert.alert("Certificate", "Passphrase saved.");
    } catch (e) {
      console.error("handleSavePassphrase", e);
      alertError(e, "Could not save passphrase.", "Certificate");
    } finally {
      setBusy(false);
    }
  }, [activeAccount, passphraseDraft, queryClient]);

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
              setBusy(true);
              await accountsRepo.patch(activeAccount.id, {
                geminiClientP12Base64: null,
                geminiClientP12Passphrase: null,
              });
              setPassphraseDraft("");
              await queryClient.invalidateQueries({
                queryKey: queryKeys.accounts.active(),
              });
            } catch (e) {
              console.error("handleClearCert", e);
              alertError(e, "Could not remove certificate.", "Certificate");
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  }, [activeAccount, queryClient]);

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
        <Text style={[styles.hint, { color: palette.textSecondary }]}>
          Optional PKCS#12 (.p12) for servers that require TLS client
          authentication. On iOS, the native Gemini fetch can use this certificate.
        </Text>

        <View style={[styles.card, { backgroundColor: palette.fieldBg }]}>
          <Text style={[styles.cardTitle, { color: palette.textPrimary }]}>
            Status
          </Text>
          <Text
            style={[
              styles.cardBody,
              {
                color: activeAccount?.geminiClientP12Base64
                  ? palette.textSecondary
                  : palette.textTertiary,
              },
            ]}
          >
            {certStatus}
          </Text>

          <Pressable
            onPress={handleImportPkcs12}
            disabled={profileLoading || !activeAccount || busy}
            style={({ pressed }) => [
              styles.secondaryButton,
              {
                borderColor: palette.fieldBorder,
                opacity: profileLoading || !activeAccount || busy ? 0.5 : 1,
              },
              pressed && { backgroundColor: palette.rowPressed },
            ]}
          >
            {busy ? (
              <ActivityIndicator />
            ) : (
              <Text style={[styles.secondaryLabel, { color: palette.textPrimary }]}>
                Import PKCS#12 file…
              </Text>
            )}
          </Pressable>
        </View>

        <View style={[styles.card, { backgroundColor: palette.fieldBg }]}>
          <Text style={[styles.cardTitle, { color: palette.textPrimary }]}>
            Passphrase
          </Text>
          <Text style={[styles.hint, { color: palette.textSecondary }]}>
            If the archive is encrypted.
          </Text>
          <TextInput
            value={passphraseDraft}
            onChangeText={setPassphraseDraft}
            placeholder="Optional"
            placeholderTextColor={palette.textTertiary}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            editable={!!activeAccount && !busy}
            style={[
              styles.passphraseInput,
              {
                borderColor: palette.fieldBorder,
                color: palette.textPrimary,
                backgroundColor: palette.background,
              },
            ]}
          />
          <Pressable
            onPress={handleSavePassphrase}
            disabled={profileLoading || !activeAccount || busy}
            style={({ pressed }) => [
              styles.secondaryButton,
              {
                borderColor: palette.fieldBorder,
                opacity: profileLoading || !activeAccount || busy ? 0.5 : 1,
              },
              pressed && { backgroundColor: palette.rowPressed },
            ]}
          >
            <Text style={[styles.secondaryLabel, { color: palette.textPrimary }]}>
              Save passphrase
            </Text>
          </Pressable>
        </View>

        {activeAccount?.geminiClientP12Base64 ? (
          <View style={[styles.card, { backgroundColor: palette.fieldBg }]}>
            <Pressable
              onPress={handleClearCert}
              disabled={busy}
              style={({ pressed }) => [
                styles.dangerButton,
                { borderColor: palette.danger, opacity: busy ? 0.6 : 1 },
                pressed && { backgroundColor: palette.dangerPressed },
              ]}
            >
              <Text style={[styles.dangerLabel, { color: palette.danger }]}>
                Remove certificate
              </Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 12, gap: 12 },
  hint: { fontSize: 13, lineHeight: 18 },
  card: {
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  cardTitle: { fontSize: 17, fontWeight: "600" },
  cardBody: { fontSize: 14, lineHeight: 18 },
  secondaryButton: {
    alignSelf: "flex-start",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    minWidth: 220,
    alignItems: "center",
  },
  secondaryLabel: { fontSize: 16, fontWeight: "600" },
  passphraseInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
  },
  dangerButton: {
    alignSelf: "flex-start",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  dangerLabel: { fontSize: 16, fontWeight: "600" },
});

