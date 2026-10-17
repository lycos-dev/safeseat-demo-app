import { FontSize as fontsize, Spacing as spacing, type ThemePalette } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { useUserPreferences } from "@/hooks/user-preferences-context";
import { useSafeSeatHub } from "@/hooks/safeseat-hub-context";
import { endCurrentCloudSession } from "@/services/admin-cloud-sync";
import { useDriverGuide } from "@/hooks/driver-guide-context";
import { clearSession } from "@/utils/securitySession";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { getLocalValue, setLocalValue, deleteLocalValue } from "@/services/local-storage";
import { signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, NativeScrollEvent, NativeSyntheticEvent, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { confirmAction } from "../../../utils/platform-dialog";


import ChangePasswordModal from "@/components/change-password-modal";
import ChangePhoneModal from "@/components/change-phone-modal";
import EscalationWindowControl from "@/components/escalation-window-control";
import SettingPageItem from "@/components/setting-page-item";
import SettingSwitch from "@/components/setting-switch";
import { auth, db } from "../../../firebase";

const IS_LOCKED_IN_KEY = "isLockedIn";
const SEAT_ASSIGNMENTS_KEY = "seatAssignments";
const SEAT_STATUSES_KEY = "seatStatuses";
const HARDWARE_SEAT_KEY = "safeSeatHardwareSeatNo";
const SEAT_CONSENTS_KEY = "seatSessionConsents";

type SectionKey = "account" | "alerts" | "history" | "system";

export default function Settings() {
  const themes = useTheme();
  const styles = createStyles(themes);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const sectionY = useRef<Record<SectionKey, number>>({ account: 0, alerts: 0, history: 0, system: 0 });
  const sectionsStartY = useRef(0);
  const stickyHeight = useRef(62);
  const shortcutY = useRef(0);
  const manualSectionRef = useRef<SectionKey | null>(null);
  const manualSectionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bottomPad = 24;
  const { connected: hubConnected, telemetryReady, seatState: hubSeatState } = useSafeSeatHub();
  const { startGuide } = useDriverGuide();

  const [userEmail, setUserEmail] = useState("Not set");
  const [userPhone, setUserPhone] = useState("Not set");
  const [isLockedIn, setIsLockedIn] = useState(false);
  const [activeSection, setActiveSection] = useState<SectionKey>("account");
  const [stickyActive, setStickyActive] = useState(false);
  const [sliderInteracting, setSliderInteracting] = useState(false);
  const [changePhoneVisible, setChangePhoneVisible] = useState(false);
  const [changePassVisible, setChangePassVisible] = useState(false);

  useEffect(() => {
    if (hubSeatState !== "emergency") return;
    setChangePhoneVisible(false);
    setChangePassVisible(false);
  }, [hubSeatState]);

  const {
    emergencyEscalation, setEmergencyEscalation,
    escalationWindowSeconds, setEscalationWindowSeconds,
    useMetric, setUseMetric,
    themeMode, setThemeMode,
  } = useUserPreferences();

  const loadAllUserData = useCallback(async () => {
    try {
      const rawLockedIn = await AsyncStorage.getItem(IS_LOCKED_IN_KEY);
      setIsLockedIn(rawLockedIn ? JSON.parse(rawLockedIn) : false);
      const currentUser = auth.currentUser;
      if (!currentUser) return;
      setUserEmail(currentUser.email ?? "Not set");
      const snap = await getDoc(doc(db, "users", currentUser.uid));
      if (snap.exists()) {
        const data = snap.data();
        if (data.phone) setUserPhone(data.phone);
      }
    } catch (error) {
      console.error("Failed to load Settings data:", error);
    }
  }, []);

  useFocusEffect(useCallback(() => { void loadAllUserData(); }, [loadAllUserData]));

  const scrollTo = (key: SectionKey) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
    manualSectionRef.current = key;
    if (manualSectionTimerRef.current) clearTimeout(manualSectionTimerRef.current);
    setActiveSection(key);
    const target = sectionsStartY.current + sectionY.current[key] - stickyHeight.current - 10;
    scrollRef.current?.scrollTo({ y: Math.max(0, target), animated: false });
    manualSectionTimerRef.current = setTimeout(() => {
      manualSectionRef.current = null;
      manualSectionTimerRef.current = null;
    }, 180);
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const scrollY = event.nativeEvent.contentOffset.y;
    setStickyActive(scrollY >= Math.max(0, shortcutY.current - 1));

    if (manualSectionRef.current) {
      setActiveSection(manualSectionRef.current);
      return;
    }

    const localY = scrollY + stickyHeight.current + 22 - sectionsStartY.current;
    const systemY = sectionY.current.system;
    const historyY = sectionY.current.history;
    const alertsY = sectionY.current.alerts;
    if (localY >= systemY - 18) setActiveSection("system");
    else if (localY >= historyY - 18) setActiveSection("history");
    else if (localY >= alertsY - 18) setActiveSection("alerts");
    else setActiveSection("account");
  };

  const clearSeatAssignments = async () => {
    if (isLockedIn) return;
    const confirmed = await confirmAction({
      title: "Clear seat assignments?",
      message: "This clears the current seat setup. Saved profiles and emergency contacts stay intact.",
      confirmText: "Clear",
      destructive: true,
    });
    if (!confirmed) return;

    try {
      await AsyncStorage.multiRemove([SEAT_ASSIGNMENTS_KEY, SEAT_STATUSES_KEY, IS_LOCKED_IN_KEY, HARDWARE_SEAT_KEY, SEAT_CONSENTS_KEY]);
      setIsLockedIn(false);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Cleared", "Seat assignments were reset.");
    } catch {
      Alert.alert("Could not clear", "Please try again.");
    }
  };

  const handleLogout = async () => {
    if (isLockedIn) return;
    const confirmed = await confirmAction({
      title: "Log out?",
      message: "Local trip data on this device will be cleared.",
      confirmText: "Log out",
      destructive: true,
    });
    if (!confirmed) return;

    try {
      await endCurrentCloudSession().catch(() => undefined);
      await signOut(auth);
      await clearSession();
      await AsyncStorage.multiRemove([SEAT_ASSIGNMENTS_KEY, SEAT_STATUSES_KEY, IS_LOCKED_IN_KEY, HARDWARE_SEAT_KEY, SEAT_CONSENTS_KEY, "app_emergency_contacts", "userPreferences"]);
      await Promise.all([
        deleteLocalValue("user_health_profile"),
        deleteLocalValue("user_privacy_prefs"),
        deleteLocalValue("user_local_app_prefs"),
        deleteLocalValue("is_logged_in"),
      ]);
      router.replace("/(auth)/login");
    } catch (error) {
      console.error("SafeSeat logout failed:", error);
      Alert.alert("Log out failed", "Please try again.");
    }
  };

  const shortcut = (label: string, key: SectionKey, interactive = true) => {
    const selected = activeSection === key;

    if (!interactive) {
      return (
        <View
          key={key}
          accessibilityRole="text"
          style={[styles.shortcut, selected && styles.shortcutActive]}
        >
          <Text style={[styles.shortcutText, selected && styles.shortcutTextActive]} numberOfLines={1}>{label}</Text>
        </View>
      );
    }

    return (
      <Pressable
        key={key}
        onPress={() => scrollTo(key)}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        style={({ pressed }) => [styles.shortcut, selected && styles.shortcutActive, pressed && styles.pressed]}
      >
        <Text style={[styles.shortcutText, selected && styles.shortcutTextActive]} numberOfLines={1}>{label}</Text>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.screen} edges={["left", "right"]}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={32}
        scrollEnabled={!sliderInteracting}
        directionalLockEnabled
        stickyHeaderIndices={Platform.OS === "ios" ? [1] : undefined}
        keyboardShouldPersistTaps="always"
      >
        <View style={styles.headerShell}>
          <View style={styles.headerBlock}>
            <Text style={styles.eyebrow}>PREFERENCES</Text>
            <Text style={styles.pageHeader}>Settings</Text>
            <Text style={styles.pageSubhead}>Account, alerts, monitoring history, display, and SafeSeat tools.</Text>
          </View>
        </View>

        <View
          pointerEvents={Platform.OS === "ios" && stickyActive ? "none" : "auto"}
          style={styles.stickyShortcutShell}
          onLayout={(event) => {
            stickyHeight.current = event.nativeEvent.layout.height;
            shortcutY.current = event.nativeEvent.layout.y;
          }}
        >
          <View style={styles.shortcutDock}>
            {shortcut("Account", "account")}
            {shortcut("Alerts", "alerts")}
            {shortcut("History", "history")}
            {shortcut("System", "system")}
          </View>
        </View>

        <View
          style={styles.sectionsContainer}
          onLayout={(event) => { sectionsStartY.current = event.nativeEvent.layout.y; }}
        >
          <View onLayout={(e) => { sectionY.current.account = e.nativeEvent.layout.y; }} style={styles.section}>
            <Text style={styles.sectionTitle}>ACCOUNT</Text>
            <View style={styles.settingGroup}>
              <View style={{ paddingHorizontal: 16, paddingVertical: 12, gap: 4 }} accessible accessibilityLabel={`Email, ${userEmail}`}><Text style={styles.infoTitle}>Email</Text><Text selectable style={styles.infoCopy}>{userEmail}</Text></View>
              <SettingPageItem name="Phone" iconName="call-outline" value={userPhone} onPress={() => setChangePhoneVisible(true)} showChevron />
              <SettingPageItem name="Password" iconName="key-outline" onPress={() => setChangePassVisible(true)} showChevron isLast />
            </View>
          </View>

          <View onLayout={(e) => { sectionY.current.alerts = e.nativeEvent.layout.y; }} style={styles.section}>
            <Text style={styles.sectionTitle}>ALERTS & EMERGENCY</Text>


            <View style={styles.settingGroup}>
              <SettingSwitch name="Driver Emergency SMS" iconName="chatbubble-ellipses-outline" value={emergencyEscalation} onValueChange={(v) => void setEmergencyEscalation(v)} isLast />
            </View>
            <Text style={styles.note}>SMS applies to Driver emergencies only.</Text>
            <EscalationWindowControl
              value={escalationWindowSeconds}
              enabled={emergencyEscalation}
              onInteractionChange={setSliderInteracting}
              onValueChange={(v) => void setEscalationWindowSeconds(v)}
            />
            <View style={styles.settingGroup}>
              <SettingPageItem name="Profiles & Emergency Contacts" iconName="people-outline" onPress={() => router.push("/(tabs)/everyone" as any)} showChevron isLast />
            </View>
          </View>

          <View onLayout={(e) => { sectionY.current.history = e.nativeEvent.layout.y; }} style={styles.section}>
            <Text style={styles.sectionTitle}>MONITORING & HISTORY</Text>
            <View style={styles.settingGroup}>
              <SettingPageItem
                name="Session History"
                iconName="time-outline"
                value="Completed seat sessions"
                onPress={() => router.navigate("/(tabs)/settings/session-history" as any)}
                showChevron
                isLast
              />
            </View>
            <Text style={styles.note}>Review completed passenger sessions, summaries, trends, and event timelines. Detailed history older than 30 days is removed during sync.</Text>
          </View>

          <View onLayout={(e) => { sectionY.current.system = e.nativeEvent.layout.y; }} style={styles.section}>
            <Text style={styles.sectionTitle}>SYSTEM & DISPLAY</Text>
            <View style={styles.settingGroup}>
              <SettingSwitch name="Light Mode" iconName="sunny-outline" value={themeMode === "light"} onValueChange={(v) => void setThemeMode(v ? "light" : "dark")} />
              <SettingSwitch name="Use Metric Units" iconName="speedometer-outline" value={useMetric} onValueChange={(v) => void setUseMetric(v)} isLast />
            </View>


            <View style={styles.settingGroup}>
              <SettingPageItem name="System Diagnostic" iconName="pulse-outline" value={hubConnected ? (telemetryReady ? "Live" : "Warming") : "Offline"} onPress={() => router.push("/(tabs)/settings/diagnostics" as any)} showChevron />
              <SettingPageItem name="SafeSeat Guide" iconName="help-circle-outline" value={isLockedIn ? "After session" : "Replay"} onPress={() => {
                if (isLockedIn) {
                  Alert.alert("Guide unavailable during monitoring", "End monitoring before replaying the guide.");
                  return;
                }
                startGuide();
              }} showChevron />
              <SettingPageItem name="Quick Help" iconName="book-outline" onPress={() => router.push("/(tabs)/settings/help" as any)} showChevron isLast />
            </View>

            <Text style={styles.sectionTitle}>SESSION & ACCOUNT</Text>
            <View style={styles.settingGroup}>
              <SettingPageItem name="Clear Seat Assignments" iconName="trash-outline" enabled={!isLockedIn} onPress={clearSeatAssignments} />
              <SettingPageItem name="Log out" iconName="log-out-outline" enabled={!isLockedIn} destructive onPress={handleLogout} isLast />
            </View>
            {isLockedIn ? <Text style={styles.note}>End the active monitoring session before clearing assignments or logging out.</Text> : null}
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerBrand}>SafeSeat</Text>
            <Text style={styles.footerCopy}>Non-diagnostic occupant safety monitoring</Text>
          </View>
        </View>
      </ScrollView>

      {Platform.OS === "android" && stickyActive ? (
        <View
          collapsable={false}
          style={styles.floatingShortcutShell}
        >
          <View style={styles.floatingShortcutDock}>
            {shortcut("Account", "account")}
            {shortcut("Alerts", "alerts")}
            {shortcut("History", "history")}
            {shortcut("System", "system")}
          </View>
        </View>
      ) : null}

      <ChangePhoneModal visible={changePhoneVisible} onClose={() => setChangePhoneVisible(false)} onSuccess={() => { void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); setChangePhoneVisible(false); void loadAllUserData(); }} />
      <ChangePasswordModal visible={changePassVisible} onClose={() => setChangePassVisible(false)} onSuccess={() => { void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); setChangePassVisible(false); void loadAllUserData(); }} />
    </SafeAreaView>
  );
}

