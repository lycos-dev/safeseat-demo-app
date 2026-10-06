import { Spacing as spacing, type ThemePalette } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { useDriverGuide } from "@/hooks/driver-guide-context";
import * as Haptics from "expo-haptics";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function DriverGuideOverlay() {
  const themes = useTheme();
  const styles = createStyles(themes);
  const {
    active,
    step,
    stepId,
    beginInteractiveGuide,
    exitGuide,
    finishGuide,
  } = useDriverGuide();

  if (!active || !step) return null;

  const isWelcome = stepId === "welcome";
  const isComplete = stepId === "complete";
  const isNativeSheetStep = stepId === "assign" || stepId === "consent";

  // Assignment and consent are taught inside their native sheets so the
  // floating coach never competes with the control the user must press.
  if (isNativeSheetStep) return null;

  const handlePrimary = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isWelcome) beginInteractiveGuide();
    else if (isComplete) void finishGuide();
  };

  const placementStyle = stepId === "dashboard"
    ? styles.coachTop
    : stepId === "seats"
      ? styles.coachBottom
      : stepId === "sensor" || stepId === "start"
        ? styles.coachTop
        : stepId === "alerts"
          ? styles.coachTop
          : styles.coachCenter;

  return (
    <View
      pointerEvents={isWelcome || isComplete ? "auto" : "box-none"}
      style={StyleSheet.absoluteFill}
    >
      {(isWelcome || isComplete) ? <View style={styles.scrim} /> : null}
      <SafeAreaView pointerEvents="box-none" style={styles.safeArea}>
        <View
          pointerEvents="auto"
          style={[
            isWelcome || isComplete ? styles.heroCard : styles.coachCard,
            placementStyle,
          ]}
        >
          <View style={styles.topRow}>
            <View style={styles.badge}>
              <View style={styles.dot} />
              <Text style={styles.eyebrow}>{step.eyebrow}</Text>
            </View>
            {!isWelcome && !isComplete ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Exit SafeSeat guide"
                onPress={() => void exitGuide()}
                hitSlop={10}
              >
                <Text style={styles.exitInline}>EXIT</Text>
              </Pressable>
            ) : null}
          </View>

          <Text style={isWelcome || isComplete ? styles.heroTitle : styles.coachTitle} numberOfLines={2}>
            {step.title}
          </Text>

          {(isWelcome || isComplete) ? (
            <Text style={styles.heroBody}>{step.body}</Text>
          ) : step.actionHint ? (
            <View style={styles.doRow}>
              <View style={styles.doArrow}><Text style={styles.doArrowText}>↓</Text></View>
              <Text style={styles.doText}>{step.actionHint}</Text>
            </View>
          ) : null}

          {(isWelcome || isComplete) ? (
            <View style={styles.heroActions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => void exitGuide()}
                style={({ pressed }) => [styles.skipButton, pressed && styles.pressed]}
              >
                <Text style={styles.skipText}>{isWelcome ? "Skip" : "Close"}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={handlePrimary}
                style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
              >
                <Text style={styles.primaryText}>{isWelcome ? "Start Guide" : "Finish"}</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.waitRow}>
              <View style={styles.waitDot} />
              <Text style={styles.waitText}>Do the highlighted action to continue</Text>
            </View>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const createStyles = (themes: ThemePalette) => StyleSheet.create({
  safeArea: { flex: 1 },
  scrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: themes.mode === "dark" ? "rgba(4,10,20,0.70)" : "rgba(16,32,51,0.28)",
  },
  coachCard: {
    position: "absolute",
    left: spacing.two,
    width: "78%",
    maxWidth: 310,
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: 17,
    backgroundColor: themes.backgroundElevated,
    borderWidth: 1,
    borderColor: "rgba(31,210,149,0.40)",
    shadowColor: "#000",
    shadowOpacity: 0.38,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 7 },
    elevation: 22,
    gap: 6,
  },
  heroCard: {
    position: "absolute",
    left: spacing.two,
    right: spacing.two,
    top: "27%",
    padding: spacing.two,
    borderRadius: 22,
    backgroundColor: themes.backgroundElevated,
    borderWidth: 1,
    borderColor: "rgba(31,210,149,0.44)",
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 24,
    gap: spacing.one,
  },
  coachTop: { top: 10 },
  coachBottom: { bottom: 94 },
  coachCenter: { top: "34%" },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  badge: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: themes.primaryBttn },
  eyebrow: { color: themes.primaryBttn, fontSize: 10.5, letterSpacing: 0.85, fontFamily: "Body-Bold", flexShrink: 1 },
  exitInline: { color: themes.textMuted, fontSize: 10.5, letterSpacing: 0.6, fontFamily: "Body-Bold" },
  coachTitle: { color: themes.text, fontSize: 17, lineHeight: 22, fontFamily: "Body-Bold" },
  heroTitle: { color: themes.text, fontSize: 25, lineHeight: 31, fontFamily: "Body-Bold" },
  heroBody: { color: themes.textSecondary, fontSize: 15, lineHeight: 21, fontFamily: "Body-Regular" },
  doRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  doArrow: { width: 23, height: 23, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: themes.primarySoft, borderWidth: 1, borderColor: themes.primaryBorder },
  doArrowText: { color: themes.primaryBttn, fontSize: 15, lineHeight: 18, fontFamily: "Body-Bold" },
  doText: { flex: 1, color: themes.textSecondary, fontSize: 13.5, lineHeight: 18, fontFamily: "Body-Bold" },
  waitRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingTop: 1 },
  waitDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: themes.primaryBttn },
  waitText: { color: themes.textMuted, fontSize: 11, fontFamily: "Body-Medium" },
  heroActions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.one, marginTop: 2 },
  skipButton: { minHeight: 42, justifyContent: "center", paddingHorizontal: 5 },
  skipText: { color: themes.textMuted, fontSize: 14, fontFamily: "Body-Bold" },
  primaryButton: { minHeight: 44, justifyContent: "center", paddingHorizontal: 19, borderRadius: 13, backgroundColor: themes.primaryBttn },
  primaryText: { color: themes.primaryBttnText, fontSize: 15, fontFamily: "Body-Bold" },
  pressed: { opacity: 0.76, transform: [{ scale: 0.985 }] },
});
