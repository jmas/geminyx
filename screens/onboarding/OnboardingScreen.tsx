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
import { useTranslation } from "react-i18next";
import { iosIntroScreenPalette, systemBlueForScheme } from "lib/theme/appColors";
import { semanticUiPaletteForScheme } from "lib/theme/semanticUi";

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

export type OnboardingScreenProps = {
  onFinishIntro: () => void;
};

export function OnboardingScreen({ onFinishIntro }: OnboardingScreenProps) {
  const { t } = useTranslation();
  const scheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList<IntroSlide>>(null);
  const [index, setIndex] = useState(0);
  const introSlides = useMemo(
    (): IntroSlide[] => [
      {
        key: "welcome",
        title: t("onboarding.welcomeTitle"),
        body: t("onboarding.welcomeBody"),
        illustration: "planet-outline",
      },
      {
        key: "capsules",
        title: t("onboarding.capsulesTitle"),
        body: t("onboarding.capsulesBody"),
        illustration: "cube-outline",
      },
      {
        key: "threads",
        title: t("onboarding.threadsTitle"),
        body: t("onboarding.threadsBody"),
        illustration: "chatbubbles-outline",
      },
      {
        key: "accounts",
        title: t("onboarding.accountsTitle"),
        body: t("onboarding.accountsBody"),
        illustration: "shield-checkmark-outline",
      },
    ],
    [t],
  );
  const totalSlides = introSlides.length;

  const palette = useMemo(() => {
    if (Platform.OS === "ios") return iosIntroScreenPalette();
    const s = semanticUiPaletteForScheme(scheme);
    return {
      background: s.systemGroupedBackground,
      textPrimary: s.label,
      textSecondary: s.secondaryLabel,
      separator: s.separator,
      dotInactive: s.systemGray4,
    };
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
        data={introSlides}
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
            accessibilityLabel={t("common.back")}
          >
            <Text style={[styles.backLabel, { color: palette.textPrimary }]}>
              {t("common.back")}
            </Text>
          </Pressable>

          <View style={styles.dots} accessibilityLabel={t("onboarding.progress")}>
            {introSlides.map((slide, i) => (
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
              accessibilityLabel={t("onboarding.getStarted")}
            >
              <Text
                style={[
                  styles.primaryLabel,
                  { color: systemBlueForScheme(scheme) },
                ]}
              >
                {t("onboarding.getStarted")}
              </Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={goNext}
              style={({ pressed }) => [
                styles.footerTextBtn,
                pressed && { opacity: 0.55 },
              ]}
              accessibilityLabel={t("common.next")}
            >
              <Text
                style={[
                  styles.primaryLabel,
                  { color: systemBlueForScheme(scheme) },
                ]}
              >
                {t("common.next")}
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
