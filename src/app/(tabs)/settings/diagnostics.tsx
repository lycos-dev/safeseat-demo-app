import Button from "@/components/button";
import { FontSize as fontsize, Spacing as spacing, type ThemePalette } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { auth, db } from "@/firebase";
import { useSafeSeatHub } from "@/hooks/safeseat-hub-context";
import { SafeSeatStatusPayload, sensorHealthLabel } from "@/services/safeseat-hub";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { getLocalValue, setLocalValue, deleteLocalValue } from "@/services/local-storage";
import { doc, getDoc } from "firebase/firestore";
import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

type CheckState = "idle" | "checking" | "ready" | "attention";
type Level = "ready" | "attention" | "offline";

type AppCheck = {
  label: string;
  value: string;
  state: "ready" | "attention";
};

type HardwareCheck = {
  id: string;
  label: string;
  detail: string;
  value: string;
  level: Level;
};

function combineLevels(...levels: Level[]): Level {
  if (levels.every((level) => level === "ready")) return "ready";
  if (levels.every((level) => level === "offline")) return "offline";
  return "attention";
}

function hardwareChecks(status: SafeSeatStatusPayload | null): HardwareCheck[] {
  if (!status) {
    return [
      { id: "HUB", label: "Main Hub", detail: "Local API at 192.168.4.1", value: "Not connected", level: "offline" },
      { id: "M1", label: "Headrest", detail: "C1001 + MLX90614", value: "Awaiting Hub", level: "offline" },
      { id: "M2", label: "Backrest", detail: "FSR pressure array", value: "Awaiting Hub", level: "offline" },
      { id: "M3", label: "Cushion", detail: "FSR pressure array", value: "Awaiting Hub", level: "offline" },
      { id: "M4", label: "Seat Frame", detail: "MPU6050 motion context", value: "Awaiting Hub", level: "offline" },
      { id: "CAM", label: "Camera", detail: "Event-triggered posture verification", value: "Awaiting Hub", level: "offline" },
    ];
  }

  const c1001 = status.sensors?.c1001;
  const mlx = status.sensors?.mlx90614;
  const fsr = status.sensors?.fsr;
  const mpu = status.sensors?.mpu6050;
  const camera = status.camera;

  const c1001Health = sensorHealthLabel(Boolean(c1001?.connected && !c1001?.stale), c1001?.health);
  const mlxHealth = sensorHealthLabel(mlx?.connected, mlx?.health, mlx?.valid !== false);
  const headrestLevel = combineLevels(c1001Health.level, mlxHealth.level);
  const headrestValue = headrestLevel === "ready"
    ? "Operational"
    : headrestLevel === "offline"
      ? "Not detected"
      : `${c1001Health.label} / ${mlxHealth.label}`;

  const fsrHealth = sensorHealthLabel(fsr?.connected, fsr?.health, Boolean(fsr?.calibrated));
  const mpuHealth = sensorHealthLabel(mpu?.connected, mpu?.health, mpu?.valid !== false);

  const cameraConnected = Boolean(camera?.transport_connected && !camera?.stale);
  const cameraReady = Boolean(camera?.camera_ready && camera?.model_ready && camera?.psram_ready);
  const cameraLevel: Level = !cameraConnected ? "offline" : cameraReady ? "ready" : "attention";
  const cameraValue = !cameraConnected ? "Not detected" : cameraReady ? "Operational" : "Initializing";

  return [
    {
      id: "HUB",
      label: "Main Hub",
      detail: status.network?.ssid ? `${status.network.ssid} · ${status.network.ip ?? "192.168.4.1"}` : "Local telemetry API",
      value: status.telemetry_ready ? "Connected" : "Warming up",
      level: status.telemetry_ready ? "ready" : "attention",
    },
    {
      id: "M1",
      label: "Headrest",
      detail: `C1001: ${c1001Health.label} · MLX: ${mlxHealth.label}`,
      value: headrestValue,
      level: headrestLevel,
    },
    {
      id: "M2",
      label: "Backrest",
      detail: fsr?.calibrated ? "FSR array calibrated" : "FSR array / baseline",
      value: fsrHealth.label,
      level: fsrHealth.level,
    },
    {
      id: "M3",
      label: "Cushion",
      detail: fsr?.calibrated ? "FSR array calibrated" : "FSR array / baseline",
      value: fsrHealth.label,
      level: fsrHealth.level,
    },
    {
      id: "M4",
      label: "Seat Frame",
      detail: "MPU6050 road-motion context",
      value: mpuHealth.label,
      level: mpuHealth.level,
    },
    {
      id: "CAM",
      label: "Camera",
      detail: camera?.baseline_ready
        ? "Pose model ready · occupant baseline ready"
        : cameraConnected
          ? "Pose model transport connected"
          : "Event-triggered posture verification",
      value: cameraValue,
      level: cameraLevel,
    },
  ];
}

