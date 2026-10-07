import { Ionicons } from "@expo/vector-icons";
import { format } from "date-fns";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { type ThemePalette } from "@/constants/theme";
import { formatSessionDuration, useSeatSessions, type SeatSessionSample } from "@/hooks/seat-session-context";
import { useTheme } from "@/hooks/use-theme";

function SummaryTile({ label, main, sub }: { label: string; main: string; sub?: string }) {
  const themes = useTheme();
  const styles = createStyles(themes);
  return <View style={styles.summaryTile}><Text style={styles.summaryLabel}>{label}</Text><Text style={styles.summaryMain}>{main}</Text>{sub ? <Text style={styles.summarySub}>{sub}</Text> : null}</View>;
}

function Trend({ label, unit, values }: { label: string; unit: string; values: number[] }) {
  const themes = useTheme();
  const styles = createStyles(themes);
  const reduced = useMemo(() => {
    if (values.length <= 28) return values;
    const stride = values.length / 28;
    return Array.from({ length: 28 }, (_, index) => values[Math.min(values.length - 1, Math.floor(index * stride))]);
  }, [values]);
  if (reduced.length < 2) return null;
  const min = Math.min(...reduced);
  const max = Math.max(...reduced);
  const range = Math.max(0.1, max - min);
  return (
    <View style={styles.trendCard}>
      <View style={styles.trendHeader}><Text style={styles.trendTitle}>{label}</Text><Text style={styles.trendRange}>{min.toFixed(unit === "bpm" ? 0 : 1)}–{max.toFixed(unit === "bpm" ? 0 : 1)} {unit}</Text></View>
      <View style={styles.bars}>{reduced.map((value, index) => {
        const height = 12 + ((value - min) / range) * 44;
        return <View key={`${label}-${index}`} style={[styles.bar, { height }]} />;
      })}</View>
      <Text style={styles.trendFoot}>Session trend · sampled periodically while the SafeSeat-linked seat was active</Text>
    </View>
  );
}

function numericSamples(samples: SeatSessionSample[], key: "heartRateBpm" | "respirationRateBpm" | "surfaceTemperatureC") {
  return samples.map((sample) => sample[key]).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
}

