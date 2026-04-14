import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useCallback, useLayoutEffect, useMemo, useState } from "react";
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
import {
  appColors,
  navigationChromeForScheme,
  rootScreenBackgroundForScheme,
  systemBlueForScheme,
} from "lib/theme/appColors";
import { accountsRepo, capsulesRepo } from "repositories";
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

  const [capsule, setCapsule] = useState<Capsule | null>(null);
  const [queryLoading, setQueryLoading] = useState(true);
  const [savePending, setSavePending] = useState(false);

  const loadCapsule = useCallback(async () => {
    if (!capsuleId) {
      setCapsule(null);
      setQueryLoading(false);
      return;
    }
    setQueryLoading(true);
    try {
      const active = await accountsRepo.getActive();
      if (!active?.id) {
        setCapsule(null);
        return;
      }
      const c = await capsulesRepo.getByIdForAccount(active.id, capsuleId);
      setCapsule(c);
    } catch {
      setCapsule(null);
    } finally {
      setQueryLoading(false);
    }
  }, [capsuleId]);

  useFocusEffect(
    useCallback(() => {
      void loadCapsule();
    }, [loadCapsule]),
  );

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
        setSavePending(true);
        await capsulesRepo.patch(capsuleId, {
          name: values.name.trim(),
          avatarUrl: values.avatarUrl.trim(),
          url: values.url.trim(),
          description: values.description.trim(),
        });
        router.replace({ pathname: "/capsule/[id]", params: { id: capsuleId } } as unknown as Href);
      } catch (e) {
        console.error("updateCapsule failed", e);
        Alert.alert(
          "Could not save capsule",
          e instanceof Error ? e.message : String(e),
        );
      } finally {
        setSavePending(false);
        setSubmitting(false);
      }
    },
    [capsuleId, router],
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