function levelColor(level: Level, themes: ThemePalette) {
  if (level === "ready") return themes.primaryBttn;
  if (level === "attention") return themes.lightOrange;
  return themes.textMuted;
}

export default function Diagnostics() {

  const themes = useTheme();
  const styles = createStyles(themes);  const insets = useSafeAreaInsets();
  const {
    connected: hubConnected,
    telemetryReady,
    status,
    lastUpdatedAt,
    refresh,
    hubUrl,
  } = useSafeSeatHub();

  const [state, setState] = useState<CheckState>("idle");
  const [checks, setChecks] = useState<AppCheck[]>([]);
  const [summary, setSummary] = useState("Live hardware health appears automatically when this phone reaches the SafeSeat Main Hub.");

  const modules = useMemo(() => hardwareChecks(hubConnected ? status : null), [hubConnected, status]);
  const hardwareAttention = modules.some((module) => module.level !== "ready");

  const runDiagnostic = async () => {
    if (state === "checking") return;

    setState("checking");
    setChecks([]);
    setSummary("Checking the app layer and refreshing Main Hub telemetry…");
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const nextChecks: AppCheck[] = [];
    const refreshedHub = await refresh();

    const currentUser = auth.currentUser;
    nextChecks.push({
      label: "Signed-in session",
      value: currentUser ? "Available" : "Sign in required",
      state: currentUser ? "ready" : "attention",
    });

    try {
      await AsyncStorage.getItem("seatAssignments");
      nextChecks.push({ label: "Session storage", value: "Available", state: "ready" });
    } catch {
      nextChecks.push({ label: "Session storage", value: "Needs attention", state: "attention" });
    }

    try {
      await getLocalValue("is_logged_in");
      nextChecks.push({ label: "Protected session storage", value: "Available", state: "ready" });
    } catch {
      nextChecks.push({ label: "Protected session storage", value: "Needs attention", state: "attention" });
    }

    nextChecks.push({
      label: "SafeSeat Main Hub",
      value: refreshedHub ? (refreshedHub.telemetry_ready ? "Reachable" : "Warming up") : "Not reachable",
      state: refreshedHub?.telemetry_ready ? "ready" : "attention",
    });

    if (currentUser) {
      try {
        await getDoc(doc(db, "users", currentUser.uid));
        nextChecks.push({ label: "Firebase account sync", value: "Reachable", state: "ready" });
      } catch {
        // Cloud connectivity is not required for the local Main Hub monitoring
        // path, so this is reported without blocking the local safety UI.
        nextChecks.push({ label: "Firebase account sync", value: "Offline / cellular unavailable", state: "attention" });
      }
    } else {
      nextChecks.push({ label: "Firebase account sync", value: "Skipped", state: "attention" });
    }

    const hasAttention = nextChecks.some((check) => check.state === "attention");
    setChecks(nextChecks);
    setState(hasAttention ? "attention" : "ready");
    setSummary(
      refreshedHub?.telemetry_ready
        ? "The Main Hub is live. Hardware rows below are now based on real runtime telemetry, not placeholders."
        : "The app is running, but the Main Hub is not yet delivering ready telemetry. Connect to the SafeSeat Wi-Fi and check the hardware power/link state.",
    );

    void Haptics.notificationAsync(
      hasAttention ? Haptics.NotificationFeedbackType.Warning : Haptics.NotificationFeedbackType.Success,
    );
  };

  const liveSummaryTitle = hubConnected
    ? telemetryReady
      ? hardwareAttention
        ? "Hub live · check modules"
        : "System link ready"
      : "Hub connected · warming"
    : state === "checking"
      ? "Running checks"
      : "Main Hub not connected";

  return (
    <SafeAreaView style={styles.screen} edges={["left", "right", "bottom"]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: 84 + insets.bottom }]}
      >
        <View style={styles.headerBlock}>
          <Text style={styles.eyebrow}>SYSTEM CHECK</Text>
          <Text style={styles.pageHeader}>Self-Diagnostic</Text>
          <Text style={styles.intro}>
            Main Hub and module health come from the deployed SafeSeat runtime. App/cloud checks are shown separately so an internet issue is never confused with a local hardware failure.
          </Text>
        </View>

        <View style={styles.summaryCard}>
          <View
            style={[
              styles.summaryDot,
              { backgroundColor: hubConnected ? (telemetryReady ? themes.primaryBttn : themes.lightOrange) : themes.textMuted },
            ]}
          />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.summaryTitle}>{liveSummaryTitle}</Text>
            <Text style={styles.summaryText}>{summary}</Text>
            <Text style={styles.endpointText}>{hubUrl}</Text>
          </View>
          <View style={[styles.livePill, hubConnected && styles.livePillConnected]}>
            <Text style={[styles.livePillText, hubConnected && styles.livePillTextConnected]}>
              {hubConnected ? "LIVE" : "OFFLINE"}
            </Text>
          </View>
        </View>

        <Button
          label={state === "checking" ? "Running Diagnostic…" : "Run System Self-Diagnostic"}
          onPress={() => void runDiagnostic()}
          loading={state === "checking"}
          fullWidth
        />

        {checks.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>APP & SERVICE CHECKS</Text>
            <View style={styles.listCard}>
              {checks.map((check, index) => (
                <View key={check.label} style={[styles.row, index === checks.length - 1 && styles.lastRow]}>
                  <View style={[styles.statusDot, { backgroundColor: check.state === "ready" ? themes.primaryBttn : themes.lightOrange }]} />
                  <Text style={styles.rowLabel}>{check.label}</Text>
                  <Text style={[styles.rowValue, { color: check.state === "ready" ? themes.primaryBttn : themes.lightOrange }]}>
                    {check.value}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>LIVE HARDWARE</Text>
            <View style={[styles.pendingPill, hubConnected && styles.pendingPillLive]}>
              <Text style={[styles.pendingPillText, hubConnected && styles.pendingPillTextLive]}>
                {hubConnected ? "MAIN HUB" : "AWAITING HUB"}
              </Text>
            </View>
          </View>

          <View style={styles.moduleStack}>
            {modules.map((module) => (
              <View key={module.id} style={styles.moduleCard}>
                <View style={[styles.moduleId, { borderColor: levelColor(module.level, themes) }]}>
                  <Text style={[styles.moduleIdText, { color: levelColor(module.level, themes) }]}>{module.id}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.moduleTitle}>{module.label}</Text>
                  <Text style={styles.moduleDetail}>{module.detail}</Text>
                </View>
                <Text style={[styles.moduleStatus, { color: levelColor(module.level, themes) }]}>{module.value}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.noticeCard}>
          <Text style={styles.noticeTitle}>Integration rule</Text>
          <Text style={styles.noticeText}>
            Live mode follows the Main Hub&apos;s authoritative Fusion result. Routine WATCH checks stay quietly SAFE. After a real WARNING or EMERGENCY, WATCH is shown as a short MONITORING recovery phase until Fusion returns SAFE.
          </Text>
          {lastUpdatedAt && (
            <Text style={styles.lastUpdatedText}>Last hub update: {new Date(lastUpdatedAt).toLocaleTimeString()}</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (themes: ThemePalette) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: themes.background },
  content: { paddingHorizontal: spacing.two, paddingTop: spacing.six, gap: spacing.two },
  headerBlock: { gap: spacing.half, marginBottom: spacing.one },
  eyebrow: { color: themes.primaryBttn, fontSize: 11, letterSpacing: 1.4, fontFamily: "Body-Bold" },
  pageHeader: { color: themes.text, fontSize: fontsize.pageHeader, fontFamily: "Logo-Font" },
  intro: { color: themes.textSecondary, fontSize: 14, lineHeight: 20, fontFamily: "Body-Regular" },
  summaryCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.one,
    padding: spacing.two,
    borderRadius: 18,
    backgroundColor: themes.backgroundElement,
    borderWidth: 1,
    borderColor: themes.divider,
  },
  summaryDot: { width: 11, height: 11, borderRadius: 6, marginTop: 5 },
  summaryTitle: { color: themes.text, fontSize: fontsize.body, fontFamily: "Body-Bold" },
  summaryText: { color: themes.textSecondary, fontSize: fontsize.caption, lineHeight: 18, marginTop: spacing.half, fontFamily: "Body-Regular" },
  endpointText: { color: themes.textMuted, fontSize: 10, marginTop: 5, fontFamily: "Body-Medium" },
  livePill: {
    paddingHorizontal: spacing.one,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: themes.surfaceSoft,
    borderWidth: 1,
    borderColor: themes.divider,
  },
  livePillConnected: { backgroundColor: themes.primarySoft, borderColor: themes.primaryBorder },
  livePillText: { color: themes.textMuted, fontSize: 9, letterSpacing: 0.8, fontFamily: "Body-Bold" },
  livePillTextConnected: { color: themes.primaryBttn },
  section: { gap: spacing.one, marginTop: spacing.one },
  sectionHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.one },
  sectionTitle: { color: themes.textMuted, fontSize: 11, fontFamily: "Body-Bold", letterSpacing: 1.2 },
  listCard: { borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: themes.divider, backgroundColor: themes.backgroundElement },
  row: { minHeight: 54, flexDirection: "row", alignItems: "center", gap: spacing.one, paddingHorizontal: spacing.two, borderBottomWidth: 1, borderBottomColor: themes.divider },
  lastRow: { borderBottomWidth: 0 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  rowLabel: { flex: 1, color: themes.text, fontSize: 14, fontFamily: "Body-Medium" },
  rowValue: { maxWidth: "44%", textAlign: "right", fontSize: fontsize.caption, fontFamily: "Body-Bold" },
  pendingPill: { paddingHorizontal: spacing.one, paddingVertical: 5, borderRadius: 999, backgroundColor: themes.surfaceSoft, borderWidth: 1, borderColor: themes.divider },
  pendingPillLive: { backgroundColor: themes.primarySoft, borderColor: themes.primaryBorder },
  pendingPillText: { color: themes.textMuted, fontSize: 9, letterSpacing: 0.8, fontFamily: "Body-Bold" },
  pendingPillTextLive: { color: themes.primaryBttn },
  moduleStack: { gap: spacing.one },
  moduleCard: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: spacing.one, padding: spacing.one + 4, borderRadius: 16, backgroundColor: themes.backgroundElement, borderWidth: 1, borderColor: themes.divider },
  moduleId: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: themes.surfaceSoft, borderWidth: 1 },
  moduleIdText: { fontSize: 10, fontFamily: "Body-Bold" },
  moduleTitle: { color: themes.text, fontSize: 14, fontFamily: "Body-Bold" },
  moduleDetail: { color: themes.textSecondary, fontSize: 11, lineHeight: 15, marginTop: 2, fontFamily: "Body-Regular" },
  moduleStatus: { maxWidth: 92, textAlign: "right", fontSize: 10, lineHeight: 14, fontFamily: "Body-Bold" },
  noticeCard: { padding: spacing.two, borderRadius: 18, backgroundColor: themes.surfaceSoft, borderWidth: 1, borderColor: themes.divider },
  noticeTitle: { color: themes.text, fontSize: 14, fontFamily: "Body-Bold" },
  noticeText: { color: themes.textSecondary, fontSize: fontsize.caption, lineHeight: 18, marginTop: spacing.half, fontFamily: "Body-Regular" },
  lastUpdatedText: { color: themes.textMuted, fontSize: 10, marginTop: spacing.one, fontFamily: "Body-Medium" },
});
