import ThemedHost from "@/components/themed-host";
import checkXml from "@expo/material-symbols/check.xml";
import warningXml from "@expo/material-symbols/warning.xml";
import sirenXml from "@expo/material-symbols/siren.xml";
import circleXml from "@expo/material-symbols/circle.xml";
import { Spacing as spacing, type ThemePalette } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { Host, Icon } from "@expo/ui";
import { useEffect, useRef } from "react";
import { Animated, Easing, Image, Pressable, StyleSheet, Text, View } from "react-native";

export type SeatVitals = {
  trusted: boolean;
  heartRateBpm: number | null;
  respirationRateBpm: number | null;
  statusLabel: "LIVE" | "REACQUIRING" | "UNAVAILABLE";
};

type SeatCardProps = {
  seatNo: number;
  name?: string;
  photo?: string;
  state?: "safe" | "warning" | "emergency" | "empty" | "unknown" | "assigned" | "consent" | "declined" | "offline" | "ready" | "monitoring";
  role?: string;
  onPress: () => void;
  compact?: boolean;
  home?: boolean;
  animationActive?: boolean;
  animationCycle?: number;
  vitals?: SeatVitals;
};

const buildStateMeta = (themes: ThemePalette) => ({
  safe: { label: "SAFE", color: themes.green },
  warning: { label: "WARNING", color: themes.lightOrange },
  emergency: { label: "EMERGENCY", color: themes.warnBttn },
  unknown: { label: "ANALYZING", color: themes.info },
  assigned: { label: "READY", color: themes.primaryBttn },
  consent: { label: "CONSENT NEEDED", color: themes.lightOrange },
  declined: { label: "NOT MONITORED", color: themes.warnBttn },
  offline: { label: "OFFLINE", color: themes.textMuted },
  ready: { label: "READY", color: themes.green },
  monitoring: { label: "MONITORING", color: themes.green },
  empty: { label: "EMPTY", color: themes.textMuted },
} as const);

const stateDescription = {
  safe: "No unusual signs detected",
  warning: "SafeSeat detected something unusual",
  emergency: "May need immediate help",
  unknown: "SafeSeat is still analyzing",
  assigned: "Ready to monitor",
  consent: "Monitoring consent is needed",
  declined: "Consent was declined",
  offline: "SafeSeat is offline for this seat",
  ready: "Ready to monitor",
  monitoring: "Monitoring is active",
  empty: "No one assigned",
} as const;

const getFormattedImageUri = (img?: string) => {
  if (!img || img === "Not Set" || img.trim() === "") return null;
  if (img.startsWith("http") || img.startsWith("data:")) return img;
  return `data:image/jpeg;base64,${img}`;
};

