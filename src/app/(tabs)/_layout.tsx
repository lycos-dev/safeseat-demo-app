import ThemedHost from "@/components/themed-host";
import { Spacing as spacing, type ThemePalette } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { withLayoutContext, router, usePathname } from "expo-router";
import { createMaterialTopTabNavigator } from "expo-router/js-top-tabs";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Icon, Host } from "@expo/ui";

import * as Haptics from "expo-haptics";
import Banner from "@/components/banner";
import { SafeAreaView } from "react-native-safe-area-context";
import { UserPreferencesProvider } from "@/hooks/user-preferences-context";
import { SafeSeatHubProvider } from "@/hooks/safeseat-hub-context";
import { SafeSeatCloudSyncProvider } from "@/hooks/safeseat-cloud-sync-context";
import { SeatSessionProvider } from "@/hooks/seat-session-context";
import { DriverGuideProvider, useDriverGuide } from "@/hooks/driver-guide-context";
import DriverGuideOverlay from "@/components/driver-guide-overlay";
import GuidePulseOverlay from "@/components/guide-pulse-overlay";

import homeXml from "@expo/material-symbols/home.xml";
import seatXml from "@expo/material-symbols/airline_seat_recline_extra.xml";
import groupsXml from "@expo/material-symbols/groups.xml";
import settingsXml from "@expo/material-symbols/settings.xml";

const { Navigator } = createMaterialTopTabNavigator();
const Tabs = withLayoutContext<any, any, any, any>(Navigator);

const TAB_ROOTS: Record<string, string> = {
  home: "/home",
  assign: "/assign",
  everyone: "/everyone",
  settings: "/settings",
};

function MyCustomTabBar({ state, descriptors, navigation, pathname }: any) {
  const themes = useTheme();
  const styles = createStyles(themes);
  const { active: guideActive, stepId: guideStepId, recordTabOpened } = useDriverGuide();

  return (
    <View style={styles.tabContainer}>
      <View style={styles.tabDrawer}>
        {state.routes.map((route: any, index: number) => {
          const isFocused = state.index === index;
          const { options } = descriptors[route.key];
          const label = options.title ?? route.name;
          const renderIcon = options.tabBarIcon;

          const handlePress = () => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
            recordTabOpened(route.name);
            if (isFocused) {
              const rootPath = TAB_ROOTS[route.name];
              if (rootPath && pathname !== rootPath) router.replace(rootPath as any);
              return;
            }
            const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
            if (!event.defaultPrevented) navigation.navigate(route.name);
          };

          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
              onPress={handlePress}
              onLongPress={() => navigation.emit({ type: "tabLongPress", target: route.key })}
              style={({ pressed }) => [
                styles.tabButton,
                isFocused && styles.activeTabButton,
                guideActive && guideStepId === "dashboard" && route.name === "assign" && styles.guideTabButton,
                pressed && styles.pressedTabButton,
              ]}
            >
              {renderIcon?.({ focused: isFocused, color: isFocused ? themes.primaryBttn : themes.textSecondary, size: spacing.three })}
              <Text style={[styles.label, isFocused && styles.activeLabel]}>{label}</Text>
              <GuidePulseOverlay
                active={guideActive && guideStepId === "dashboard" && route.name === "assign"}
                label="TAP SEATS"
                borderRadius={17}
                inset={-3}
                beaconPosition="top"
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function TabsInner() {
  const themes = useTheme();
  const styles = createStyles(themes);
  const pathname = usePathname();
  const isNestedScreen = pathname.split("/").filter(Boolean).length > 1;

  const tabIcon = (focused: boolean, iosOn: NonNullable<Parameters<typeof Icon.select>[0]["ios"]>, iosOff: NonNullable<Parameters<typeof Icon.select>[0]["ios"]>, android: any) => (
    <ThemedHost key={`tab-icon-${themes.mode}-${focused ? "on" : "off"}`} matchContents>
      <Icon name={Icon.select({ ios: focused ? iosOn : iosOff, android })} size={spacing.three} color={focused ? themes.primaryBttn : themes.textSecondary} />
    </ThemedHost>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["left", "right", "top"]}>
      <View style={styles.root}>
        <View style={styles.bannerContainer}><Banner /></View>
        <Tabs
          tabBarPosition="bottom"
          // @ts-ignore
          tabBar={(props) => <MyCustomTabBar {...props} pathname={pathname} />}
          screenOptions={{ swipeEnabled: !isNestedScreen, lazy: true, lazyPreloadDistance: 0, headerShown: false, sceneContainerStyle: { backgroundColor: themes.background } }}
        >
          <Tabs.Screen name="home" options={{ title: "Home", tabBarIcon: ({ focused }: any) => tabIcon(focused, "house.fill", "house", homeXml) }} />
          <Tabs.Screen name="assign" options={{ title: "Seats", tabBarIcon: ({ focused }: any) => tabIcon(focused, "carseat.right.fill", "carseat.right", seatXml) }} />
          <Tabs.Screen name="everyone" options={{ title: "Profiles", tabBarIcon: ({ focused }: any) => tabIcon(focused, "person.3.fill", "person.3", groupsXml) }} />
          <Tabs.Screen name="settings" options={{ title: "Settings", tabBarIcon: ({ focused }: any) => tabIcon(focused, "gearshape.fill", "gearshape", settingsXml) }} />
        </Tabs>
        <DriverGuideOverlay />
      </View>
    </SafeAreaView>
  );
}

export default function TabLayout() {
  return (
    <UserPreferencesProvider>
      <SafeSeatHubProvider>
        <SeatSessionProvider>
          <SafeSeatCloudSyncProvider>
            <DriverGuideProvider>
              <TabsInner />
            </DriverGuideProvider>
          </SafeSeatCloudSyncProvider>
        </SeatSessionProvider>
      </SafeSeatHubProvider>
    </UserPreferencesProvider>
  );
}

const createStyles = (themes: ThemePalette) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: themes.background },
  root: { flex: 1, backgroundColor: themes.background },
  bannerContainer: { paddingHorizontal: spacing.two, paddingBottom: spacing.one },
  tabContainer: { width: "100%", backgroundColor: themes.background, paddingHorizontal: spacing.two, paddingTop: spacing.one, paddingBottom: spacing.one },
  tabDrawer: { minHeight: 70, flexDirection: "row", alignItems: "stretch", backgroundColor: themes.backgroundElement, borderRadius: 24, borderWidth: 1, borderColor: themes.divider, padding: 5, shadowColor: themes.shadow, shadowOpacity: themes.mode === "dark" ? 0.2 : 0.08, shadowRadius: 12, elevation: 5 },
  tabButton: { flex: 1, position: "relative", overflow: "visible", alignItems: "center", justifyContent: "center", gap: 4, borderRadius: 18 },
  activeTabButton: { backgroundColor: themes.primarySoft },
  guideTabButton: { zIndex: 50 },
  pressedTabButton: { opacity: 0.72 },
  label: { color: themes.textSecondary, fontSize: 13, fontFamily: "Body-Medium" },
  activeLabel: { color: themes.primaryBttn, fontFamily: "Body-Bold" },
});
