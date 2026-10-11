import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import type { ThemePalette } from "@/constants/theme";
import { useSafeSeatHub } from "@/hooks/safeseat-hub-context";
import { useSeatSessions } from "@/hooks/seat-session-context";
import { useTheme } from "@/hooks/use-theme";

/**
 * Driver-facing notice for R5.7 prolonged forward posture.
 * It deliberately does not use Warning/Emergency styling because the Runtime
 * is reporting reduced monitoring reliability, not a confirmed emergency.
 */
export default function MonitoringLimitedNotice() {
  const themes = useTheme();
  const styles = createStyles(themes);
  const { status, seatState } = useSafeSeatHub();
  const { activeSessions } = useSeatSessions();

  const monitoringActive = Object.values(activeSessions).some((session) => session.hardwareLinked);
  const limited = Boolean(status?.system?.monitoring_limited);
  const persistent = Boolean(status?.system?.monitoring_limited_persistent);

  // Confirmed Warning/Emergency UI has priority over the advisory notice.
  if (!monitoringActive || !limited || seatState === "warning" || seatState === "emergency") return null;

  return (
    <View style={styles.notice} accessibilityRole="alert">
      <View style={styles.iconWrap}>
        <Ionicons name="eye-off-outline" size={18} color={themes.lightOrange} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>Monitoring Limited</Text>
        <Text style={styles.message}>
          {persistent
            ? "Passenger has remained forward. Please ask them to sit back normally so SafeSeat can restore reliable monitoring."
            : "Please ask the passenger to sit back normally so SafeSeat can restore reliable monitoring."}
        </Text>
      </View>
    </View>
  );
}

const createStyles = (themes: ThemePalette) => StyleSheet.create({
  notice: {
    marginHorizontal: 16,
    marginBottom: 8,
    minHeight: 62,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: themes.lightOrange,
    backgroundColor: themes.backgroundElement,
    paddingHorizontal: 13,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: themes.surfaceSoft,
  },
  copy: { flex: 1 },
  title: {
    color: themes.lightOrange,
    fontSize: 12.5,
    lineHeight: 17,
    fontFamily: "Body-Bold",
  },
  message: {
    color: themes.textSecondary,
    fontSize: 11.5,
    lineHeight: 16,
    fontFamily: "Body-Regular",
    marginTop: 2,
  },
});
