import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import type { FormikHelpers } from "formik";
import { router } from "expo-router";
import { useCallback, useLayoutEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Platform,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";
import { HeaderButton } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { accountFormPaletteForScheme } from "components/account/accountFormPalette";
import { AccountForm, type AccountFormValues } from "components/account/AccountForm";
import { useAccountActive } from "hooks/account/useAccountActive";
import { destructiveTintColor } from "lib/theme/appColors";
import { queryKeys } from "lib/queryKeys";
import { accountsRepo } from "repositories";
import { alertError } from "utils/error";

const ACCOUNT_EDIT_DELETE_ICON_SIZE = 22;

export function AccountEditScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const scheme = useColorScheme();

  const formPalette = useMemo(
    () => accountFormPaletteForScheme(scheme),
    [scheme],
  );

  const queryClient = useQueryClient();
  const {
    data: activeAccount,
    isLoading: isLoadingAccount,
    isError: isLoadError,
    error: loadError,
  } = useAccountActive();

  const deleteMutation = useMutation({
    mutationFn: (id: string) => accountsRepo.deleteById(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all });
      router.back();
    },
    onError: (e) => {
      console.error("AccountEditScreen delete failed", e);
      alertError(e, t("accountEdit.errorDelete"), t("accountEdit.errorDelete"));
    },
  });

  const initialValues: AccountFormValues | undefined = useMemo(() => {
    if (!activeAccount) return undefined;
    return {
      name: activeAccount.name ?? "",
      email: activeAccount.email ?? "",
      capsuleUrl: activeAccount.capsuleUrl ?? "",
    };
  }, [activeAccount]);

  const handleDelete = useCallback(() => {
    if (!activeAccount) return;
    Alert.alert(
      t("accountEdit.deleteTitle"),
      t("accountEdit.deleteMsg"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: () => {
            void deleteMutation.mutateAsync(activeAccount.id);
          },
        },
      ],
    );
  }, [activeAccount, deleteMutation, t]);

  useLayoutEffect(() => {
    if (!activeAccount) {
      navigation.setOptions({
        headerRight: undefined,
        headerRightContainerStyle: undefined,
      });
      return;
    }
    navigation.setOptions({
      headerRightContainerStyle: { paddingRight: 8 },
      headerRight: () => (
        <HeaderButton
          onPress={handleDelete}
          disabled={deleteMutation.isPending}
          accessibilityLabel={t("accountEdit.deleteA11y")}
        >
          <Ionicons
            name="trash-outline"
            size={ACCOUNT_EDIT_DELETE_ICON_SIZE}
            color={destructiveTintColor()}
            style={
              Platform.OS === "ios"
                ? { lineHeight: ACCOUNT_EDIT_DELETE_ICON_SIZE }
                : undefined
            }
          />
        </HeaderButton>
      ),
    });
  }, [activeAccount, deleteMutation.isPending, handleDelete, navigation, t]);

  const handleSubmit = useCallback(
    async (
      values: AccountFormValues,
      { setSubmitting }: FormikHelpers<AccountFormValues>,
    ) => {
      if (!activeAccount) return;
      try {
        await accountsRepo.patch(activeAccount.id, {
          name: values.name.trim(),
          email: values.email.trim() || undefined,
          capsuleUrl: values.capsuleUrl.trim() || undefined,
        });
        router.back();
      } catch (e) {
        console.error("AccountEditScreen update failed", e);
        alertError(e, t("accountEdit.errorSave"), t("accountEdit.errorSave"));
      } finally {
        setSubmitting(false);
      }
    },
    [activeAccount, t],
  );

  if (isLoadingAccount) {
    return (
      <View style={[styles.screen, { backgroundColor: formPalette.background }]}>
        <Text style={[styles.loadingText, { color: formPalette.textSecondary }]}>
          {t("accountEdit.loading")}
        </Text>
      </View>
    );
  }

  if (isLoadError) {
    return (
      <View style={[styles.screen, { backgroundColor: formPalette.background }]}>
        <Text style={[styles.loadingText, { color: formPalette.error }]}>
          {loadError instanceof Error
            ? loadError.message
            : t("accountEdit.loadError")}
        </Text>
      </View>
    );
  }

  if (!activeAccount || !initialValues) {
    return (
      <View style={[styles.screen, { backgroundColor: formPalette.background }]}>
        <Text style={[styles.loadingText, { color: formPalette.textSecondary }]}>
          {t("accountEdit.noAccount")}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: formPalette.background }]}>
      <AccountForm
        palette={formPalette}
        initialValues={initialValues}
        submitLabel={t("accountEdit.submit")}
        onSubmit={handleSubmit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  loadingText: {
    fontSize: 15,
    paddingHorizontal: 4,
    paddingTop: 8,
  },
});

