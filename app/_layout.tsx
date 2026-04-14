import "lib/i18n";

import { DatabaseProvider } from "@nozbe/watermelondb/react";
import { QueryClientProvider } from "@tanstack/react-query";
import type { NativeStackNavigationOptions } from "@react-navigation/native-stack";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { JetBrainsMono_400Regular, useFonts } from "@expo-google-fonts/jetbrains-mono";
import { isAppDatabaseReady } from "lib/appDatabaseReady";
import { initializeDatabase } from "lib/databaseSetup";
import { registerLocalDatabaseEraseHandler } from "lib/localDatabaseErase";
import { queryClient } from "lib/queryClient";
import { navigationChromeForScheme } from "lib/theme/appColors";
import { getWatermelonDatabase } from "lib/watermelon/database";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useColorScheme } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { PopupProvider } from "react-popup-manager";
import { AccountCreateScreen } from "screens/account/AccountCreateScreen";
import { OnboardingScreen } from "screens/onboarding/OnboardingScreen";

void SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  anchor: "(tabs)",
};

type AppGate = "boot" | "onboarding" | "app";

function AppStack() {
  const scheme = useColorScheme();
  const { t } = useTranslation();
  const stackScreenOptions = useMemo(
    () =>
      ({
        ...navigationChromeForScheme(scheme),
        headerBackTitle: t("common.back"),
      }) as NativeStackNavigationOptions,
    [scheme, t],
  );
  return (
    <Stack screenOptions={stackScreenOptions}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="thread/[id]" />
      <Stack.Screen
        name="threads/view"
        options={{
          title: t("stack.thread"),
        }}
      />
      <Stack.Screen
        name="capsules/create"
        options={{
          title: t("stack.thread"),
        }}
      />
      <Stack.Screen
        name="capsule/create"
        options={{
          title: t("stack.addCapsule"),
        }}
      />
      <Stack.Screen name="capsule/[id]" />
      <Stack.Screen
        name="capsule/edit/[id]"
        options={{
          title: t("stack.editCapsule"),
        }}
      />
      <Stack.Screen
        name="account/edit"
        options={{
          title: t("stack.editAccount"),
        }}
      />
      <Stack.Screen
        name="account/create"
        options={{
          title: t("stack.newAccount"),
        }}
      />
      <Stack.Screen
        name="account/certificate"
        options={{
          title: t("stack.certificate"),
        }}
      />
      <Stack.Screen
        name="account/developer"
        options={{
          title: t("stack.developer"),
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  const [gate, setGate] = useState<AppGate>("boot");
  const [bootDone, setBootDone] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState<"slides" | "create">(
    "slides",
  );
  const [fontsLoaded] = useFonts({
    JetBrainsMono_400Regular,
  });

  const enterApp = useCallback(() => {
    setGate("app");
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const ready = await isAppDatabaseReady();
        if (cancelled) return;
        if (ready) {
          await initializeDatabase();
          setGate("app");
        } else {
          setGate("onboarding");
        }
      } catch (e) {
        console.error("App database gate failed", e);
        if (!cancelled) setGate("onboarding");
      } finally {
        if (!cancelled) setBootDone(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!bootDone) return;
    if (!fontsLoaded) return;
    void SplashScreen.hideAsync();
  }, [bootDone, fontsLoaded]);

  useEffect(() => {
    return registerLocalDatabaseEraseHandler(() => {
      setOnboardingStep("slides");
      setGate("onboarding");
    });
  }, []);

  if (gate === "boot" || !bootDone || !fontsLoaded) {
    return null;
  }

  if (gate === "onboarding") {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <QueryClientProvider client={queryClient}>
          {onboardingStep === "slides" ? (
            <OnboardingScreen
              onFinishIntro={() => setOnboardingStep("create")}
            />
          ) : (
            <AccountCreateScreen
              embedMode
              onBackToIntro={() => setOnboardingStep("slides")}
              onSuccess={enterApp}
            />
          )}
          <StatusBar style="auto" />
        </QueryClientProvider>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <DatabaseProvider database={getWatermelonDatabase()}>
          <PopupProvider>
            <AppStack />
            <StatusBar style="auto" />
          </PopupProvider>
        </DatabaseProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
