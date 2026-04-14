import { useDelete, useInvalidate, useOne } from "@refinedev/core";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useCallback, useLayoutEffect, useMemo } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CapsuleAvatar } from "components/capsule/CapsuleAvatar";
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

export function CapsuleViewScreen() {
  const navigation = useNavigation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const palette = selectCapsuleUiPalette(scheme);
  const bg = rootScreenBackgroundForScheme(scheme);
  const tint = systemBlueForScheme(scheme);
  const titleColor =
    scheme === "dark" ? appColors.headerTitleDark : appColors.headerTitleLight;

  const params = useLocalSearchParams<{ id: string }>();
  const capsuleId = firstParam(params.id) ?? "";

  const invalidate = useInvalidate();
  const { mutateAsync: removeCapsule } = useDelete();

  const { result: capsule, query } = useOne<Capsule>({
    resource: RESOURCES.capsules,
    id: capsuleId,
    queryOptions: { enabled: !!capsuleId },
  });

  const loading = query.isLoading || query.isFetching;
  const notFound = !loading && (!capsule || query.isError);

  useLayoutEffect(() => {
    navigation.setOptions({
      ...navigationChromeForScheme(scheme),
      title: "Capsule",
    });
  }, [navigation, scheme]);

  const refreshLists = useCallback(async () => {
    await invalidate({ resource: RESOURCES.capsules, invalidates: ["list"] });
    await invalidate({ resource: RESOURCES.dialogs, invalidates: ["list"] });
  }, [invalidate]);

  const onOpenDialog = useCallback(() => {
    if (!capsule) return;
    router.push({
      pathname: "/dialog/[id]",
      params: { id: capsule.id, name: capsule.name },
    } as unknown as Href);
  }, [capsule, router]);

  const onDelete = useCallback(() => {
    if (!capsule) return;
    Alert.alert(
      "Delete capsule?",
      `Delete “${capsule.name}” and all messages? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void (async () => {
              try {
                await removeCapsule({
                  resource: RESOURCES.capsules,
                  id: capsule.id,
                });
                await refreshLists();
                router.replace("/(tabs)/dialogs" as Href);
              } catch (e) {
                console.error(e);
                Alert.alert("Could not delete", "Please try again.");
              }
            })();
          },
        },
      ],
    );
  }, [capsule, refreshLists, removeCapsule, router]);

  const onEdit = useCallback(() => {
    if (!capsule) return;
    router.push({
      pathname: "/capsule/edit/[id]",
      params: { id: capsule.id },
    } as unknown as Href);
  }, [capsule, router]);

  const description = useMemo(
    () => capsule?.description?.trim() ?? "",
    [capsule?.description],
  );

  const bottomPad = Math.max(insets.bottom, 24);

  if (!capsuleId) {
    return (
      <View style={[styles.centered, { backgroundColor: bg }]}>
        <Text style={{ color: palette.textPrimary }}>Missing capsule id.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: bg }]}>
        <ActivityIndicator />
      </View>
    );
  }

  if (notFound || !capsule) {
    return (
      <View style={[styles.centered, { backgroundColor: bg }]}>
        <Text style={{ color: palette.textPrimary }}>Capsule not found.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: bg }]}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: bottomPad, paddingTop: 24 },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.hero}>
        <CapsuleAvatar
          capsuleId={capsule.id}
          name={capsule.name}
          uri={capsule.avatarUrl}
          size={112}
        />
        <Text style={[styles.name, { color: titleColor }]}>{capsule.name}</Text>
        {description ? (
          <Text
            style={[styles.description, { color: palette.textSecondary }]}
          >
            {description}
          </Text>
        ) : null}
      </View>

      <Pressable
        onPress={onOpenDialog}
        style={({ pressed }) => [
          styles.primaryBtn,
          {
            backgroundColor: scheme === "dark" ? "#5eb5f7" : "#3390ec",
            opacity: pressed ? 0.88 : 1,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Open dialog"
      >
        <Ionicons name="chatbubbles-outline" size={22} color="#ffffff" />
        <Text style={styles.primaryBtnLabel}>Dialog</Text>
      </Pressable>

      <Pressable
        onPress={onEdit}
        style={({ pressed }) => [
          styles.editBtn,
          {
            borderColor: scheme === "dark" ? "rgba(94, 181, 247, 0.65)" : "rgba(51, 144, 236, 0.65)",
            opacity: pressed ? 0.75 : 1,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Edit capsule"
      >
        <Text style={[styles.editBtnLabel, { color: tint }]}>Edit</Text>
      </Pressable>

      <Pressable
        onPress={onDelete}
        style={({ pressed }) => [
          styles.deleteBtn,
          {
            borderColor: "rgba(255, 59, 48, 0.55)",
            opacity: pressed ? 0.75 : 1,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Delete capsule"
      >
        <Text style={styles.deleteBtnLabel}>Delete</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    paddingHorizontal: 24,
  },
  hero: {
    alignItems: "center",
    marginBottom: 32,
  },
  name: {
    marginTop: 16,
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
  },
  description: {
    marginTop: 10,
    fontSize: 16,
    lineHeight: 22,
    textAlign: "center",
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    paddingVertical: 14,
    minHeight: 48,
    gap: 10,
  },
  primaryBtnLabel: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "600",
  },
  deleteBtn: {
    marginTop: 14,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    paddingVertical: 14,
    minHeight: 48,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  deleteBtnLabel: {
    color: "#ff3b30",
    fontSize: 17,
    fontWeight: "600",
  },
  editBtn: {
    marginTop: 14,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    paddingVertical: 14,
    minHeight: 48,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  editBtnLabel: {
    fontSize: 17,
    fontWeight: "600",
  },
});
