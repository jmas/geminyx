import { DatabaseProvider } from "@nozbe/watermelondb/react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { JetBrainsMono_400Regular, useFonts } from "@expo-google-fonts/jetbrains-mono";
import { isAppDatabaseReady } from "lib/appDatabaseReady";
import { initializeDatabase } from "lib/databaseSetup";
import { registerLocalDatabaseEraseHandler } from "lib/localDatabaseErase";
import { getWatermelonDatabase } from "lib/watermelon/database";
import { useCallback, useEffect, useState } from "react";
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
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <DatabaseProvider database={getWatermelonDatabase()}>
        <PopupProvider>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
              name="thread/[id]"
              options={{
                headerBackTitle: "Back",
              }}
            />
            <Stack.Screen
              name="capsule/[id]"
              options={{
                headerBackTitle: "Back",
              }}
            />
            <Stack.Screen
              name="account/edit"
              options={{
                title: "Edit profile",
                headerBackTitle: "Back",
              }}
            />
            <Stack.Screen
              name="account/create"
              options={{
                title: "New account",
                headerBackTitle: "Back",
              }}
            />
            <Stack.Screen
              name="account/certificate"
              options={{
                title: "Certificate",
                headerBackTitle: "Back",
              }}
            />
            <Stack.Screen
              name="account/developer"
              options={{
                title: "Developer",
                headerBackTitle: "Back",
              }}
            />
          </Stack>
          <StatusBar style="auto" />
        </PopupProvider>
      </DatabaseProvider>
    </GestureHandlerRootView>
  );
}
