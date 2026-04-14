import { useDelete, useInvalidate, useList, useUpdate } from "@refinedev/core";
import type { FormikHelpers } from "formik";
import { router } from "expo-router";
import { useCallback, useMemo } from "react";
import { Alert, Pressable, StyleSheet, Text, useColorScheme, View } from "react-native";
import { AccountForm, type AccountFormPalette, type AccountFormValues } from "components/account/AccountForm";
import type { Account } from "lib/models/account";
import { RESOURCES } from "lib/refineDataProvider";
import { appColors, systemBlueForScheme } from "lib/theme/appColors";

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

export function AccountEditScreen() {
  const scheme = useColorScheme();
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

  const { result, query } = useList<Account>({
    resource: RESOURCES.accounts,
    filters: [{ field: "is_active", operator: "eq", value: true }],
    pagination: { mode: "off" },
  });
  const activeAccount = result.data?.[0];

  const { mutateAsync: updateAccount } = useUpdate<Account>({
    resource: RESOURCES.accounts,
  });

  const invalidate = useInvalidate();
  const { mutateAsync: deleteAccount, mutation: deleteMutation } = useDelete<Account>();

  const initialValues: AccountFormValues | undefined = useMemo(() => {
    if (!activeAccount) return undefined;
    return {
      name: activeAccount.name ?? "",
      email: activeAccount.email ?? "",
      avatarUrl: activeAccount.avatarUrl ?? "",
      capsuleUrl: activeAccount.capsuleUrl ?? "",
    };
  }, [activeAccount]);

  const handleDelete = useCallback(() => {
    if (!activeAccount) return;
    Alert.alert(
      "Delete account?",
      "This removes the account from this device. It does not affect any remote servers.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteAccount({
                resource: RESOURCES.accounts,
                id: activeAccount.id,
              });
              await invalidate({
                resource: RESOURCES.accounts,
                invalidates: ["list"],
              });
              await invalidate({
                resource: RESOURCES.capsules,
                invalidates: ["list"],
              });
              await invalidate({
                resource: RESOURCES.dialogs,
                invalidates: ["list"],
              });
              router.back();
            } catch (e) {
              console.error("AccountEditScreen delete failed", e);
              Alert.alert(
                "Could not delete account",
                e instanceof Error ? e.message : String(e),
              );
            }
          },
        },
      ],
    );
  }, [activeAccount, deleteAccount, invalidate]);

  const handleSubmit = useCallback(
    async (
      values: AccountFormValues,
      { setSubmitting }: FormikHelpers<AccountFormValues>,
    ) => {
      if (!activeAccount) return;
      try {
        await updateAccount({
          id: activeAccount.id,
          values: {
            name: values.name.trim(),
            email: values.email.trim() || null,
            avatarUrl: values.avatarUrl.trim() || null,
            capsuleUrl: values.capsuleUrl.trim() || null,
          },
        });
        await query.refetch();
        router.back();
      } catch (e) {
        console.error("AccountEditScreen update failed", e);
        Alert.alert(
          "Could not save account",
          e instanceof Error ? e.message : String(e),
        );
      } finally {
        setSubmitting(false);
      }
    },
    [activeAccount, query, updateAccount],
  );

  if (query.isLoading || query.isFetching) {
    return (
      <View style={[styles.screen, { backgroundColor: palette.background }]}>
        <Text style={[styles.loadingText, { color: palette.textSecondary }]}>
          Loading…
        </Text>
      </View>
    );
  }

  if (!activeAccount || !initialValues) {
    return (
      <View style={[styles.screen, { backgroundColor: palette.background }]}>
        <Text style={[styles.loadingText, { color: palette.textSecondary }]}>
          No active account to edit.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      <AccountForm
        palette={formPalette}
        initialValues={initialValues}
        footerExtra={
          <Pressable
            onPress={handleDelete}
            disabled={deleteMutation.isPending}
            style={({ pressed }) => [
              styles.deleteBtn,
              {
                borderColor: palette.error,
                opacity: deleteMutation.isPending ? 0.6 : 1,
              },
              pressed && !deleteMutation.isPending
                ? {
                    backgroundColor:
                      scheme === "dark"
                        ? "rgba(255, 107, 107, 0.15)"
                        : "rgba(255, 59, 48, 0.12)",
                  }
                : null,
            ]}
          >
            <Text style={[styles.deleteLabel, { color: palette.error }]}>
              Delete account
            </Text>
          </Pressable>
        }
        submitLabel="Save changes"
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
  deleteBtn: {
    alignSelf: "stretch",
    minHeight: 44,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  deleteLabel: {
    fontSize: 17,
    fontWeight: "600",
  },
});

