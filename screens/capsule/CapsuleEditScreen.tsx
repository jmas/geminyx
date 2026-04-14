import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useCallback, useLayoutEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
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
  headerTitleColorForScheme,
  rootScreenBackgroundForScheme,
  systemBlueForScheme,
} from "lib/theme/appColors";
import { categoriesRepo, capsulesRepo } from "repositories";
import { alertError } from "utils/error";
import { firstParam } from "utils/searchParams";

export function CapsuleEditScreen() {
  const navigation = useNavigation();
  const router = useRouter();
  const scheme = useColorScheme();
  const palette: CapsuleFormModalPalette = selectCapsuleUiPalette(scheme);
  const bg = rootScreenBackgroundForScheme(scheme);
  const tint = systemBlueForScheme(scheme);
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
      { id: "", name: "General" },
      ...categories.map((c) => ({ id: c.id, name: c.name })),
    ],
    [categories],
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

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={({ pressed }) => [pressed && { opacity: 0.55 }]}
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={26} color={tint} />
        </Pressable>
      ),
    });
  }, [navigation, router, tint]);

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
        });
        await queryClient.invalidateQueries({
          queryKey: queryKeys.capsules.detail(capsuleId),
        });
        await queryClient.invalidateQueries({
          queryKey: queryKeys.capsules.listForActive(),
        });
        router.replace({ pathname: "/capsule/[id]", params: { id: capsuleId } } as unknown as Href);
      } catch (e) {
        console.error("updateCapsule failed", e);
        alertError(e, "Could not save capsule.", "Could not save capsule");
      } finally {
        setSavePending(false);
        setSubmitting(false);
      }
    },
    [capsuleId, queryClient, router],
  );

  if (!capsuleId) {
    return (
      <View style={[styles.centered, { backgroundColor: bg }]}>
        <Text style={{ color: palette.textSecondary }}>Missing capsule id.</Text>
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
        <Text style={{ color: titleColor }}>Capsule not found.</Text>
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
        submitLabel="Save"
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

