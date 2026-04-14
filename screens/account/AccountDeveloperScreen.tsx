import { useCallback, useMemo, useState } from "react";
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
      alertError(e, "Could not export the database.", "Could not export the database");
    } finally {
      setExporting(false);
    }
  }, []);

  const confirmImportDatabase = useCallback(() => {
    Alert.alert(
      "Import database?",
      "This replaces the local SQLite file with the file you pick. Unsaved work in memory may be lost. The app reloads in development; in release builds you may need to force-quit and reopen.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Choose file",
          onPress: async () => {
            try {
              setImporting(true);
              await importLocalDatabaseFromPicker();
            } catch (e) {
              console.error("importLocalDatabaseFromPicker failed", e);
              alertError(e, "Could not import the database.", "Could not import the database");
            } finally {
              setImporting(false);
            }
          },
        },
      ],
    );
  }, []);

  const confirmEraseLocalData = useCallback(() => {
    Alert.alert(
      "Erase local database?",
      "All accounts, capsules, threads, and messages on this device will be removed. You will return to onboarding.",
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
              alertError(e, "Could not erase database.", "Could not erase database");
            }
          },
        },
      ],
    );
  }, []);

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
          Developer utilities for this device.
        </Text>

        {showEraseLocalDatabase ? (
          <View style={[styles.card, { backgroundColor: palette.cardBg }]}>
            <Text style={[styles.cardTitle, { color: palette.textPrimary }]}>
              Local database
            </Text>
            <Text style={[styles.hint, { color: palette.textSecondary }]}>
              Export or import the WatermelonDB SQLite file (geminyx.db).
              Import replaces the file on disk; use backups from trusted sources
              only.
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
                    Export database
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
                    Import database
                  </Text>
                )}
              </Pressable>
            </View>
            <Text style={[styles.hint, { color: palette.textSecondary }]}>
              Erase removes all local data in SQLite. You will return to
              onboarding.
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
        ) : (
          <View style={[styles.card, { backgroundColor: palette.cardBg }]}>
            <Text style={[styles.hint, { color: palette.textSecondary }]}>
              Local database erase is not available on web.
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

