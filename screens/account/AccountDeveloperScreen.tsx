import { useCallback } from "react";
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
import { appColors } from "lib/theme/appColors";
import { alertError } from "utils/error";

const colors = {
  light: {
    background: appColors.screenLight,
    textPrimary: "#000000",
    textSecondary: "#8e8e93",
    danger: "#c62828",
    dangerPressed: "rgba(198, 40, 40, 0.12)",
    cardBg: "rgba(120, 120, 128, 0.12)",
  },
  dark: {
    background: appColors.screenDark,
    textPrimary: "#f2f2f7",
    textSecondary: "rgba(235, 235, 245, 0.55)",
    danger: "#ff6b6b",
    dangerPressed: "rgba(255, 107, 107, 0.15)",
    cardBg: "rgba(120, 120, 128, 0.24)",
  },
} as const;

export function AccountDeveloperScreen() {
  const scheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const palette = scheme === "dark" ? colors.dark : colors.light;

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