const createStyles = (themes: ThemePalette) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: themes.background },
  scrollContent: { flexGrow: 1 },
  headerShell: { paddingHorizontal: spacing.two, paddingTop: spacing.one, paddingBottom: 10, backgroundColor: themes.background },
  headerBlock: { gap: 3 },
  eyebrow: { color: themes.primaryBttn, fontSize: 11, letterSpacing: 1.4, fontFamily: "Body-Bold" },
  pageHeader: { fontSize: fontsize.pageHeader, fontFamily: "Logo-Font", color: themes.text },
  pageSubhead: { color: themes.textSecondary, fontSize: fontsize.body, lineHeight: 21, fontFamily: "Body-Regular" },

  stickyShortcutShell: {
    backgroundColor: themes.background,
    paddingHorizontal: spacing.two,
    paddingTop: 5,
    paddingBottom: 9,
  },
  floatingShortcutShell: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10000,
    elevation: 100,
    backgroundColor: themes.background,
    paddingHorizontal: spacing.two,
    paddingTop: 5,
    paddingBottom: 9,
  },
  floatingShortcutDock: {
    flexDirection: "row",
    gap: 6,
    padding: 5,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: themes.divider,
    backgroundColor: themes.backgroundElevated,
    position: "relative",
    zIndex: 10001,
    elevation: 101,
  },
  shortcutDock: {
    flexDirection: "row",
    gap: 6,
    padding: 5,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: themes.divider,
    backgroundColor: themes.backgroundElevated,
    shadowColor: themes.shadow,
    shadowOpacity: themes.mode === "dark" ? 0.24 : 0.09,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 7,
  },
  shortcut: {
    flex: 1,
    minHeight: 38,
    paddingHorizontal: 5,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "transparent",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  shortcutActive: {
    backgroundColor: themes.primarySoft,
    borderColor: themes.primaryBorder,
  },
  shortcutText: { color: themes.textSecondary, fontSize: 11.5, lineHeight: 16, textAlign: "center", fontFamily: "Body-Bold" },
  shortcutTextActive: { color: themes.primaryBttn },
  pressed: { opacity: 0.72, transform: [{ scale: 0.985 }] },

  sectionsContainer: { paddingHorizontal: spacing.two, gap: spacing.three },
  section: { gap: 10 },
  sectionTitle: { color: themes.textMuted, fontFamily: "Body-Bold", fontSize: 11.5, letterSpacing: 1.1, marginLeft: 4, marginTop: 4 },
  settingGroup: { borderRadius: 18, overflow: "hidden", borderWidth: 1, borderColor: themes.divider, backgroundColor: themes.backgroundElement },
  infoCard: { flexDirection: "row", gap: 12, padding: 14, borderRadius: 18, borderWidth: 1, borderColor: themes.primaryBorder, backgroundColor: themes.primarySoft },
  infoIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: themes.backgroundElement, alignItems: "center", justifyContent: "center" },
  infoTitle: { color: themes.text, fontSize: 15.5, lineHeight: 21, fontFamily: "Body-Bold" },
  infoCopy: { color: themes.textSecondary, fontSize: 13, lineHeight: 19, fontFamily: "Body-Regular", marginTop: 3 },
  note: { color: themes.textSecondary, fontSize: 13, lineHeight: 19, fontFamily: "Body-Regular", paddingHorizontal: 4 },
  noteStrong: { color: themes.text, fontFamily: "Body-Bold" },
  footer: { alignItems: "center", paddingVertical: 24, gap: 4 },
  footerBrand: { color: themes.text, fontFamily: "Logo-Font", fontSize: 22 },
  footerCopy: { color: themes.textMuted, fontSize: 12, fontFamily: "Body-Regular" },
});
