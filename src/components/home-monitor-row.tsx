import { type ThemePalette } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { useRef } from "react";
import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";

export type MonitorSeatState =
  | "empty"
  | "assigned"
  | "safe"
  | "warning"
  | "emergency"
  | "unknown"
  | "consent"
  | "declined"
  | "offline"
  | "ready"
  | "monitoring"
  | "ended";

export type MonitorVitals = {
  trusted: boolean;
  heartRateBpm: number | null;
  respirationRateBpm: number | null;
  statusLabel: "LIVE" | "REACQUIRING" | "UNAVAILABLE";
};

type Props = {
  seatNo: number;
  role: string;
  name?: string;
  photo?: string;
  state: MonitorSeatState;
  isHardwareSeat?: boolean;
  vitals?: MonitorVitals;
  onPress?: () => void;
  onLongPress?: () => void;
  delayLongPress?: number;
  freshnessSeconds?: number | null;
  detailText?: string;
};

type StateMeta = {
  label: string;
  hint?: string;
  symbol: string;
  color: string;
};

const stateMeta = (
  themes: ThemePalette,
  state: MonitorSeatState,
  isHardwareSeat: boolean,
): StateMeta => {
  if ((state === "offline" || state === "assigned") && !isHardwareSeat) {
    return { label: "NOT MONITORED", hint: "Assigned · No sensor", symbol: "—", color: themes.textMuted };
  }

  switch (state) {
    case "safe":
      return { label: "SAFE", hint: "No unusual signs", symbol: "✓", color: themes.green };
    case "warning":
      return { label: "WARNING", hint: "Check passenger", symbol: "!", color: themes.lightOrange };
    case "emergency":
      return { label: "EMERGENCY", hint: "Check passenger now", symbol: "!!", color: themes.warnBttn };
    case "unknown":
      return { label: "ANALYZING", hint: "Checking sensors", symbol: "…", color: themes.info };
    case "consent":
      return { label: "CONSENT", hint: "Action needed", symbol: "?", color: themes.lightOrange };
    case "declined":
      return { label: "DECLINED", hint: "Not monitored", symbol: "×", color: themes.warnBttn };
    case "offline":
      return { label: "OFFLINE", hint: "Check connection", symbol: "—", color: themes.textMuted };
    case "ready":
      return { label: "READY", symbol: "✓", color: themes.primaryBttn };
    case "monitoring":
      return { label: "MONITORING", symbol: "●", color: themes.primaryBttn };
    case "assigned":
      return { label: "ASSIGNED", symbol: "✓", color: themes.primaryBttn };
    case "ended":
      return { label: "ENDED", hint: "Session saved", symbol: "✓", color: themes.info };
    default:
      return { label: "EMPTY", hint: "Tap to assign", symbol: "+", color: themes.textMuted };
  }
};

export default function HomeMonitorRow({
  seatNo, role, name, photo, state, isHardwareSeat = false, vitals, onPress, onLongPress, delayLongPress, freshnessSeconds, detailText,
}: Props) {
  const themes = useTheme();
  const { width, height } = useWindowDimensions();
  const compact = height < 720;
  const styles = createStyles(themes);
  const meta = stateMeta(themes, state, isHardwareSeat);
  const longPressConsumed = useRef(false);
  const displayName = name || "Unassigned";
  const showVitals = isHardwareSeat && (state === "safe" || state === "warning" || state === "emergency" || state === "unknown" || state === "monitoring");
  const freshness = freshnessSeconds === null || freshnessSeconds === undefined ? "" : ` · LIVE ${freshnessSeconds}s`;
  const liveLine = vitals?.trusted
    ? `HR ${vitals.heartRateBpm ?? "—"} · RR ${vitals.respirationRateBpm ?? "—"}${freshness}`
    : `${vitals?.statusLabel === "REACQUIRING" ? "Vitals reacquiring" : "Vitals unavailable"}${freshness}`;
  const roleLabel = seatNo === 1 ? "DRIVER" : role.toUpperCase();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${role}, ${displayName}, ${meta.label}`}
      accessibilityHint={onLongPress ? "Tap for seat details. Press and hold for researcher control." : "Opens seat details or setup"}
      onPressIn={() => { longPressConsumed.current = false; }}
      onPress={() => {
        if (longPressConsumed.current) {
          longPressConsumed.current = false;
          return;
        }
        onPress?.();
      }}
      onLongPress={onLongPress ? () => {
        longPressConsumed.current = true;
        onLongPress();
      } : undefined}
      delayLongPress={delayLongPress}
      style={({ pressed }) => [styles.row, compact && styles.compactRow,
        { borderColor: `${meta.color}50` }, pressed && { opacity: 0.8 }]}
    >
      <View pointerEvents="none" style={[styles.rail, { backgroundColor: meta.color }]} />
      <View style={styles.identity}>
        {width >= 380 && !compact ? (photo ?
          <Image source={{ uri: photo }} style={styles.avatar} /> :
          <View style={[styles.avatar, styles.avatarFallback]}><Text maxFontSizeMultiplier={1.2} style={styles.initial}>{name ? name.charAt(0).toUpperCase() : seatNo}</Text></View>
        ) : null}
        <View style={styles.person}>
          <Text maxFontSizeMultiplier={1.2} numberOfLines={1} style={styles.role}>{roleLabel}</Text>
          <Text maxFontSizeMultiplier={1.2} numberOfLines={1} style={[styles.name, compact && { fontSize: 15, lineHeight: 19 }, !name && { color: themes.textMuted }]}>{displayName}</Text>
        </View>
      </View>
      <View style={styles.status}>
        <Text maxFontSizeMultiplier={1.15} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.85} style={[styles.state, { color: meta.color }, compact && { fontSize: 17, lineHeight: 20 }]}>{meta.label}</Text>
        {showVitals ? <Text maxFontSizeMultiplier={1.1} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={styles.vitals}>{liveLine}</Text> : null}
        {!showVitals && detailText ? <Text maxFontSizeMultiplier={1.1} numberOfLines={1} style={styles.vitals}>{detailText}</Text> : null}
      </View>
    </Pressable>
  );
}

const createStyles = (themes: ThemePalette) => StyleSheet.create({
  row: { flex: 1, minHeight: 0, width: "100%", flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, paddingLeft: 15, paddingRight: 12, borderRadius: 17, borderWidth: 1, overflow: "hidden", backgroundColor: themes.backgroundElement },
  compactRow: { paddingVertical: 4, paddingLeft: 13, paddingRight: 10, gap: 8 },
  rail: { position: "absolute", top: 0, bottom: 0, left: 0, width: 4 },
  identity: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 9 },
  person: { flex: 1, minWidth: 0, gap: 4 },
  role: { color: themes.textSecondary, fontSize: 10, lineHeight: 12, letterSpacing: 0.45, fontFamily: "Body-Bold" },
  name: { color: themes.text, fontSize: 17, lineHeight: 21, fontFamily: "Body-Bold" },
  avatar: { width: 32, height: 32, borderRadius: 11 },
  avatarFallback: { alignItems: "center", justifyContent: "center", backgroundColor: themes.surfaceSoft, borderWidth: 1, borderColor: themes.divider },
  initial: { color: themes.textSecondary, fontSize: 13, fontFamily: "Body-Bold" },
  status: { flex: 0.85, minWidth: 0, alignItems: "flex-end", justifyContent: "center", gap: 3 },
  state: { width: "100%", textAlign: "right", fontSize: 19, lineHeight: 22, fontFamily: "Body-Bold" },
  vitals: { color: themes.textSecondary, fontSize: 10, lineHeight: 12, fontFamily: "Body-Medium" },
});
