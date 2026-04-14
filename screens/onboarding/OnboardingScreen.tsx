import { Ionicons } from "@expo/vector-icons";
import type { FormikHelpers } from "formik";
import { useCallback, useMemo, useRef, useState } from "react";
import type { ComponentProps } from "react";
import {
  Alert,
  Dimensions,
  FlatList,
  Image,
  type ImageSourcePropType,
  type ListRenderItem,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  AccountForm,
  type AccountFormPalette,
  type AccountFormValues,
} from "components/account/AccountForm";
import { accountsRepo } from "repositories";
import { appColors, systemBlueForScheme } from "lib/theme/appColors";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

/** Footer row height (excluding bottom safe-area padding). */
const FOOTER_ROW_HEIGHT = 88;

type IonIconName = ComponentProps<typeof Ionicons>["name"];

type IntroSlide = {
  key: string;
  title: string;
  body: string;
  /** Optional raster art (e.g. `require("@/assets/onboarding/welcome.png")`). */
  image?: ImageSourcePropType;
  /** Shown when `image` is omitted. */
  illustration: IonIconName;
};

const INTRO_SLIDES: IntroSlide[] = [
  {
    key: "welcome",
    title: "Welcome to Geminyx",
    body: "Geminyx is a messenger-like browser for the small web, built around Gemini Protocol capsules and lightweight pages.",
    illustration: "planet-outline",
  },
  {
    key: "capsules",
    title: "Capsules",
    body: "Capsules are like tiny websites. Follow links to open another page in the same capsule—each page appears as a message in your thread.",
    illustration: "cube-outline",
  },
  {
    key: "dialogs",
    title: "Dialogs",
    body: "A dialog is your history with one capsule: a single conversation thread where everything you have exchanged stays in order.",
    illustration: "chatbubbles-outline",
  },
  {
    key: "accounts",
    title: "Accounts",
    body: "Accounts live on your device. You can have more than one; capsules and dialogs belong to the active account. Export or import everything as one file to move to another device.",
    illustration: "shield-checkmark-outline",
  },
];

export type OnboardingScreenProps = {
  onAccountCreated: () => void;
};