export default function SeatCard({
  seatNo,
  name = "empty",
  photo,
  state = "empty",
  role,
  onPress,
  compact = false,
  home = false,
  animationActive = true,
  animationCycle = 0,
  vitals,
}: SeatCardProps) {
  const themes = useTheme();
  const styles = createStyles(themes);
  const stateMeta = buildStateMeta(themes);
  const meta = stateMeta[state];
  const displayStateLabel = compact && state === "consent"
    ? "CONSENT"
    : compact && state === "declined"
      ? "DECLINED"
      : meta.label;
  const imageUri = getFormattedImageUri(photo);
  const displayName = name === "empty" ? "Empty seat" : name;
  const motion = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    motion.stopAnimation();
    spin.stopAnimation();
    motion.setValue(0);
    spin.setValue(0);

    if (!animationActive) return;

    if (state === "unknown") {
      const spinnerLoop = Animated.loop(
        Animated.timing(spin, {
          toValue: 1,
          duration: 900,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      );
      spinnerLoop.start();
      return () => {
        spinnerLoop.stop();
        spin.setValue(0);
      };
    }

    if (["empty", "assigned", "consent", "declined", "offline", "ready", "monitoring"].includes(state)) return;

    const duration = state === "safe" ? 1500 : state === "warning" ? 760 : 520;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(motion, { toValue: 1, duration, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(motion, { toValue: 0, duration, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
      motion.setValue(0);
    };
  }, [animationActive, animationCycle, motion, spin, state]);

  const stateIcon = state === "safe" || state === "assigned" || state === "ready" || state === "monitoring"
    ? Icon.select({ ios: "checkmark.circle.fill", android: checkXml })
    : state === "warning" || state === "consent" || state === "declined"
      ? Icon.select({ ios: "exclamationmark.triangle.fill", android: warningXml })
      : state === "emergency"
        ? Icon.select({ ios: "light.beacon.max.fill", android: sirenXml })
        : Icon.select({ ios: "circle.dotted", android: circleXml });

  const ringScale = motion.interpolate({ inputRange: [0, 1], outputRange: [0.9, state === "emergency" ? 1.55 : 1.3] });
  const ringOpacity = motion.interpolate({ inputRange: [0, 1], outputRange: [0.32, 0] });
  const spinnerRotation = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${role ?? `Seat ${seatNo}`}, ${displayName}, ${state === "unknown" ? "analyzing" : state === "consent" ? "consent needed" : state}`}
      android_ripple={{ color: themes.primarySoft }}
      style={({ pressed }) => [
        styles.baseCard,
        compact && styles.compactCard,
        home && styles.homeCard,
        state === "empty" && styles.emptySeat,
        pressed && styles.pressed,
        { borderColor: `${meta.color}55` },
      ]}
    >
      <View pointerEvents="none" style={[styles.stateRail, { backgroundColor: meta.color }]} />
      <View pointerEvents="none" style={[styles.cardGlow, { backgroundColor: meta.color }]} />

      <View style={[styles.avatarShell, compact && styles.compactAvatarShell, home && styles.homeAvatarShell, { borderColor: meta.color, backgroundColor: `${meta.color}14` }]}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={[styles.avatar, compact && styles.compactAvatar, home && styles.homeAvatar]} />
        ) : (
          <Text style={[styles.monogram, compact && styles.compactMonogram, home && styles.homeMonogram]}>{state === "empty" ? "–" : displayName.charAt(0).toUpperCase()}</Text>
        )}
      </View>

      <View style={styles.copy}>
        {role ? <Text style={[styles.role, compact && styles.compactRole, home && styles.homeRole]}>{role.toUpperCase()}</Text> : null}
        <Text style={[styles.name, compact && styles.compactName, home && styles.homeName, state === "empty" && styles.emptyName]} numberOfLines={1}>{displayName}</Text>
        {home ? <Text style={[styles.description, { color: state === "empty" ? themes.textMuted : themes.textSecondary }]} numberOfLines={1}>{stateDescription[state]}</Text> : null}
        {home && (state === "warning" || state === "emergency") ? (
          <View style={[styles.vitalsLine, home && styles.homeVitalsLine]}>
            {vitals?.trusted ? (
              <>
                <Text style={[styles.vitalsLabel, home && styles.homeVitalsLabel]}>VITALS</Text>
                <Text style={[styles.vitalValue, home && styles.homeVitalValue]}>HR {vitals.heartRateBpm ?? "—"} bpm</Text>
                <View style={styles.vitalDivider} />
                <Text style={[styles.vitalValue, home && styles.homeVitalValue]}>RR {vitals.respirationRateBpm ?? "—"}/min</Text>
              </>
            ) : (
              <>
                <Text style={[styles.vitalsLabel, home && styles.homeVitalsLabel]}>VITALS</Text>
                <Text style={[styles.vitalsPending, home && styles.homeVitalsPending]}>{vitals?.statusLabel === "UNAVAILABLE" ? "Unavailable" : "Reacquiring signal"}</Text>
              </>
            )}
          </View>
        ) : null}
      </View>

      <View style={[styles.rightSide, compact && styles.compactRightSide, home && styles.homeRightSide]}>
        <View style={[styles.statePill, compact && styles.compactStatePill, home && styles.homeStatePill, { borderColor: `${meta.color}66`, backgroundColor: `${meta.color}12` }]}> 
          <View key={`state-visual-${state}-${animationCycle}`} style={[styles.stateIconStage, home && styles.homeStateIconStage]}>
            {state === "unknown" ? (
              <Animated.View
                key={`spinner-${animationCycle}`}
                pointerEvents="none"
                style={[
                  styles.spinner,
                  home && styles.homeSpinner,
                  {
                    borderColor: `${meta.color}38`,
                    borderTopColor: meta.color,
                    transform: [{ rotate: spinnerRotation }],
                  },
                ]}
              />
            ) : state === "empty" ? (
              <View style={[styles.emptyDot, home && styles.homeEmptyDot, { backgroundColor: meta.color }]} />
            ) : (
              <>
                {(state === "safe" || state === "warning" || state === "emergency") ? (
                  <Animated.View
                    key={`pulse-${animationCycle}`}
                    pointerEvents="none"
                    style={[styles.iconPulseRing, home && styles.homeIconPulseRing, { borderColor: meta.color, opacity: ringOpacity, transform: [{ scale: ringScale }] }]}
                  />
                ) : null}
                <View pointerEvents="none" style={[styles.staticStateIcon, home && styles.homeStaticStateIcon]}>
                  <ThemedHost matchContents>
                    <Icon name={stateIcon} color={meta.color} size={home ? 24 : compact ? 14 : 16} />
                  </ThemedHost>
                </View>
              </>
            )}
          </View>
          <Text style={[styles.stateName, compact && styles.compactStateName, home && styles.homeStateName, { color: meta.color }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.78}>{displayStateLabel}</Text>
        </View>
        {!compact && !home ? <Text style={styles.chevron}>›</Text> : null}
      </View>
    </Pressable>
  );
}

const createStyles = (themes: ThemePalette) => StyleSheet.create({
  baseCard: {
    width: "100%",
    minHeight: 80,
    position: "relative",
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.one + 2,
    borderRadius: 21,
    backgroundColor: themes.backgroundElement,
    borderWidth: 1,
    paddingHorizontal: spacing.one + 4,
    paddingVertical: spacing.one,
    shadowColor: themes.primaryBttn,
    shadowOpacity: 0.055,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  stateRail: { position: "absolute", left: 0, top: 15, bottom: 15, width: 3, borderTopRightRadius: 3, borderBottomRightRadius: 3, opacity: 0.9 },
  cardGlow: { position: "absolute", width: 120, height: 120, borderRadius: 60, right: -74, top: -30, opacity: 0.04 },
  avatarShell: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "visible",
  },
  avatar: { width: 40, height: 40, borderRadius: 20, resizeMode: "cover" },
  monogram: { color: themes.text, fontSize: 17, fontFamily: "Body-Bold" },
  copy: { flex: 1, minWidth: 0 },
  role: { color: themes.textSecondary, fontSize: 9.5, letterSpacing: 0.8, fontFamily: "Body-Bold" },
  name: { color: themes.text, fontSize: 17, fontFamily: "Body-Bold", marginTop: 2 },
  emptyName: { color: themes.textMuted },
  rightSide: { flexDirection: "row", alignItems: "center", gap: 7 },
  statePill: { paddingHorizontal: spacing.one + 1, paddingVertical: 7, borderRadius: 999, borderWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.half, minWidth: 84 },
  stateIconStage: { width: 18, height: 18, alignItems: "center", justifyContent: "center", position: "relative" },
  iconPulseRing: { position: "absolute", width: 17, height: 17, borderRadius: 9, borderWidth: 1 },
  staticStateIcon: { width: 18, height: 18, alignItems: "center", justifyContent: "center" },
  spinner: { width: 15, height: 15, borderRadius: 8, borderWidth: 2 },
  emptyDot: { width: 6, height: 6, borderRadius: 3, opacity: 0.7 },
  stateName: { fontSize: 9.5, letterSpacing: 0.45, fontFamily: "Body-Bold" },
  chevron: { color: themes.textMuted, fontSize: 25, lineHeight: 25, fontFamily: "Body-Regular", marginTop: -2 },
  description: { fontSize: 13.5, lineHeight: 17, fontFamily: "Body-Medium", marginTop: 2 },
  vitalsLine: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 3, minHeight: 13 },
  vitalsLabel: { color: themes.textMuted, fontSize: 8.5, letterSpacing: 0.65, fontFamily: "Body-Bold" },
  vitalValue: { color: themes.text, fontSize: 10.5, fontFamily: "Body-Bold" },
  vitalDivider: { width: 2, height: 2, borderRadius: 1, backgroundColor: themes.textMuted, opacity: 0.7 },
  vitalsPending: { color: themes.textSecondary, fontSize: 10.5, fontFamily: "Body-Medium" },
  homeCard: {
    height: "100%",
    minHeight: 0,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 10,
    backgroundColor: themes.backgroundElement,
    shadowOpacity: 0.075,
    shadowRadius: 13,
  },
  homeAvatarShell: { width: 50, height: 50, borderRadius: 16 },
  homeAvatar: { width: 44, height: 44, borderRadius: 14 },
  homeMonogram: { fontSize: 19 },
  homeRole: { fontSize: 11.5, letterSpacing: 0.8 },
  homeName: { fontSize: 20, lineHeight: 23, marginTop: 0 },
  homeRightSide: { gap: 0, flexShrink: 0 },
  homeStatePill: { minWidth: 124, paddingHorizontal: 11, paddingVertical: 9, borderWidth: 1.5, gap: 7 },
  homeStateName: { fontSize: 14.5, lineHeight: 18, letterSpacing: 0.65 },
  homeStateIconStage: { width: 28, height: 28 },
  homeStaticStateIcon: { width: 28, height: 28 },
  homeIconPulseRing: { width: 25, height: 25, borderRadius: 13, borderWidth: 1.5 },
  homeSpinner: { width: 23, height: 23, borderRadius: 12, borderWidth: 3 },
  homeEmptyDot: { width: 10, height: 10, borderRadius: 5 },
  homeVitalsLine: { gap: 6, marginTop: 4, minHeight: 16 },
  homeVitalsLabel: { fontSize: 9.5 },
  homeVitalValue: { fontSize: 12.5 },
  homeVitalsPending: { fontSize: 12 },
  compactCard: { minHeight: 58, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 7, gap: 9 },
  compactAvatarShell: { width: 34, height: 34, borderRadius: 12 },
  compactAvatar: { width: 30, height: 30, borderRadius: 10 },
  compactMonogram: { fontSize: 12 },
  compactRole: { fontSize: 7.5, letterSpacing: 0.55 },
  compactName: { fontSize: 12.5, marginTop: 1 },
  compactRightSide: { gap: 0 },
  compactStatePill: { paddingHorizontal: 8, paddingVertical: 5, gap: 4, minWidth: 80 },
  compactStateName: { fontSize: 7.5, letterSpacing: 0.25 },
  emptySeat: { opacity: 0.72 },
  pressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
});
