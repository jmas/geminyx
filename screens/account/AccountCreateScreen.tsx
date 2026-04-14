import type { FormikHelpers } from "formik";
import { useCallback, useMemo } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  AccountForm,
  type AccountFormPalette,
  type AccountFormValues,
} from "components/account/AccountForm";
import { appColors, systemBlueForScheme } from "lib/theme/appColors";
import { accountsRepo } from "repositories";

const colors = {
  light: {
    background: appColors.screenLight,
    textPrimary: "#000000",
    textSecondary: "#3c3c43",
    separator: "rgba(60, 60, 67, 0.29)",
    fieldBg: "rgba(120, 120, 128, 0.12)",
    fieldBorder: "rgba(60, 60, 67, 0.18)",
    placeholder: "rgba(60, 60, 67, 0.45)",
    error: appColors.destructive,
  },
  dark: {
    background: appColors.screenDark,
    textPrimary: "#f2f2f7",
    textSecondary: "rgba(235, 235, 245, 0.75)",
    separator: "rgba(255, 255, 255, 0.12)",
    fieldBg: "rgba(120, 120, 128, 0.24)",
    fieldBorder: "rgba(255, 255, 255, 0.12)",
    placeholder: "rgba(235, 235, 245, 0.45)",
    error: "#ff6b6b",
  },
} as const;

export type AccountCreateScreenProps = {
  /**
   * First-run onboarding: show title, subtitle, and optional back to intro slides.
   */
  embedMode?: boolean;
  onBackToIntro?: () => void;
  /** Called after the account row is inserted (e.g. invalidate + navigate). */
  onSuccess: () => void | Promise<void>;
};

export function AccountCreateScreen({
  embedMode = false,
  onBackToIntro,
  onSuccess,
}: AccountCreateScreenProps) {
  const scheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const palette = scheme === "dark" ? colors.dark : colors.light;

  const formPalette: AccountFormPalette = useMemo(
    () => ({
      background: palette.background,
      textPrimary: palette.textPrimary,
      textSecondary: palette.textSecondary,
      separator: palette.separator,
      fieldBg: palette.fieldBg,
      fieldBorder: palette.fieldBorder,
      fieldText: palette.textPrimary,
      placeholder: palette.placeholder,
      error: palette.error,
      primaryLabel: "#ffffff",
      primaryButtonBg: systemBlueForScheme(scheme),
    }),
    [palette, scheme],
  );

  const handleSubmit = useCallback(
    async (
      values: AccountFormValues,
      { setSubmitting }: FormikHelpers<AccountFormValues>,
    ) => {
      try {
        await accountsRepo.insert({
          name: values.name,
          email: values.email.trim() || undefined,
          avatarUrl: values.avatarUrl.trim() || undefined,
          capsuleUrl: values.capsuleUrl.trim() || undefined,
          isActive: true,
        });
        await onSuccess();
      } catch (e) {
        console.error("AccountCreateScreen create failed", e);
        Alert.alert(
          "Could not create account",
          e instanceof Error ? e.message : String(e),
        );
      } finally {
        setSubmitting(false);
      }
    },
    [onSuccess],
  );

  return (
    <View
      style={[
        styles.screen,
        {
          backgroundColor: palette.background,
          paddingTop: embedMode ? insets.top : 8,
        },
      ]}
    >
      {embedMode ? (
        <View style={styles.embedHeader}>
          {onBackToIntro ? (
            <Pressable
              onPress={onBackToIntro}
              style={({ pressed }) => [
                styles.backLink,
                pressed && { opacity: 0.65 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Back to introduction"
            >
              <Text style={[styles.backLinkLabel, { color: systemBlueForScheme(scheme) }]}>
                Back
              </Text>
            </Pressable>
          ) : (
            <View style={styles.backLinkPlaceholder} />
          )}
          <Text
            style={[styles.embedTitle, { color: palette.textPrimary }]}
            accessibilityRole="header"
          >
            Create your account
          </Text>
          <Text style={[styles.embedSubtitle, { color: palette.textSecondary }]}>
            This profile is stored only on this device. You can add more accounts
            later in Settings.
          </Text>
        </View>
      ) : null}
      <AccountForm
        palette={formPalette}
        submitLabel="Create account"
        onSubmit={handleSubmit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: 16,
  },
  embedHeader: {
    marginBottom: 8,
  },
  backLink: {
    alignSelf: "flex-start",
    paddingVertical: 4,
    paddingHorizontal: 0,
    marginBottom: 8,
  },
  backLinkPlaceholder: {
    height: 28,
    marginBottom: 8,
  },
  backLinkLabel: {
    fontSize: 17,
    fontWeight: "400",
  },
  embedTitle: {
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  embedSubtitle: {
    fontSize: 15,
    lineHeight: 21,
    marginBottom: 4,
  },
});
