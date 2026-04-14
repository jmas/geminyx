import { HeaderButton } from "@react-navigation/elements";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useCallback, useLayoutEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
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
import { queryKeys } from "lib/queryKeys";
import {
  destructiveTintColor,
  headerTitleColorForScheme,
  rootScreenBackgroundForScheme,
} from "lib/theme/appColors";
import { categoriesRepo, capsulesRepo } from "repositories";
import { alertError } from "utils/error";
import { firstParam } from "utils/searchParams";

const CAPSULE_EDIT_BACK_CHEVRON_SIZE = 26;
const CAPSULE_EDIT_DELETE_ICON_SIZE = 22;

export function CapsuleEditScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const router = useRouter();
  const scheme = useColorScheme();
  const palette: CapsuleFormModalPalette = selectCapsuleUiPalette(scheme);
  const bg = rootScreenBackgroundForScheme(scheme);
  const titleColor = headerTitleColorForScheme(scheme);

  const params = useLocalSearchParams<{ id: string }>();
  const capsuleId = firstParam(params.id) ?? "";

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
    enabled: Boolean(capsuleId) && !activePending && Boolean(activeAccount?.id),
  });

  const categoryOptions = useMemo(
    () => [
      ...categories.map((c) => ({ id: c.id, name: c.name })),
      { id: "", name: t("capsules.sectionGeneral") },
    ],
    [categories, t],
  );

  const {
    data: capsule,
    isLoading: queryLoading,
    refetch: refetchCapsule,
  } = useQuery({
    queryKey: [...queryKeys.capsules.detail(capsuleId), activeAccount?.id ?? "none"],
    queryFn: async () => {
      if (!activeAccount?.id) return null;
      try {
        return await capsulesRepo.getByIdForAccount(activeAccount.id, capsuleId);
      } catch {
        return null;
      }
    },
    enabled: Boolean(capsuleId) && !activePending,
  });

  useFocusEffect(
    useCallback(() => {
      if (capsuleId) void refetchCapsule();
    }, [capsuleId, refetchCapsule]),
  );

  const deleteMutation = useMutation({
    mutationFn: (id: string) => capsulesRepo.deleteCascade(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.capsules.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.threads.all });
      router.replace("/(tabs)/threads" as Href);
    },
    onError: (e) => {
      console.error("CapsuleEditScreen delete failed", e);
      Alert.alert(
        t("capsules.deleteErrorTitle"),
        t("capsules.deleteErrorBody"),
      );
    },
  });

  const handleDeletePress = useCallback(() => {
    if (!capsule) return;
    Alert.alert(
      t("capsules.deleteCapsuleTitle"),
      t("capsules.deleteCapsuleMsg", { name: capsule.name }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: () => {
            void deleteMutation.mutateAsync(capsule.id);
          },
        },
      ],
    );
  }, [capsule, deleteMutation, t]);

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
            size={CAPSULE_EDIT_BACK_CHEVRON_SIZE}
            color={titleColor}
            style={
              Platform.OS === "ios"
                ? { lineHeight: CAPSULE_EDIT_BACK_CHEVRON_SIZE }
                : undefined
            }
          />
        </HeaderButton>
      ),
      ...(capsule
        ? {
            headerRightContainerStyle: { paddingRight: 8 },
            headerRight: () => (
              <HeaderButton
                onPress={handleDeletePress}
                disabled={deleteMutation.isPending}
                accessibilityLabel={t("capsules.a11yDeleteCapsule")}
              >
                <Ionicons
                  name="trash-outline"
                  size={CAPSULE_EDIT_DELETE_ICON_SIZE}
                  color={destructiveTintColor()}
                  style={
                    Platform.OS === "ios"
                      ? { lineHeight: CAPSULE_EDIT_DELETE_ICON_SIZE }
                      : undefined
                  }
                />
              </HeaderButton>
            ),
          }
        : {
            headerRight: undefined,
            headerRightContainerStyle: undefined,
          }),
    });
  }, [
    capsule,
    deleteMutation.isPending,
    handleDeletePress,
    navigation,
    router,
    titleColor,
    t,
  ]);

  const initialValues: CapsuleFormValues = useMemo(
    () => ({
      name: capsule?.name ?? "",
      avatarIcon: capsule?.avatarIcon ?? "",
      url: capsule?.url ?? "",
      description: capsule?.description ?? "",
      categoryId: capsule?.categoryId ?? "",
    }),
    [capsule],
  );

  const onCancel = useCallback(() => {
    router.back();
  }, [router]);

  const handleSubmit = useCallback(
    async (
      values: CapsuleFormValues,
      { setSubmitting }: FormikHelpers<CapsuleFormValues>,
    ) => {
      try {
        setSavePending(true);
        await capsulesRepo.patch(capsuleId, {
          name: values.name.trim(),
          avatarIcon: values.avatarIcon.trim(),
          url: values.url.trim(),
          description: values.description.trim(),
          categoryId: values.categoryId.trim() || null,
          ...(capsule?.libraryVisible === false
            ? { libraryVisible: true }
            : {}),
        });
        await queryClient.invalidateQueries({
          queryKey: queryKeys.capsules.detail(capsuleId),
        });
        await queryClient.invalidateQueries({
          queryKey: queryKeys.capsules.listForActive(),
        });
        await queryClient.invalidateQueries({
          queryKey: queryKeys.threads.all,
        });
        router.replace({ pathname: "/capsule/[id]", params: { id: capsuleId } } as unknown as Href);
      } catch (e) {
        console.error("updateCapsule failed", e);
        alertError(e, t("capsuleEdit.saveError"), t("capsuleEdit.saveError"));
      } finally {
        setSavePending(false);
        setSubmitting(false);
      }
    },
    [capsule?.libraryVisible, capsuleId, queryClient, router, t],
  );

  if (!capsuleId) {
    return (
      <View style={[styles.centered, { backgroundColor: bg }]}>
        <Text style={{ color: palette.textSecondary }}>
          {t("capsuleEdit.missingId")}
        </Text>
      </View>
    );
  }

  if (queryLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: bg }]}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!capsule) {
    return (
      <View style={[styles.centered, { backgroundColor: bg }]}>
        <Text style={{ color: titleColor }}>{t("capsuleEdit.notFound")}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      <CapsuleForm
        palette={palette}
        scheme={scheme}
        isPending={savePending}
        initialValues={initialValues}
        submitLabel={t("common.save")}
        autoNameFromUrl={false}
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

