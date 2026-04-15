import { HeaderButton } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useCallback, useLayoutEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Platform,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";
import type { FormikHelpers } from "formik";
import {
  CapsuleForm,
  type CapsuleFormModalPalette,
  type CapsuleFormValues,
} from "components/capsule/CapsuleForm";
import { selectCapsuleUiPalette } from "components/capsule/capsuleUiPalette";
import { useAccountActive } from "hooks/account/useAccountActive";
import { normalizeGeminiCapsuleRootUrl, suggestedCapsuleNameFromGeminiUrl } from "lib/models/gemini";
import { queryKeys } from "lib/queryKeys";
import {
  headerTitleColorForScheme,
  rootScreenBackgroundForScheme,
} from "lib/theme/appColors";
import { categoriesRepo, capsulesRepo } from "repositories";
import { alertError } from "utils/error";
import { firstParam } from "utils/searchParams";

const CAPSULE_CREATE_BACK_CHEVRON_SIZE = 26;

export function CapsuleCreateScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const router = useRouter();
  const scheme = useColorScheme();
  const palette: CapsuleFormModalPalette = selectCapsuleUiPalette(scheme);
  const bg = rootScreenBackgroundForScheme(scheme);
  const titleColor = headerTitleColorForScheme(scheme);

  const params = useLocalSearchParams<{ url?: string; name?: string }>();
  const urlParam = firstParam(params.url)?.trim() ?? "";
  const nameParam = firstParam(params.name)?.trim();

  const [savePending, setSavePending] = useState(false);
  const queryClient = useQueryClient();
  const { data: activeAccount, isPending: activePending } = useAccountActive();

  const {
    data: categories = [],
    isPending: categoriesPending,
  } = useQuery({
    queryKey: [
      ...queryKeys.categories.listForActive(),
      activeAccount?.id ?? "none",
    ],
    queryFn: async () => {
      if (!activeAccount?.id) return [];
      return categoriesRepo.listOrdered(activeAccount.id);
    },
    enabled: Boolean(activeAccount?.id) && !activePending,
  });

  const categoryOptions = useMemo(
    () => [
      ...categories.map((c) => ({ id: c.id, name: c.name })),
      { id: "", name: t("capsules.sectionGeneral") },
    ],
    [categories, t],
  );

  const insertMutation = useMutation({
    mutationFn: (input: Parameters<typeof capsulesRepo.insertCapsuleOnly>[0]) =>
      capsulesRepo.insertCapsuleOnly(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.capsules.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.threads.all });
    },
  });

  const initialValues: CapsuleFormValues = useMemo(() => {
    const name =
      nameParam && nameParam.length > 0
        ? nameParam
        : urlParam
          ? suggestedCapsuleNameFromGeminiUrl(urlParam)
          : "";
    return {
      name,
      avatarIcon: "",
      url: urlParam,
      description: "",
      categoryId: "",
    };
  }, [nameParam, urlParam]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeftContainerStyle: { paddingLeft: 8 },
      headerLeft: () => (
        <HeaderButton
          onPress={() => router.back()}
          accessibilityLabel={t("common.back")}
        >
          <Ionicons
            name="chevron-back"
            size={CAPSULE_CREATE_BACK_CHEVRON_SIZE}
            color={titleColor}
            style={
              Platform.OS === "ios"
                ? { lineHeight: CAPSULE_CREATE_BACK_CHEVRON_SIZE }
                : undefined
            }
          />
        </HeaderButton>
      ),
    });
  }, [navigation, router, titleColor, t]);

  const onCancel = useCallback(() => {
    router.back();
  }, [router]);

  const handleSubmit = useCallback(
    async (
      values: CapsuleFormValues,
      { setSubmitting }: FormikHelpers<CapsuleFormValues>,
    ) => {
      if (!activeAccount?.id) {
        setSubmitting(false);
        return;
      }
      try {
        setSavePending(true);
        const finalName = values.name.trim() || t("capsules.defaultNewCapsuleName");
        const trimmedUrl = values.url.trim();
        const normalized =
          trimmedUrl.length > 0
            ? normalizeGeminiCapsuleRootUrl(trimmedUrl) || trimmedUrl
            : "";
        if (normalized.length > 0) {
          const existing = await capsulesRepo.findByGeminiOriginForAccount(
            activeAccount.id,
            normalized,
          );
          if (existing) {
            await capsulesRepo.patch(existing.id, {
              name: finalName,
              avatarIcon: values.avatarIcon.trim(),
              url: normalized,
              description: values.description.trim(),
              categoryId: values.categoryId.trim() || null,
              libraryVisible: true,
            });
            await queryClient.invalidateQueries({
              queryKey: queryKeys.capsules.detail(existing.id),
            });
            await queryClient.invalidateQueries({
              queryKey: queryKeys.capsules.listForActive(),
            });
            await queryClient.invalidateQueries({
              queryKey: queryKeys.threads.all,
            });
            router.replace({
              pathname: "/capsule/[id]",
              params: { id: existing.id },
            } as unknown as Href);
            return;
          }
        }
        const created = await insertMutation.mutateAsync({
          accountId: activeAccount.id,
          name: finalName,
          avatarIcon: values.avatarIcon.trim() || undefined,
          url: normalized || undefined,
          description: values.description.trim() || undefined,
          categoryId: values.categoryId.trim() || undefined,
          libraryVisible: true,
        });
        router.replace({
          pathname: "/capsule/[id]",
          params: { id: created.id },
        } as unknown as Href);
      } catch (e) {
        console.error("CapsuleCreateScreen insert failed", e);
        alertError(e, t("capsules.addCapsuleError"), t("capsules.addCapsuleError"));
      } finally {
        setSavePending(false);
        setSubmitting(false);
      }
    },
    [activeAccount?.id, insertMutation, queryClient, router, t],
  );

  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      <CapsuleForm
        palette={palette}
        scheme={scheme}
        isPending={savePending || insertMutation.isPending}
        initialValues={initialValues}
        autoNameFromUrl
        categoryOptions={categoryOptions}
        categoryOptionsLoading={categoriesPending}
        onCancel={onCancel}
        onSubmit={handleSubmit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
