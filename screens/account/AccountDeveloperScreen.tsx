import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  exportLocalDatabaseToCacheAndShare,
  importLocalDatabaseFromPicker,
} from "lib/localDatabaseBackup";
import { notifyLocalDatabaseErased } from "lib/localDatabaseErase";
import { resetLocalDatabase } from "lib/databaseSetup";
import { systemBlueForScheme } from "lib/theme/appColors";
import { developerScreenPaletteForScheme } from "lib/theme/semanticUi";
import { alertError } from "utils/error";

export function AccountDeveloperScreen() {
  const { t } = useTranslation();
  const scheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const palette = useMemo(
    () => developerScreenPaletteForScheme(scheme),
    [scheme],
  );
  const accent = useMemo(() => systemBlueForScheme(scheme), [scheme]);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);

  const showEraseLocalDatabase = Platform.OS !== "web";

  const onExportDatabase = useCallback(async () => {
    try {
      setExporting(true);
      await exportLocalDatabaseToCacheAndShare();
    } catch (e) {
      console.error("exportLocalDatabaseToCacheAndShare failed", e);
      alertError(e, t("developerScreen.errorExport"), t("developerScreen.errorExport"));
    } finally {
      setExporting(false);
    }
  }, [t]);

  const confirmImportDatabase = useCallback(() => {
    Alert.alert(
      t("developerScreen.importTitle"),
      t("developerScreen.importMsg"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("developerScreen.importChooseFile"),
          onPress: async () => {
            try {
              setImporting(true);
              await importLocalDatabaseFromPicker();
            } catch (e) {
              console.error("importLocalDatabaseFromPicker failed", e);
              alertError(e, t("developerScreen.errorImport"), t("developerScreen.errorImport"));
            } finally {
              setImporting(false);
            }
          },
        },
      ],
    );
  }, [t]);

  const confirmEraseLocalData = useCallback(() => {
    Alert.alert(
      t("developerScreen.eraseTitle"),
      t("developerScreen.eraseMsg"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("developerScreen.eraseConfirm"),
          style: "destructive",
          onPress: async () => {
            try {
              await resetLocalDatabase();
              notifyLocalDatabaseErased();
            } catch (e) {
              console.error("resetLocalDatabase failed", e);
              alertError(e, t("developerScreen.errorErase"), t("developerScreen.errorErase"));
            }
          },
        },
      ],
    );
  }, [t]);

  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(24, insets.bottom + 16) },
        ]}
      >
        <Text style={[styles.hint, { color: palette.textSecondary }]}>
          {t("developerScreen.introHint")}
        </Text>

        {showEraseLocalDatabase ? (
          <View style={[styles.card, { backgroundColor: palette.cardBg }]}>
            <Text style={[styles.cardTitle, { color: palette.textPrimary }]}>
              {t("developerScreen.localDbTitle")}
            </Text>
            <Text style={[styles.hint, { color: palette.textSecondary }]}>
              {t("developerScreen.localDbHint")}
            </Text>
            <View style={styles.row}>
              <Pressable
                disabled={exporting || importing}
                onPress={onExportDatabase}
                style={({ pressed }) => [
                  styles.accentButton,
                  { borderColor: accent },
                  pressed && styles.pressedOpacity,
                  (exporting || importing) && styles.buttonDisabled,
                ]}
              >
                {exporting ? (
                  <ActivityIndicator color={accent} />
                ) : (
                  <Text style={[styles.accentLabel, { color: accent }]}>
                    {t("developerScreen.exportDb")}
                  </Text>
                )}
              </Pressable>
              <Pressable
                disabled={exporting || importing}
                onPress={confirmImportDatabase}
                style={({ pressed }) => [
                  styles.accentButton,
                  { borderColor: accent },
                  pressed && styles.pressedOpacity,
                  (exporting || importing) && styles.buttonDisabled,
                ]}
              >
                {importing ? (
                  <ActivityIndicator color={accent} />
                ) : (
                  <Text style={[styles.accentLabel, { color: accent }]}>
                    {t("developerScreen.importDb")}
                  </Text>
                )}
              </Pressable>
            </View>
            <Text style={[styles.hint, { color: palette.textSecondary }]}>
              {t("developerScreen.eraseHint")}
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
                {t("developerScreen.eraseButton")}
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={[styles.card, { backgroundColor: palette.cardBg }]}>
            <Text style={[styles.hint, { color: palette.textSecondary }]}>
              {t("developerScreen.eraseNotAvailable")}
            </Text>
          </View>
        )}
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
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    alignItems: "center",
  },
  accentButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    minWidth: 148,
    alignItems: "center",
    justifyContent: "center",
  },
  accentLabel: { fontSize: 16, fontWeight: "600" },
  pressedOpacity: { opacity: 0.75 },
  buttonDisabled: { opacity: 0.5 },
  dangerButton: {
    alignSelf: "flex-start",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  dangerLabel: { fontSize: 16, fontWeight: "600" },
});

