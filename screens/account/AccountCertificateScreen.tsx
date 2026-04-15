import { useQueryClient } from "@tanstack/react-query";
import * as DocumentPicker from "expo-document-picker";
import {
  cacheDirectory,
  EncodingType,
  readAsStringAsync,
  writeAsStringAsync,
} from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
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
import { setStringAsync } from "lib/clipboard";
import { extractPublicKeyPemFromPkcs12Base64 } from "lib/account/extractPublicKeyPemFromPkcs12Base64";
import { queryKeys } from "lib/queryKeys";
import { certificateScreenPaletteForScheme } from "lib/theme/semanticUi";
import { accountsRepo } from "repositories";
import { alertError } from "utils/error";

export function AccountCertificateScreen() {
  const { t } = useTranslation();
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
    if (profileLoading) return t("certificateScreen.statusLoading");
    if (!activeAccount) return t("certificateScreen.statusNoAccount");
    return activeAccount.geminiClientP12Base64
      ? t("certificateScreen.statusConfigured")
      : t("certificateScreen.statusNotConfigured");
  }, [activeAccount, profileLoading, t]);

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
        Alert.alert(
          t("stack.certificate"),
          t("certificateScreen.importReadError"),
        );
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
        t("certificateScreen.importSuccessTitle"),
        t("certificateScreen.importSuccessMsg"),
      );
    } catch (e) {
      console.error("handleImportPkcs12", e);
      alertError(e, t("certificateScreen.errorImport"), t("stack.certificate"));
    }
  }, [activeAccount, queryClient, t]);

  const handleExportPkcs12 = useCallback(async () => {
    if (!activeAccount) return;
    const base64 = activeAccount.geminiClientP12Base64;
    if (!base64) {
      Alert.alert(t("stack.certificate"), t("certificateScreen.exportNoCert"));
      return;
    }
    try {
      const base = cacheDirectory;
      if (!base) {
        alertError(null, t("certificateScreen.exportNoCache"), t("stack.certificate"));
        return;
      }
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const path = `${base}geminyx-client-cert-${stamp}.p12`;
      setBusy(true);
      try {
        await writeAsStringAsync(path, base64, { encoding: EncodingType.Base64 });
      } finally {
        setBusy(false);
      }
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        alertError(null, t("certificateScreen.exportNoSharing"), t("stack.certificate"));
        return;
      }
      await Sharing.shareAsync(path, {
        mimeType: "application/x-pkcs12",
        UTI: "com.rsa.pkcs-12",
        dialogTitle: t("certificateScreen.exportDialogTitle"),
      });
    } catch (e) {
      console.error("handleExportPkcs12", e);
      alertError(e, t("certificateScreen.errorExport"), t("stack.certificate"));
    }
  }, [activeAccount, t]);

  const handleCopyPublicKey = useCallback(async () => {
    if (!activeAccount) return;
    const base64 = activeAccount.geminiClientP12Base64;
    if (!base64) {
      Alert.alert(t("stack.certificate"), t("certificateScreen.exportNoCert"));
      return;
    }
    try {
      setBusy(true);
      const pem = extractPublicKeyPemFromPkcs12Base64({
        pkcs12Base64: base64,
        passphrase: activeAccount.geminiClientP12Passphrase ?? "",
      });
      await setStringAsync(pem);
      Alert.alert(
        t("certificateScreen.publicKeyTitle"),
        t("certificateScreen.publicKeyCopied"),
      );
    } catch (e) {
      console.error("handleCopyPublicKey", e);
      alertError(e, t("certificateScreen.errorPublicKey"), t("stack.certificate"));
    } finally {
      setBusy(false);
    }
  }, [activeAccount, t]);

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
      Alert.alert(
        t("certificateScreen.importSuccessTitle"),
        t("certificateScreen.passphraseSaved"),
      );
    } catch (e) {
      console.error("handleSavePassphrase", e);
      alertError(e, t("certificateScreen.errorPassphrase"), t("stack.certificate"));
    } finally {
      setBusy(false);
    }
  }, [activeAccount, passphraseDraft, queryClient, t]);

  const handleClearCert = useCallback(() => {
    if (!activeAccount) return;
    Alert.alert(
      t("certificateScreen.removeTitle"),
      t("certificateScreen.removeMsg"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("certificateScreen.removeConfirm"),
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
              alertError(e, t("certificateScreen.errorRemove"), t("stack.certificate"));
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  }, [activeAccount, queryClient, t]);

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
          {t("certificateScreen.introHint")}
        </Text>

        <View style={[styles.card, { backgroundColor: palette.fieldBg }]}>
          <Text style={[styles.cardTitle, { color: palette.textPrimary }]}>
            {t("certificateScreen.statusTitle")}
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
                {t("certificateScreen.importButton")}
              </Text>
            )}
          </Pressable>

          {activeAccount?.geminiClientP12Base64 ? (
            <Pressable
              onPress={handleExportPkcs12}
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
                  {t("certificateScreen.exportButton")}
                </Text>
              )}
            </Pressable>
          ) : null}

          {activeAccount?.geminiClientP12Base64 ? (
            <Pressable
              onPress={handleCopyPublicKey}
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
                  {t("certificateScreen.publicKeyButton")}
                </Text>
              )}
            </Pressable>
          ) : null}
        </View>

        <View style={[styles.card, { backgroundColor: palette.fieldBg }]}>
          <Text style={[styles.cardTitle, { color: palette.textPrimary }]}>
            {t("certificateScreen.passphraseTitle")}
          </Text>
          <Text style={[styles.hint, { color: palette.textSecondary }]}>
            {t("certificateScreen.passphraseHint")}
          </Text>
          <TextInput
            value={passphraseDraft}
            onChangeText={setPassphraseDraft}
            placeholder={t("certificateScreen.placeholderOptional")}
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
              {t("certificateScreen.savePassphrase")}
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
                {t("certificateScreen.removeButton")}
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

