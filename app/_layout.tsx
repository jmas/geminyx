import { Refine } from "@refinedev/core";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { refineDataProvider, RESOURCES } from "lib/refineDataProvider";
import { initializeDatabase } from "lib/sqlite";
import { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { PopupProvider } from "react-popup-manager";

void SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function RootLayout() {
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    initializeDatabase()
      .catch((e) => {
        console.error("SQLite init failed", e);
      })
      .finally(() => {
        if (!cancelled) setDbReady(true);
        void SplashScreen.hideAsync();
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!dbReady) {
    return null;
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
          </Stack>
          <StatusBar style="auto" />
        </PopupProvider>
      </Refine>
    </GestureHandlerRootView>
  );
}