export default function SessionDetailScreen() {
  const themes = useTheme();
  const styles = createStyles(themes);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { getSessionById, deleteSession } = useSeatSessions();
  const [deleting, setDeleting] = useState(false);
  const session = typeof id === "string" ? getSessionById(id) : undefined;

  if (!session) {
    return <SafeAreaView style={styles.screen} edges={["left", "right", "bottom"]}><View style={styles.missing}><Ionicons name="alert-circle-outline" size={30} color={themes.textMuted} /><Text style={styles.missingTitle}>Session not found</Text><Text style={styles.missingText}>This session is no longer available on this device.</Text></View></SafeAreaView>;
  }

  const summary = session.summary;
  const hrValues = numericSamples(session.samples, "heartRateBpm");
  const rrValues = numericSamples(session.samples, "respirationRateBpm");
  const tempValues = numericSamples(session.samples, "surfaceTemperatureC");
  const endedAt = session.endedAt ?? Date.now();

  const confirmDeleteSession = () => {
    if (deleting) return;
    Alert.alert(
      "Delete this session?",
      "This removes the completed session from this device and your private SafeSeat cloud history. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            setDeleting(true);
            void deleteSession(session.id)
              .then(() => router.back())
              .catch(() => {
                setDeleting(false);
                Alert.alert("Could not finish deletion", "The local copy was removed. SafeSeat will retry any pending cloud deletion when connectivity returns.");
              });
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.screen} edges={["left", "right", "bottom"]}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 28 + insets.bottom }]} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>SESSION DETAIL</Text>
          <Text style={styles.title}>{session.occupant.displayName}</Text>
          <Text style={styles.subtitle}>{session.seatLabel} · {format(new Date(session.startedAt), "MMM d, yyyy · h:mm a")} – {format(new Date(endedAt), "h:mm a")} · {formatSessionDuration(session.startedAt, endedAt)}</Text>
        </View>

        <View style={styles.statusCard}>
          <View style={[styles.statusIcon, !session.hardwareLinked && styles.statusIconMuted]}><Ionicons name={session.hardwareLinked ? "checkmark-circle" : "information-circle"} size={24} color={session.hardwareLinked ? themes.primaryBttn : themes.textMuted} /></View>
          <View style={{ flex: 1 }}><Text style={styles.statusTitle}>{session.hardwareLinked ? ((summary?.emergencyEvents ?? 0) > 0 ? "Emergency event occurred" : (summary?.warningEvents ?? 0) > 0 ? "Session included review events" : "Monitoring completed") : "Passenger session completed"}</Text><Text style={styles.statusText}>{session.hardwareLinked ? "The readings below come from the SafeSeat hardware linked to this seat." : "No SafeSeat sensor was linked to this seat, so no physiological readings were recorded."}</Text></View>
        </View>

        <View style={styles.summaryGrid}>
          <SummaryTile label="Heart rate" main={summary?.heartRate ? `${summary.heartRate.average} bpm` : "No reading"} sub={summary?.heartRate ? `Min ${summary.heartRate.minimum} · Max ${summary.heartRate.maximum}` : undefined} />
          <SummaryTile label="Respiration" main={summary?.respirationRate ? `${summary.respirationRate.average} /min` : "No reading"} sub={summary?.respirationRate ? `Min ${summary.respirationRate.minimum} · Max ${summary.respirationRate.maximum}` : undefined} />
          <SummaryTile label="Surface temperature" main={summary?.surfaceTemperature ? `${summary.surfaceTemperature.average.toFixed(1)} °C` : "No reading"} sub={summary?.surfaceTemperature ? `Range ${summary.surfaceTemperature.minimum.toFixed(1)}–${summary.surfaceTemperature.maximum.toFixed(1)}` : undefined} />
          <SummaryTile label="Movement activity" main={summary?.activityLabel ?? "No data"} sub={`${summary?.movementEvents ?? 0} movement · ${summary?.verificationEvents ?? 0} verification`} />
        </View>

        <Trend label="Heart rate" unit="bpm" values={hrValues} />
        <Trend label="Respiration rate" unit="/min" values={rrValues} />
        <Trend label="Surface temperature" unit="°C" values={tempValues} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>EVENT TIMELINE</Text>
          <View style={styles.timelineCard}>
            {session.events.map((event, index) => (
              <View key={`${event.timestamp}-${index}`} style={[styles.timelineRow, index < session.events.length - 1 && styles.timelineDivider]}>
                <View style={styles.timelineDot} />
                <View style={styles.timelineTime}><Text style={styles.timelineTimeText}>{format(new Date(event.timestamp), "h:mm:ss a")}</Text></View>
                <View style={styles.timelineCopy}><Text style={styles.timelineTitle}>{event.title}</Text>{event.detail ? <Text style={styles.timelineDetail}>{event.detail}</Text> : null}</View>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.privacyCard}>
          <Ionicons name="eye-off-outline" size={22} color={themes.primaryBttn} />
          <View style={{ flex: 1 }}><Text style={styles.privacyTitle}>Camera privacy</Text><Text style={styles.privacyText}>SafeSeat may record that visual confirmation was requested or completed, but this history does not store or display camera frames, photos, or video.</Text></View>
        </View>

        <Pressable
          accessibilityRole="button"
          disabled={deleting}
          onPress={confirmDeleteSession}
          style={({ pressed }) => [styles.deleteButton, deleting && styles.deleteButtonDisabled, pressed && !deleting && { opacity: 0.78 }]}
        >
          {deleting ? <ActivityIndicator size="small" color={themes.warnBttn} /> : <Ionicons name="trash-outline" size={18} color={themes.warnBttn} />}
          <Text style={styles.deleteButtonText}>Delete Session</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (themes: ThemePalette) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: themes.background },
  content: { paddingHorizontal: 16, paddingTop: 52, gap: 16 },
  header: { gap: 4, paddingTop: 6 },
  eyebrow: { color: themes.primaryBttn, fontSize: 10.5, letterSpacing: 1.15, fontFamily: "Body-Bold" },
  title: { color: themes.text, fontSize: 30, lineHeight: 36, fontFamily: "Logo-Font" },
  subtitle: { color: themes.textSecondary, fontSize: 12, lineHeight: 18, fontFamily: "Body-Regular" },
  statusCard: { flexDirection: "row", gap: 11, alignItems: "center", padding: 14, borderRadius: 18, backgroundColor: themes.backgroundElement, borderWidth: 1, borderColor: themes.divider },
  statusIcon: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: themes.primarySoft, borderWidth: 1, borderColor: themes.primaryBorder },
  statusIconMuted: { backgroundColor: themes.surfaceSoft, borderColor: themes.divider },
  statusTitle: { color: themes.text, fontSize: 14, lineHeight: 19, fontFamily: "Body-Bold" },
  statusText: { color: themes.textSecondary, fontSize: 11.5, lineHeight: 17, fontFamily: "Body-Regular", marginTop: 2 },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  summaryTile: { width: "48.7%", minHeight: 86, padding: 12, borderRadius: 16, backgroundColor: themes.backgroundElement, borderWidth: 1, borderColor: themes.divider, justifyContent: "center", gap: 4 },
  summaryLabel: { color: themes.textMuted, fontSize: 10.5, fontFamily: "Body-Medium" },
  summaryMain: { color: themes.text, fontSize: 16, lineHeight: 20, fontFamily: "Body-Bold" },
  summarySub: { color: themes.textSecondary, fontSize: 10.5, lineHeight: 14, fontFamily: "Body-Regular" },
  trendCard: { padding: 13, borderRadius: 17, backgroundColor: themes.backgroundElement, borderWidth: 1, borderColor: themes.divider, gap: 9 },
  trendHeader: { flexDirection: "row", justifyContent: "space-between", gap: 10, alignItems: "center" },
  trendTitle: { color: themes.text, fontSize: 13, fontFamily: "Body-Bold" },
  trendRange: { color: themes.textSecondary, fontSize: 10.5, fontFamily: "Body-Medium" },
  bars: { height: 62, flexDirection: "row", alignItems: "flex-end", gap: 3, paddingHorizontal: 2, borderBottomWidth: 1, borderBottomColor: themes.divider },
  bar: { flex: 1, minWidth: 3, maxWidth: 10, borderTopLeftRadius: 3, borderTopRightRadius: 3, backgroundColor: themes.primaryBttn, opacity: 0.78 },
  trendFoot: { color: themes.textMuted, fontSize: 9.8, lineHeight: 14, fontFamily: "Body-Regular" },
  section: { gap: 8 },
  sectionTitle: { color: themes.textMuted, fontSize: 10.5, letterSpacing: 1.05, fontFamily: "Body-Bold", marginLeft: 4 },
  timelineCard: { borderRadius: 18, overflow: "hidden", backgroundColor: themes.backgroundElement, borderWidth: 1, borderColor: themes.divider },
  timelineRow: { flexDirection: "row", gap: 8, paddingHorizontal: 12, paddingVertical: 11 },
  timelineDivider: { borderBottomWidth: 1, borderBottomColor: themes.divider },
  timelineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: themes.primaryBttn, marginTop: 4 },
  timelineTime: { width: 76 },
  timelineTimeText: { color: themes.textMuted, fontSize: 9.5, lineHeight: 13, fontFamily: "Body-Medium" },
  timelineCopy: { flex: 1, minWidth: 0 },
  timelineTitle: { color: themes.text, fontSize: 12, lineHeight: 16, fontFamily: "Body-Bold" },
  timelineDetail: { color: themes.textSecondary, fontSize: 10.5, lineHeight: 15, fontFamily: "Body-Regular", marginTop: 2 },
  privacyCard: { flexDirection: "row", gap: 12, padding: 14, borderRadius: 18, backgroundColor: themes.primarySoft, borderWidth: 1, borderColor: themes.primaryBorder },
  privacyTitle: { color: themes.text, fontSize: 13, fontFamily: "Body-Bold" },
  privacyText: { color: themes.textSecondary, fontSize: 11.5, lineHeight: 17, fontFamily: "Body-Regular", marginTop: 3 },
  deleteButton: { minHeight: 48, borderRadius: 15, borderWidth: 1, borderColor: `${themes.warnBttn}55`, backgroundColor: themes.backgroundElement, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 14 },
  deleteButtonDisabled: { opacity: 0.5 },
  deleteButtonText: { color: themes.warnBttn, fontSize: 13, fontFamily: "Body-Bold" },
  missing: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 8 },
  missingTitle: { color: themes.text, fontSize: 17, fontFamily: "Body-Bold" },
  missingText: { color: themes.textSecondary, fontSize: 12.5, textAlign: "center", fontFamily: "Body-Regular" },
});
