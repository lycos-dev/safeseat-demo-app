import { Ionicons } from "@expo/vector-icons";
import { format, isToday, isYesterday } from "date-fns";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { type ThemePalette } from "@/constants/theme";
import { formatSessionDuration, useSeatSessions, type SeatSessionRecord } from "@/hooks/seat-session-context";
import { useTheme } from "@/hooks/use-theme";
import { confirmAction } from "../../../utils/platform-dialog";

function dayLabel(timestamp: number) {
  const date = new Date(timestamp);
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "MMM d, yyyy");
}

function sessionStatus(session: SeatSessionRecord) {
  const summary = session.summary;
  if ((summary?.emergencyEvents ?? 0) > 0) return "Emergency event recorded";
  if ((summary?.warningEvents ?? 0) > 0 || (summary?.verificationEvents ?? 0) > 0) return `${(summary?.warningEvents ?? 0) + (summary?.verificationEvents ?? 0)} review event${((summary?.warningEvents ?? 0) + (summary?.verificationEvents ?? 0)) === 1 ? "" : "s"}`;
  return session.hardwareLinked ? "Normal session" : "No sensor linked";
}

export default function SessionHistoryScreen() {
  const themes = useTheme();
  const styles = createStyles(themes);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { history, refreshHistoryFromCloud, clearSessionHistory } = useSeatSessions();
  const navigationLockedRef = useRef(false);
  const [clearing, setClearing] = useState(false);

  useFocusEffect(useCallback(() => {
    navigationLockedRef.current = false;
    void refreshHistoryFromCloud();
  }, [refreshHistoryFromCloud]));

  const openSession = useCallback((sessionId: string) => {
    if (navigationLockedRef.current) return;
    navigationLockedRef.current = true;
    router.push({ pathname: "/(tabs)/settings/session-detail" as any, params: { id: sessionId } });
  }, [router]);

  const confirmClearHistory = useCallback(() => {
    if (clearing || history.length === 0) return;
    void confirmAction({
      title: "Clear session history?",
      message: "This removes all completed session history from this device and your private SafeSeat cloud history. Active monitoring is not affected.",
      confirmText: "Clear history",
      destructive: true,
    }).then((confirmed) => {
      if (!confirmed) return;
      setClearing(true);
      void clearSessionHistory()
        .catch(() => {
          Alert.alert("Could not finish clearing history", "The local history was cleared. SafeSeat will retry any pending cloud deletion when connectivity returns.");
        })
        .finally(() => setClearing(false));
    });
  }, [clearSessionHistory, clearing, history.length]);

  const groups = useMemo(() => {
    const grouped: Array<{ label: string; items: SeatSessionRecord[] }> = [];
    history.forEach((session) => {
      const label = dayLabel(session.endedAt ?? session.startedAt);
      const existing = grouped.find((group) => group.label === label);
      if (existing) existing.items.push(session);
      else grouped.push({ label, items: [session] });
    });
    return grouped;
  }, [history]);

  return (
    <SafeAreaView style={styles.screen} edges={["left", "right", "bottom"]}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 28 + insets.bottom }]} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>PRIVATE PASSENGER RECORD</Text>
          <Text style={styles.title}>Session History</Text>
          <Text style={styles.subtitle}>Review completed seat sessions, trends, and event timelines. Exact readings stay in the passenger-side history and are not exposed to the Admin dashboard.</Text>
        </View>

        {groups.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="time-outline" size={30} color={themes.textMuted} />
            <Text style={styles.emptyTitle}>No completed sessions yet</Text>
            <Text style={styles.emptyText}>When a passenger's seat session ends, the summary and detailed readings will appear here.</Text>
          </View>
        ) : groups.map((group) => (
          <View key={group.label} style={styles.group}>
            <Text style={styles.groupLabel}>{group.label.toUpperCase()}</Text>
            <View style={styles.groupCard}>
              {group.items.map((session, index) => (
                <Pressable
                  key={session.id}
                  accessibilityRole="button"
                  onPress={() => openSession(session.id)}
                  style={({ pressed }) => [styles.row, index < group.items.length - 1 && styles.rowDivider, pressed && styles.rowPressed]}
                >
                  <View style={[styles.iconWrap, !session.hardwareLinked && styles.iconWrapMuted]}>
                    <Ionicons name={session.hardwareLinked ? "pulse-outline" : "person-outline"} size={20} color={session.hardwareLinked ? themes.primaryBttn : themes.textMuted} />
                  </View>
                  <View style={styles.rowCopy}>
                    <Text style={styles.rowName} numberOfLines={1}>{session.occupant.displayName}</Text>
                    <Text style={styles.rowMeta}>{session.seatLabel} · {formatSessionDuration(session.startedAt, session.endedAt)} · {format(new Date(session.startedAt), "h:mm a")}</Text>
                    <Text style={styles.rowStatus}>{sessionStatus(session)}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={themes.textMuted} />
                </Pressable>
              ))}
            </View>
          </View>
        ))}

        <View style={styles.privacyCard}>
          <Ionicons name="shield-checkmark-outline" size={21} color={themes.primaryBttn} />
          <View style={{ flex: 1 }}>
            <Text style={styles.privacyTitle}>Privacy boundary</Text>
            <Text style={styles.privacyText}>Detailed passenger session history older than 30 days is removed from this device and deleted from the private cloud during sync. You can delete it sooner at any time. Camera images and video are never stored here.</Text>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          disabled={clearing || history.length === 0}
          onPress={confirmClearHistory}
          style={({ pressed }) => [
            styles.clearButton,
            (clearing || history.length === 0) && styles.clearButtonDisabled,
            pressed && !clearing && history.length > 0 && { opacity: 0.78 },
          ]}
        >
          {clearing ? <ActivityIndicator size="small" color={themes.warnBttn} /> : <Ionicons name="trash-outline" size={18} color={themes.warnBttn} />}
          <Text style={styles.clearButtonText}>Clear Session History</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (themes: ThemePalette) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: themes.background },
  content: { paddingHorizontal: 16, paddingTop: 52, gap: 20 },
  header: { gap: 5, paddingTop: 6 },
  eyebrow: { color: themes.primaryBttn, fontSize: 10.5, letterSpacing: 1.15, fontFamily: "Body-Bold" },
  title: { color: themes.text, fontSize: 30, lineHeight: 36, fontFamily: "Logo-Font" },
  subtitle: { color: themes.textSecondary, fontSize: 13, lineHeight: 20, fontFamily: "Body-Regular", maxWidth: 680 },
  group: { gap: 8 },
  groupLabel: { color: themes.textMuted, fontSize: 10.5, letterSpacing: 1.05, fontFamily: "Body-Bold", marginLeft: 4 },
  groupCard: { borderRadius: 18, overflow: "hidden", backgroundColor: themes.backgroundElement, borderWidth: 1, borderColor: themes.divider },
  row: { minHeight: 82, flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 13, paddingVertical: 11 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: themes.divider },
  rowPressed: { opacity: 0.72 },
  iconWrap: { width: 39, height: 39, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: themes.primarySoft, borderWidth: 1, borderColor: themes.primaryBorder },
  iconWrapMuted: { backgroundColor: themes.surfaceSoft, borderColor: themes.divider },
  rowCopy: { flex: 1, minWidth: 0, gap: 2 },
  rowName: { color: themes.text, fontSize: 14.5, lineHeight: 19, fontFamily: "Body-Bold" },
  rowMeta: { color: themes.textSecondary, fontSize: 11, lineHeight: 15, fontFamily: "Body-Regular" },
  rowStatus: { color: themes.textMuted, fontSize: 10.5, lineHeight: 14, fontFamily: "Body-Medium" },
  emptyCard: { minHeight: 190, borderRadius: 20, alignItems: "center", justifyContent: "center", padding: 24, gap: 8, backgroundColor: themes.backgroundElement, borderWidth: 1, borderColor: themes.divider },
  emptyTitle: { color: themes.text, fontSize: 16, fontFamily: "Body-Bold" },
  emptyText: { color: themes.textSecondary, fontSize: 12.5, lineHeight: 19, textAlign: "center", fontFamily: "Body-Regular", maxWidth: 340 },
  privacyCard: { flexDirection: "row", gap: 12, padding: 14, borderRadius: 18, backgroundColor: themes.primarySoft, borderWidth: 1, borderColor: themes.primaryBorder },
  privacyTitle: { color: themes.text, fontSize: 13, fontFamily: "Body-Bold" },
  privacyText: { color: themes.textSecondary, fontSize: 11.5, lineHeight: 17, fontFamily: "Body-Regular", marginTop: 3 },
  clearButton: { minHeight: 48, borderRadius: 15, borderWidth: 1, borderColor: `${themes.warnBttn}55`, backgroundColor: themes.backgroundElement, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 14 },
  clearButtonDisabled: { opacity: 0.45 },
  clearButtonText: { color: themes.warnBttn, fontSize: 13, fontFamily: "Body-Bold" },
});
