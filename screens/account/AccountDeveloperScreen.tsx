import { useCallback, useMemo } from "react";
import {
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
import { notifyLocalDatabaseErased } from "lib/localDatabaseErase";
import { resetLocalDatabase } from "lib/databaseSetup";
import { developerScreenPaletteForScheme } from "lib/theme/semanticUi";
import { alertError } from "utils/error";

export function AccountDeveloperScreen() {
  const scheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const palette = useMemo(
    () => developerScreenPaletteForScheme(scheme),
    [scheme],
  );

  const showEraseLocalDatabase = Platform.OS !== "web";

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
              Removes all local data stored in this app’s SQLite database. You
              will return to onboarding.
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
  dangerButton: {
    alignSelf: "flex-start",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  dangerLabel: { fontSize: 16, fontWeight: "600" },
});