export function OnboardingScreen({ onAccountCreated }: OnboardingScreenProps) {
  const scheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList<SlideItem>>(null);
  const [index, setIndex] = useState(0);
  const totalSlides = INTRO_SLIDES.length + 1;

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

  const onMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = e.nativeEvent.contentOffset.x;
      const i = Math.round(x / SCREEN_WIDTH);
      setIndex(Math.min(Math.max(i, 0), totalSlides - 1));
    },
    [totalSlides],
  );

  const goNext = useCallback(() => {
    if (index < totalSlides - 1) {
      flatListRef.current?.scrollToIndex({
        index: index + 1,
        animated: true,
      });
    }
  }, [index, totalSlides]);

  const goBack = useCallback(() => {
    if (index > 0) {
      flatListRef.current?.scrollToIndex({
        index: index - 1,
        animated: true,
      });
    }
  }, [index]);

  const handleCreateAccount = useCallback(
    async (
      values: AccountFormValues,
      { setSubmitting }: FormikHelpers<AccountFormValues>,
    ) => {
      try {
        await accountsRepo.createFirstFromOnboarding({
          name: values.name,
          email: values.email.trim() || undefined,
          avatarUrl: values.avatarUrl.trim() || undefined,
          capsuleUrl: values.capsuleUrl.trim() || undefined,
        });
        onAccountCreated();
      } catch (e) {
        console.error("createFirstAccountFromOnboarding failed", e);
        Alert.alert(
          "Could not create account",
          e instanceof Error ? e.message : String(e),
        );
      } finally {
        setSubmitting(false);
      }
    },
    [onAccountCreated],
  );

  const illustrationTint = systemBlueForScheme(scheme);

  const renderItem: ListRenderItem<SlideItem> = useCallback(
    ({ item }) => {
      if (item.type === "intro") {
        return (
          <View style={[styles.slide, { width: SCREEN_WIDTH }]}>
            <View style={styles.introColumn}>
              <OnboardingIllustration
                scheme={scheme}
                image={item.slide.image}
                name={item.slide.illustration}
                tint={illustrationTint}
              />
              <Text
                style={[styles.title, { color: palette.textPrimary }]}
                accessibilityRole="header"
              >
                {item.slide.title}
              </Text>
              <Text style={[styles.body, { color: palette.textSecondary }]}>
                {item.slide.body}
              </Text>
            </View>
          </View>
        );
      }
      return (
        <View style={[styles.slide, { width: SCREEN_WIDTH }]}>
          <ScrollView
            style={styles.formScroll}
            contentContainerStyle={styles.formScrollContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.formHeader}>
              <OnboardingIllustration
                scheme={scheme}
                name="person-add-outline"
                tint={illustrationTint}
                size="small"
              />
              <Text
                style={[styles.title, { color: palette.textPrimary }]}
                accessibilityRole="header"
              >
                Create your account
              </Text>
              <Text style={[styles.body, { color: palette.textSecondary }]}>
                This profile is stored only on this device. You can add more
                accounts later in Settings.
              </Text>
            </View>
            <View style={styles.formWrap}>
              <AccountForm
                palette={formPalette}
                onSubmit={handleCreateAccount}
              />
            </View>
          </ScrollView>
        </View>
      );
    },
    [
      formPalette,
      handleCreateAccount,
      illustrationTint,
      palette.textPrimary,
      palette.textSecondary,
      scheme,
    ],
  );

  const data: SlideItem[] = [
    ...INTRO_SLIDES.map((slide) => ({
      type: "intro" as const,
      key: slide.key,
      slide,
    })),
    { type: "form" as const, key: "form" },
  ];

  const isFirst = index === 0;
  const canGoNext = index < totalSlides - 1;

  return (
    <View
      style={[
        styles.screen,
        { backgroundColor: palette.background, paddingTop: insets.top },
      ]}
    >
      <FlatList
        ref={flatListRef}
        style={styles.list}
        data={data}
        keyExtractor={(item) => item.key}
        horizontal
        pagingEnabled
        scrollEnabled
        nestedScrollEnabled={Platform.OS === "android"}
        showsHorizontalScrollIndicator={false}
        renderItem={renderItem}
        onMomentumScrollEnd={onMomentumScrollEnd}
        getItemLayout={(_, i) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * i,
          index: i,
        })}
        onScrollToIndexFailed={(info) => {
          const wait = new Promise((r) => setTimeout(r, 500));
          void wait.then(() => {
            flatListRef.current?.scrollToIndex({
              index: info.index,
              animated: true,
            });
          });
        }}
      />

      <View
        style={[
          styles.footer,
          {
            paddingBottom: Math.max(insets.bottom, 12),
            borderTopColor: palette.separator,
            backgroundColor: palette.background,
          },
        ]}
      >
        <View style={styles.footerRow}>
          <Pressable
            onPress={goBack}
            disabled={isFirst}
            style={({ pressed }) => [
              styles.backBtn,
              {
                borderColor: palette.separator,
                opacity: isFirst ? 0 : 1,
              },
              pressed &&
                !isFirst &&
                { backgroundColor: palette.backPressed },
            ]}
            accessibilityLabel="Back"
          >
            <Text style={[styles.backLabel, { color: palette.textPrimary }]}>
              Back
            </Text>
          </Pressable>

          <View style={styles.dots} accessibilityLabel="Onboarding progress">
            {data.map((item, i) => (
              <View
                key={item.key}
                style={[
                  styles.dot,
                  {
                    backgroundColor:
                      i === index
                        ? systemBlueForScheme(scheme)
                        : palette.dotInactive,
                  },
                ]}
              />
            ))}
          </View>

          <Pressable
            onPress={goNext}
            disabled={!canGoNext}
            style={({ pressed }) => [
              styles.nextBtn,
              { backgroundColor: systemBlueForScheme(scheme) },
              pressed && canGoNext && { opacity: 0.88 },
              !canGoNext && { opacity: 0 },
            ]}
            accessibilityLabel="Next"
          >
            <Text style={styles.nextLabel}>Next</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

