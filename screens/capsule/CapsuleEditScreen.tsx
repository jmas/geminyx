import { useInvalidate, useOne, useUpdate } from "@refinedev/core";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useCallback, useLayoutEffect, useMemo } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";
import type { FormikHelpers } from "formik";
import { useNavigation } from "@react-navigation/native";
import {
  CapsuleForm,
  type CapsuleFormModalPalette,
  type CapsuleFormValues,
} from "components/capsule/CapsuleForm";
import { selectCapsuleUiPalette } from "components/capsule/capsuleUiPalette";
import type { Capsule } from "lib/models/capsule";
import { RESOURCES } from "lib/refineDataProvider";
import {
  appColors,
  navigationChromeForScheme,
  rootScreenBackgroundForScheme,
  systemBlueForScheme,
} from "lib/theme/appColors";
import { firstParam } from "utils/searchParams";

export function CapsuleEditScreen() {
  const navigation = useNavigation();
  const router = useRouter();
  const scheme = useColorScheme();
  const palette: CapsuleFormModalPalette = selectCapsuleUiPalette(scheme);
  const bg = rootScreenBackgroundForScheme(scheme);
  const tint = systemBlueForScheme(scheme);
  const titleColor =
    scheme === "dark" ? appColors.headerTitleDark : appColors.headerTitleLight;

  const params = useLocalSearchParams<{ id: string }>();
  const capsuleId = firstParam(params.id) ?? "";

  const invalidate = useInvalidate();
  const { mutateAsync: updateCapsule, mutation: updateMutation } = useUpdate({
    resource: RESOURCES.capsules,
    mutationOptions: {
      onSuccess: async () => {
        await invalidate({ resource: RESOURCES.capsules, invalidates: ["list"] });
        await invalidate({ resource: RESOURCES.dialogs, invalidates: ["list"] });
      },
    },
  });

  const { result: capsule, query } = useOne<Capsule>({
    resource: RESOURCES.capsules,
    id: capsuleId,
    queryOptions: { enabled: !!capsuleId },
  });

  useLayoutEffect(() => {
    navigation.setOptions({
      ...navigationChromeForScheme(scheme),
      title: "Edit Capsule",
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
  }, [navigation, router, scheme, tint]);

  const initialValues: CapsuleFormValues = useMemo(
    () => ({
      name: capsule?.name ?? "",
      avatarUrl: capsule?.avatarUrl ?? "",
      url: capsule?.url ?? "",
      description: capsule?.description ?? "",
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
        await updateCapsule({
          id: capsuleId,
          values: {
            name: values.name.trim(),
            avatarUrl: values.avatarUrl.trim(),
            url: values.url.trim(),
            description: values.description.trim(),
          },
        });
        router.replace({ pathname: "/capsule/[id]", params: { id: capsuleId } } as unknown as Href);
      } catch (e) {
        console.error("updateCapsule failed", e);
        Alert.alert(
          "Could not save capsule",
          e instanceof Error ? e.message : String(e),
        );
      } finally {
        setSubmitting(false);
      }
    },
    [capsuleId, router, updateCapsule],
  );

  if (!capsuleId) {
    return (
      <View style={[styles.centered, { backgroundColor: bg }]}>
        <Text style={{ color: palette.textSecondary }}>Missing capsule id.</Text>
      </View>
    );
  }

  if (query.isLoading || query.isFetching) {
    return (
      <View style={[styles.centered, { backgroundColor: bg }]}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!capsule || query.isError) {
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
        isPending={updateMutation.isPending}
        initialValues={initialValues}
        submitLabel="Save"
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

