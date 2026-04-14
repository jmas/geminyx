import { Ionicons } from "@expo/vector-icons";
import { PlatformPressable } from "@react-navigation/elements";
import type {
  BottomTabBarButtonProps,
  BottomTabNavigationOptions,
} from "@react-navigation/bottom-tabs";
import { Tabs, usePathname, useRouter, type Href } from "expo-router";
import { useEffect, useLayoutEffect, useRef } from "react";
import { useColorScheme } from "react-native";
import { tabNavigatorChromeForScheme } from "lib/theme/appColors";
import {
  getCachedInitialRootTab,
  SETTINGS_TAB_ACTIVE_KEY,
  settingsRepo,
  type RootTabRouteName,
} from "repositories";

/**
 * Root tab from the URL. Route groups like `(tabs)` are omitted in the path, so
 * Threads is `/threads` (not `/(tabs)/threads`) — `useSegments()[0] === "threads"`.
 */
function rootTabFromPathname(pathname: string): RootTabRouteName | null {
  const p = pathname.replace(/\/$/, "") || "/";
  if (p === "/threads") return "threads";
  if (p === "/settings") return "settings";
  if (p === "/" || p === "/index") return "index";
  return null;
}

function hrefForRootTab(tab: RootTabRouteName): Href {
  if (tab === "index") return "/";
  return `/${tab}` as Href;
}

function CenteredTabBarButton(props: BottomTabBarButtonProps) {
  return (
    <PlatformPressable
      {...props}
      style={[props.style, { justifyContent: "center" }]}
    />
  );
}

export default function TabLayout() {
  const scheme = useColorScheme();
  const chrome = tabNavigatorChromeForScheme(scheme);
  const router = useRouter();
  const pathname = usePathname();
  const didInitialRestore = useRef(false);
  /** True while we are replacing away from default URL `/` → saved tab (avoid persisting `index` too early). */
  const restorePending = useRef(false);

  // Expo Router uses the URL for the active tab; groups are not in the path (`/threads`, not `/(tabs)/threads`).
  useLayoutEffect(() => {
    if (didInitialRestore.current) return;
    const current = rootTabFromPathname(pathname);
    if (current == null) {
      didInitialRestore.current = true;
      return;
    }
    didInitialRestore.current = true;

    const desired = getCachedInitialRootTab();
    if (current === "index" && desired !== "index") {
      restorePending.current = true;
      router.replace(hrefForRootTab(desired));
    }
  }, [pathname, router]);

  useEffect(() => {
    const tab = rootTabFromPathname(pathname);
    if (tab == null) return;
    if (restorePending.current) {
      if (tab !== "index") restorePending.current = false;
      return;
    }
    void settingsRepo.setForActiveAccount(SETTINGS_TAB_ACTIVE_KEY, tab);
  }, [pathname]);

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        tabBarShowLabel: false,
        tabBarButton: CenteredTabBarButton,
        ...(chrome as BottomTabNavigationOptions),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Capsules",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cube-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="threads"
        options={{
          title: "Threads",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubbles-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
