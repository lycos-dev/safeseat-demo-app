import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { type ThemePalette } from "@/constants/theme";
import { formatSessionDuration, type SeatSessionRecord } from "@/hooks/seat-session-context";
import { useTheme } from "@/hooks/use-theme";

type Props = {
  visible: boolean;
  session?: SeatSessionRecord;
  onClose: () => void;
  onDismiss: () => void;
  onViewFull: () => void;
};

function Stat({ label, value }: { label: string; value: string }) {
  const themes = useTheme();
  const styles = createStyles(themes);
  return <View style={styles.stat}><Text style={styles.statLabel}>{label}</Text><Text style={styles.statValue}>{value}</Text></View>;
}

export default function SessionSummaryModal({ visible, session, onClose, onDismiss, onViewFull }: Props) {
  const themes = useTheme();
  const styles = createStyles(themes);
  const summary = session?.summary;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close session summary" />
        <View style={styles.card} accessibilityViewIsModal>
          <View style={styles.handle} />
          <Text style={styles.eyebrow}>SESSION SAVED</Text>
          <Text style={styles.title}>{session?.seatLabel ?? "Seat"}</Text>
          <Text style={styles.subtitle}>{session?.occupant.displayName ?? "Passenger"} · {session ? formatSessionDuration(session.startedAt, session.endedAt) : "—"}</Text>

          <View style={styles.statGrid}>
            <Stat label="Average HR" value={summary?.heartRate ? `${summary.heartRate.average} bpm` : "No reading"} />
            <Stat label="Average RR" value={summary?.respirationRate ? `${summary.respirationRate.average} /min` : "No reading"} />
            <Stat label="Surface temp." value={summary?.surfaceTemperature ? `${summary.surfaceTemperature.average.toFixed(1)} °C` : "No reading"} />
            <Stat label="Movement activity" value={summary?.activityLabel ?? "No data"} />
          </View>

          <View style={styles.eventLine}>
            <Text style={styles.eventLabel}>Verification events</Text><Text style={styles.eventValue}>{summary?.verificationEvents ?? 0}</Text>
          </View>
          <View style={styles.eventLine}>
            <Text style={styles.eventLabel}>Warning / emergency events</Text><Text style={styles.eventValue}>{(summary?.warningEvents ?? 0) + (summary?.emergencyEvents ?? 0)}</Text>
          </View>

          {!session?.hardwareLinked ? <Text style={styles.note}>No sensor was linked to this seat in the current prototype, so physiological readings are not available for this session.</Text> : null}
          <Text style={styles.note}>Camera images and video are never included in passenger session history.</Text>

          <Pressable onPress={onViewFull} style={({ pressed }) => [styles.primaryButton, pressed && { opacity: 0.78 }]}>
            <Text style={styles.primaryText}>See Session Detail</Text>
          </Pressable>
          <Pressable onPress={onDismiss} style={({ pressed }) => [styles.secondaryButton, pressed && { opacity: 0.78 }]}>
            <Text style={styles.secondaryText}>Dismiss</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (themes: ThemePalette) => StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.48)" },
  card: { backgroundColor: themes.backgroundElevated, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 22, gap: 11, borderWidth: 1, borderColor: themes.divider },
  handle: { width: 42, height: 4, borderRadius: 2, backgroundColor: themes.divider, alignSelf: "center", marginBottom: 3 },
  eyebrow: { color: themes.primaryBttn, fontSize: 10.5, letterSpacing: 1.15, fontFamily: "Body-Bold" },
  title: { color: themes.text, fontSize: 23, lineHeight: 28, fontFamily: "Logo-Font" },
  subtitle: { color: themes.textSecondary, fontSize: 13, lineHeight: 18, fontFamily: "Body-Medium" },
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 2 },
  stat: { width: "48.5%", minHeight: 60, padding: 10, borderRadius: 14, backgroundColor: themes.backgroundElement, borderWidth: 1, borderColor: themes.divider, gap: 4, justifyContent: "center" },
  statLabel: { color: themes.textMuted, fontSize: 10.5, fontFamily: "Body-Medium" },
  statValue: { color: themes.text, fontSize: 14, lineHeight: 18, fontFamily: "Body-Bold" },
  eventLine: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingVertical: 5 },
  eventLabel: { color: themes.textSecondary, fontSize: 12, fontFamily: "Body-Regular" },
  eventValue: { color: themes.text, fontSize: 13, fontFamily: "Body-Bold" },
  note: { color: themes.textMuted, fontSize: 10.8, lineHeight: 16, fontFamily: "Body-Regular" },
  primaryButton: { minHeight: 47, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: themes.primaryBttn, marginTop: 2 },
  primaryText: { color: themes.primaryBttnText, fontSize: 14, fontFamily: "Body-Bold" },
  secondaryButton: { minHeight: 44, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: themes.backgroundElement, borderWidth: 1, borderColor: themes.divider },
  secondaryText: { color: themes.textSecondary, fontSize: 13.5, fontFamily: "Body-Bold" },
});
