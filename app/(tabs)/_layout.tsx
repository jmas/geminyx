import { Ionicons } from "@expo/vector-icons";
import type { BottomTabNavigationOptions } from "@react-navigation/bottom-tabs";
import { Tabs, usePathname, useRouter, type Href } from "expo-router";
import { useEffect, useLayoutEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useColorScheme } from "react-native";
import { tabNavigatorChromeForScheme } from "lib/theme/appColors";
import {
  getCachedInitialRootTab,
  SETTINGS_TAB_ACTIVE_KEY,
  settingsRepo,
  type RootTabRouteName,
} from "repositories";

/** Larger than default (~25pt). `TabBarIcon` uses a fixed 31×28 wrapper — expand via `tabBarIconStyle` or icons clip. */
const TAB_BAR_ICON_SIZE = 32;
const TAB_BAR_ICON_WRAPPER = {
  width: TAB_BAR_ICON_SIZE + 8,
  height: TAB_BAR_ICON_SIZE + 6,
} as const;

/**
 * Root tab from the URL. Route groups like `(tabs)` are omitted in the path, so
 * Threads is `/threads` (not `/(tabs)/threads`) — `useSegments()[0] === "threads"`.
 */
function rootTabFromPathname(pathname: string): RootTabRouteName | null {
  const p = pathname.replace(/\/$/, "") || "/";
  if (p === "/threads") return "threads";
  if (p === "/settings") return "settings";
  if (
    p === "/" ||
    p === "/index" ||
    p === "/(tabs)" ||
    p === "/(tabs)/index"
  ) {
    return "index";
  }
  return null;
}

function hrefForRootTab(tab: RootTabRouteName): Href {
  if (tab === "index") {
    /** Typed routes omit some valid paths; runtime path matches nested stack `index/index`. */
    return "/(tabs)/index" as Href;
  }
  return `/${tab}` as Href;
}

export default function TabLayout() {
  const { t } = useTranslation();
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
        tabBarShowLabel: true,
        /** Override default 31×28 icon box so larger glyphs are not clipped. */
        tabBarIconStyle: TAB_BAR_ICON_WRAPPER,
        ...(chrome as BottomTabNavigationOptions),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("tabs.capsules"),
          /** Nested native stack in `index/_layout.tsx` owns the real UINavigationBar header. */
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <Ionicons
              name="cube-outline"
              size={TAB_BAR_ICON_SIZE}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="threads"
        options={{
          title: t("tabs.threads"),
          /** Nested native stack in `threads/_layout.tsx` owns the real UINavigationBar header. */
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <Ionicons
              name="chatbubbles-outline"
              size={TAB_BAR_ICON_SIZE}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t("tabs.settings"),
          /** Nested native stack in `settings/_layout.tsx` owns the real UINavigationBar header. */
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <Ionicons
              name="settings-outline"
              size={TAB_BAR_ICON_SIZE}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
