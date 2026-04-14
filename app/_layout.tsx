import { DatabaseProvider } from "@nozbe/watermelondb/react";
import { QueryClientProvider } from "@tanstack/react-query";
import type { NativeStackNavigationOptions } from "@react-navigation/native-stack";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { JetBrainsMono_400Regular, useFonts } from "@expo-google-fonts/jetbrains-mono";
import { isAppDatabaseReady } from "lib/appDatabaseReady";
import { initializeDatabase } from "lib/databaseSetup";
import { navigationChromeForScheme } from "lib/theme/appColors";
import { registerLocalDatabaseEraseHandler } from "lib/localDatabaseErase";
import { queryClient } from "lib/queryClient";
import { getWatermelonDatabase } from "lib/watermelon/database";
import { useCallback, useEffect, useMemo, useState } from "react";
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

export default function RootLayout() {
  const scheme = useColorScheme();
  const stackScreenOptions = useMemo(
    () =>
      ({
        ...navigationChromeForScheme(scheme),
        headerBackTitle: "Back",
      }) as NativeStackNavigationOptions,
    [scheme],
  );
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
            <Stack screenOptions={stackScreenOptions}>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="thread/[id]" />
              <Stack.Screen
                name="threads/view"
                options={{
                  title: "Thread",
                }}
              />
              <Stack.Screen name="capsule/[id]" />
              <Stack.Screen
                name="capsule/edit/[id]"
                options={{
                  title: "Edit Capsule",
                }}
              />
              <Stack.Screen
                name="account/edit"
                options={{
                  title: "Edit profile",
                }}
              />
              <Stack.Screen
                name="account/create"
                options={{
                  title: "New account",
                }}
              />
              <Stack.Screen
                name="account/certificate"
                options={{
                  title: "Certificate",
                }}
              />
              <Stack.Screen
                name="account/developer"
                options={{
                  title: "Developer",
                }}
              />
            </Stack>
            <StatusBar style="auto" />
          </PopupProvider>
        </DatabaseProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
