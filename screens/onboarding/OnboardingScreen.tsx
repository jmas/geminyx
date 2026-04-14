import { Ionicons } from "@expo/vector-icons";
import { useCallback, useMemo, useRef, useState } from "react";
import type { ComponentProps } from "react";
import {
  Dimensions,
  FlatList,
  Image,
  type ImageSourcePropType,
  type ListRenderItem,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  PlatformColor,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
  type ColorValue,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  appColors,
  iosIntroScreenPalette,
  systemBlueForScheme,
} from "lib/theme/appColors";

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
    key: "threads",
    title: "Threads",
    body: "A thread is your history with one capsule: a single conversation where everything you have exchanged stays in order.",
    illustration: "chatbubbles-outline",
  },
  {
    key: "accounts",
    title: "Accounts",
    body: "Accounts live on your device. You can have more than one; capsules and threads belong to the active account. Export or import everything as one file to move to another device.",
    illustration: "shield-checkmark-outline",
  },
];

export type OnboardingScreenProps = {
  onFinishIntro: () => void;
};

export function OnboardingScreen({ onFinishIntro }: OnboardingScreenProps) {
  const scheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList<IntroSlide>>(null);
  const [index, setIndex] = useState(0);
  const totalSlides = INTRO_SLIDES.length;

  const palette = useMemo(() => {
    if (Platform.OS === "ios") return iosIntroScreenPalette();
    return scheme === "dark" ? colors.dark : colors.light;
  }, [scheme]);

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

  const illustrationTint = systemBlueForScheme(scheme);

  const renderItem: ListRenderItem<IntroSlide> = useCallback(
    ({ item: slide }) => {
      return (
        <View style={[styles.slide, { width: SCREEN_WIDTH }]}>
          <View style={styles.introColumn}>
            <OnboardingIllustration
              scheme={scheme}
              image={slide.image}
              name={slide.illustration}
              tint={illustrationTint}
            />
            <Text
              style={[styles.title, { color: palette.textPrimary }]}
              accessibilityRole="header"
            >
              {slide.title}
            </Text>
            <Text style={[styles.body, { color: palette.textSecondary }]}>
              {slide.body}
            </Text>
          </View>
        </View>
      );
    },
    [illustrationTint, palette.textPrimary, palette.textSecondary, scheme],
  );

  const isFirst = index === 0;
  const isLast = index === totalSlides - 1;

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
        data={INTRO_SLIDES}
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
              styles.footerTextBtn,
              {
                opacity: isFirst ? 0 : pressed ? 0.55 : 1,
              },
            ]}
            accessibilityLabel="Back"
          >
            <Text style={[styles.backLabel, { color: palette.textPrimary }]}>
              Back
            </Text>
          </Pressable>

          <View style={styles.dots} accessibilityLabel="Onboarding progress">
            {INTRO_SLIDES.map((slide, i) => (
              <View
                key={slide.key}
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

          {isLast ? (
            <Pressable
              onPress={onFinishIntro}
              style={({ pressed }) => [
                styles.footerTextBtn,
                pressed && { opacity: 0.55 },
              ]}
              accessibilityLabel="Get started"
            >
              <Text
                style={[
                  styles.primaryLabel,
                  { color: systemBlueForScheme(scheme) },
                ]}
              >
                Get started
              </Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={goNext}
              style={({ pressed }) => [
                styles.footerTextBtn,
                pressed && { opacity: 0.55 },
              ]}
              accessibilityLabel="Next"
            >
              <Text
                style={[
                  styles.primaryLabel,
                  { color: systemBlueForScheme(scheme) },
                ]}
              >
                Next
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

function OnboardingIllustration({
  scheme,
  image,
  name,
  tint,
}: {
  scheme: "light" | "dark" | null | undefined;
  image?: ImageSourcePropType;
  name: IonIconName;
  tint: ColorValue;
}) {
  const plate = styles.illustrationPlate;
  const iconSize = 108;
  const plateBg =
    Platform.OS === "ios"
      ? PlatformColor("tertiarySystemFill")
      : scheme === "dark"
        ? "rgba(10, 132, 255, 0.14)"
        : "rgba(0, 122, 255, 0.11)";

  if (image != null) {
    return (
      <View style={[plate, { backgroundColor: plateBg }]}>
        <Image
          source={image}
          style={styles.illustrationImage}
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
    dotInactive: "rgba(120, 120, 128, 0.35)",
  },
  dark: {
    background: appColors.screenDark,
    textPrimary: "#f2f2f7",
    textSecondary: "rgba(235, 235, 245, 0.75)",
    separator: "rgba(255, 255, 255, 0.12)",
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
  illustrationImage: {
    width: 176,
    height: 176,
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
  footerTextBtn: {
    minWidth: 96,
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  backLabel: {
    fontSize: 17,
    fontWeight: "400",
  },
  primaryLabel: {
    fontSize: 17,
    fontWeight: "700",
  },
});
