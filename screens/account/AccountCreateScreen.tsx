import type { FormikHelpers } from "formik";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { accountFormPaletteForScheme } from "components/account/accountFormPalette";
import {
  AccountForm,
  type AccountFormValues,
} from "components/account/AccountForm";
import { systemBlueForScheme } from "lib/theme/appColors";
import { accountsRepo } from "repositories";
import { alertError } from "utils/error";

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
  const { t } = useTranslation();
  const scheme = useColorScheme();
  const insets = useSafeAreaInsets();

  const formPalette = useMemo(
    () => accountFormPaletteForScheme(scheme),
    [scheme],
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
          capsuleUrl: values.capsuleUrl.trim() || undefined,
          isActive: true,
        });
        await onSuccess();
      } catch (e) {
        console.error("AccountCreateScreen create failed", e);
        alertError(e, t("accountCreate.errorCreate"), t("accountCreate.errorCreate"));
      } finally {
        setSubmitting(false);
      }
    },
    [onSuccess, t],
  );

  return (
    <View
      style={[
        styles.screen,
        {
          backgroundColor: formPalette.background,
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
              accessibilityLabel={t("accountCreate.backToIntro")}
            >
              <Text style={[styles.backLinkLabel, { color: systemBlueForScheme(scheme) }]}>
                {t("common.back")}
              </Text>
            </Pressable>
          ) : (
            <View style={styles.backLinkPlaceholder} />
          )}
          <Text
            style={[styles.embedTitle, { color: formPalette.textPrimary }]}
            accessibilityRole="header"
          >
            {t("accountCreate.embedTitle")}
          </Text>
          <Text style={[styles.embedSubtitle, { color: formPalette.textSecondary }]}>
            {t("accountCreate.embedSubtitle")}
          </Text>
        </View>
      ) : null}
      <AccountForm
        palette={formPalette}
        submitLabel={t("accountCreate.submit")}
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
