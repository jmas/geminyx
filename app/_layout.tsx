import { Refine } from "@refinedev/core";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { JetBrainsMono_400Regular, useFonts } from "@expo-google-fonts/jetbrains-mono";
import { refineDataProvider, RESOURCES } from "lib/refineDataProvider";
import { registerLocalDatabaseEraseHandler } from "lib/localDatabaseErase";
import { initializeDatabase, isAppDatabaseReady } from "lib/sqlite";
import { useCallback, useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { PopupProvider } from "react-popup-manager";
import { OnboardingScreen } from "screens/onboarding/OnboardingScreen";

void SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  anchor: "(tabs)",
};

type AppGate = "boot" | "onboarding" | "app";

export default function RootLayout() {
  const [gate, setGate] = useState<AppGate>("boot");
  const [bootDone, setBootDone] = useState(false);
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
      setGate("onboarding");
    });
  }, []);

  if (gate === "boot" || !bootDone || !fontsLoaded) {
    return null;
  }

  if (gate === "onboarding") {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <OnboardingScreen onAccountCreated={enterApp} />
        <StatusBar style="auto" />
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Refine
        dataProvider={refineDataProvider}
        resources={[
          {
            name: RESOURCES.accounts,
            meta: {
              dataProviderName: "default",
              description:
                "App accounts; is_active marks the profile shown in Settings",
            },
          },
          {
            name: RESOURCES.capsules,
            meta: {
              dataProviderName: "default",
              description:
                "Capsules; each open dialog links one capsule via dialogs.capsule_id",
            },
          },
          {
            name: RESOURCES.dialogs,
            meta: {
              dataProviderName: "default",
              parent: RESOURCES.capsules,
              foreignKey: "capsule_id",
              description:
                "Per-capsule dialog history row: last message pointer and timestamp",
            },
          },
          {
            name: RESOURCES.messages,
            meta: {
              dataProviderName: "default",
              parent: RESOURCES.dialogs,
              foreignKey: "dialog_id",
            },
          },
        ]}
        options={{
          disableTelemetry: true,
        }}
      >
        <PopupProvider>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
              name="dialog/[id]"
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
          </Stack>
          <StatusBar style="auto" />
        </PopupProvider>
      </Refine>
    </GestureHandlerRootView>
  );
}