type SlideItem =
  | { type: "intro"; key: string; slide: IntroSlide }
  | { type: "form"; key: "form" };

function OnboardingIllustration({
  scheme,
  image,
  name,
  tint,
  size = "large",
}: {
  scheme: "light" | "dark" | null | undefined;
  image?: ImageSourcePropType;
  name: IonIconName;
  tint: string;
  size?: "large" | "small";
}) {
  const isLarge = size === "large";
  const plate = isLarge ? styles.illustrationPlate : styles.illustrationPlateSmall;
  const iconSize = isLarge ? 108 : 72;
  const plateBg =
    scheme === "dark" ? "rgba(10, 132, 255, 0.14)" : "rgba(0, 122, 255, 0.11)";

  if (image != null) {
    return (
      <View style={[plate, { backgroundColor: plateBg }]}>
        <Image
          source={image}
          style={isLarge ? styles.illustrationImage : styles.illustrationImageSmall}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
      </View>
    );
  }

  return (
    <View style={[plate, { backgroundColor: plateBg }]}>
      <Ionicons name={name} size={iconSize} color={tint} />
    </View>
  );
}

const colors = {
  light: {
    background: appColors.screenLight,
    textPrimary: "#000000",
    textSecondary: "#3c3c43",
    separator: "rgba(60, 60, 67, 0.29)",
    backPressed: "rgba(0, 0, 0, 0.04)",
    fieldBg: "rgba(120, 120, 128, 0.12)",
    fieldBorder: "rgba(60, 60, 67, 0.18)",
    placeholder: "rgba(60, 60, 67, 0.45)",
    error: appColors.destructive,
    dotInactive: "rgba(120, 120, 128, 0.35)",
  },
  dark: {
    background: appColors.screenDark,
    textPrimary: "#f2f2f7",
    textSecondary: "rgba(235, 235, 245, 0.75)",
    separator: "rgba(255, 255, 255, 0.12)",
    backPressed: "rgba(255, 255, 255, 0.06)",
    fieldBg: "rgba(120, 120, 128, 0.24)",
    fieldBorder: "rgba(255, 255, 255, 0.12)",
    placeholder: "rgba(235, 235, 245, 0.45)",
    error: "#ff6b6b",
    dotInactive: "rgba(235, 235, 245, 0.25)",
  },
} as const;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
  slide: {
    flex: 1,
    justifyContent: "center",
    alignItems: "stretch",
  },
  introColumn: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 28,
    paddingVertical: 12,
  },
  illustrationPlate: {
    width: 220,
    height: 220,
    borderRadius: 110,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
  },
  illustrationPlateSmall: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  illustrationImage: {
    width: 176,
    height: 176,
  },
  illustrationImageSmall: {
    width: 112,
    height: 112,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    letterSpacing: -0.4,
    marginBottom: 14,
    textAlign: "center",
  },
  body: {
    fontSize: 17,
    lineHeight: 24,
    textAlign: "center",
    maxWidth: 400,
  },
  formScroll: {
    flex: 1,
  },
  formScrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 16,
    justifyContent: "center",
  },
  formHeader: {
    alignItems: "center",
    marginBottom: 8,
  },
  formWrap: {
    width: "100%",
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 24,
    paddingTop: 12,
    gap: 12,
    minHeight: FOOTER_ROW_HEIGHT,
    justifyContent: "center",
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    flex: 1,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  backBtn: {
    minWidth: 96,
    height: 44,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  backLabel: {
    fontSize: 17,
    fontWeight: "600",
  },
  nextBtn: {
    minWidth: 96,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  nextLabel: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "600",
  },
});
