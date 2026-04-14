import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CapsuleAvatar } from "components/capsule/CapsuleAvatar";
import { selectCapsuleUiPalette } from "components/capsule/capsuleUiPalette";
import { useAccountActive } from "hooks/account/useAccountActive";
import { queryKeys } from "lib/queryKeys";
import {
  destructiveTintColor,
  headerTitleColorForScheme,
  rootScreenBackgroundForScheme,
  systemBlueForScheme,
} from "lib/theme/appColors";
import { capsulesRepo } from "repositories";
import { firstParam } from "utils/searchParams";

export function CapsuleViewScreen() {
  const navigation = useNavigation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const palette = selectCapsuleUiPalette(scheme);
  const bg = rootScreenBackgroundForScheme(scheme);
  const tint = systemBlueForScheme(scheme);
  const titleColor = headerTitleColorForScheme(scheme);
  const destructive = destructiveTintColor();

  const params = useLocalSearchParams<{ id: string }>();
  const capsuleId = firstParam(params.id) ?? "";

  const queryClient = useQueryClient();
  const { data: activeAccount, isPending: activePending } = useAccountActive();

  const {
    data: capsule,
    isLoading: loading,
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

  const notFound = !loading && !capsule;

  useLayoutEffect(() => {
    navigation.setOptions({
      title: "Capsule",
    });
  }, [navigation]);

  const onOpenThread = useCallback(() => {
    if (!capsule) return;
    router.push({
      pathname: "/thread/[id]",
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
                await capsulesRepo.deleteCascade(capsule.id);
                await queryClient.invalidateQueries({
                  queryKey: queryKeys.capsules.all,
                });
                await queryClient.invalidateQueries({
                  queryKey: queryKeys.threads.all,
                });
                router.replace("/(tabs)/threads" as Href);
              } catch (e) {
                console.error(e);
                Alert.alert("Could not delete", "Please try again.");
              }
            })();
          },
        },
      ],
    );
  }, [capsule, queryClient, router]);

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
          emoji={capsule.avatarIcon}
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
        onPress={onOpenThread}
        style={({ pressed }) => [
          styles.primaryBtn,
          {
            backgroundColor: tint,
            opacity: pressed ? 0.88 : 1,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Open thread"
      >
        <Ionicons name="chatbubbles-outline" size={22} color="#ffffff" />
        <Text style={styles.primaryBtnLabel}>Thread</Text>
      </Pressable>

      <Pressable
        onPress={onEdit}
        style={({ pressed }) => [
          styles.editBtn,
          {
            borderColor: tint,
            opacity: pressed ? 0.75 : 1,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Edit capsule"
      >
        <Ionicons name="create-outline" size={22} color={tint} />
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
        <Ionicons name="trash-outline" size={22} color={destructive} />
        <Text style={[styles.deleteBtnLabel, { color: destructive }]}>Delete</Text>
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    paddingVertical: 14,
    minHeight: 48,
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  deleteBtnLabel: {
    fontSize: 17,
    fontWeight: "600",
  },
  editBtn: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    paddingVertical: 14,
    minHeight: 48,
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  editBtnLabel: {
    fontSize: 17,
    fontWeight: "600",
  },
});
