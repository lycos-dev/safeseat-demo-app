import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { type ThemePalette } from "@/constants/theme";
import { useSafeSeatHub } from "@/hooks/safeseat-hub-context";
import { useTheme } from "@/hooks/use-theme";
import {
  setSafeSeatControlledCameraMode,
  type SafeSeatControlledCameraMode,
} from "@/services/safeseat-hub";

type Props = {
  visible: boolean;
  role: string;
  name: string;
  isHardwareSeat: boolean;
  active: boolean;
  updatedSeconds: number | null;
  fusionLabel: string;
  heartRateBpm: number | null;
  respirationRateBpm: number | null;
  surfaceTemperatureC: number | null;
  occupancyLabel: string;
  movementLabel: string;
  cameraLabel: string;
  onClose: () => void;
};

function Reading({ label, value }: { label: string; value: string }) {
  const themes = useTheme();
  const styles = createStyles(themes);
  return <View style={styles.reading}><Text style={styles.readingLabel}>{label}</Text><Text style={styles.readingValue}>{value}</Text></View>;
}


function CameraReading({
  value,
  onHiddenMode,
}: {
  value: string;
  onHiddenMode: (mode: SafeSeatControlledCameraMode) => void;
}) {
  const themes = useTheme();
  const styles = createStyles(themes);

  return (
    <View style={styles.reading}>
      <Text style={styles.readingLabel}>Camera verification</Text>
      <Text style={styles.readingValue}>{value}</Text>

      {/* Research/UAT fallback: intentionally invisible.
          Left third = UPRIGHT, middle third = REAL CAMERA, right third =
          NON-UPRIGHT. The handler itself refuses to act unless Controlled UAT
          is already active on the Main Hub. */}
      <View style={styles.hiddenCameraZones} pointerEvents="box-none">
        <Pressable
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          style={styles.hiddenCameraZone}
          onPress={() => onHiddenMode("upright")}
        />
        <Pressable
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          style={styles.hiddenCameraZone}
          onPress={() => onHiddenMode("real")}
        />
        <Pressable
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          style={styles.hiddenCameraZone}
          onPress={() => onHiddenMode("non_upright")}
        />
      </View>
    </View>
  );
}

export default function LiveSeatDetailModal({
  visible,
  role,
  name,
  isHardwareSeat,
  active,
  updatedSeconds,
  fusionLabel,
  heartRateBpm,
  respirationRateBpm,
  surfaceTemperatureC,
  occupancyLabel,
  movementLabel,
  cameraLabel,
  onClose,
}: Props) {
  const themes = useTheme();
  const styles = createStyles(themes);
  const { refresh } = useSafeSeatHub();
  const freshness = updatedSeconds === null ? "No live update" : `Updated ${updatedSeconds}s ago`;

  const triggerHiddenCameraMode = (mode: SafeSeatControlledCameraMode) => {
    // No menu, badge, toast, or visible UAT indicator is shown. A single tap
    // on the hidden zone sends the selected result to the Main Hub only when
    // Controlled UAT is already active.
    void (async () => {
      try {
        const applied = await setSafeSeatControlledCameraMode(mode);
        if (!applied) return;
        void Haptics.selectionAsync().catch(() => undefined);
        await refresh();
      } catch (error) {
        console.warn("SafeSeat hidden camera control was not applied:", error);
      }
    })();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close live seat detail" />
        <View style={styles.card} accessibilityViewIsModal>
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>LIVE MONITORING</Text>
              <Text style={styles.title}>{role}</Text>
              <Text style={styles.name}>{name}</Text>
            </View>
            <View style={[styles.livePill, (!active || !isHardwareSeat) && styles.livePillMuted]}>
              <View style={[styles.dot, (!active || !isHardwareSeat) && styles.dotMuted]} />
              <Text style={[styles.liveText, (!active || !isHardwareSeat) && styles.liveTextMuted]}>{active && isHardwareSeat ? "ACTIVE" : "NO LIVE SENSOR"}</Text>
            </View>
          </View>

          {isHardwareSeat ? (
            <>
              <Text style={styles.freshness}>{freshness}</Text>
              <View style={styles.readingGrid}>
                <Reading label="Heart rate" value={heartRateBpm === null ? "—" : `${heartRateBpm} bpm`} />
                <Reading label="Respiration rate" value={respirationRateBpm === null ? "—" : `${respirationRateBpm} /min`} />
                <Reading label="Surface temperature" value={surfaceTemperatureC === null ? "—" : `${surfaceTemperatureC.toFixed(1)} °C`} />
                <Reading label="Seat occupancy" value={occupancyLabel} />
                <Reading label="Movement activity" value={movementLabel} />
                <CameraReading value={cameraLabel} onHiddenMode={triggerHiddenCameraMode} />
              </View>
              <View style={styles.fusionRow}>
                <Text style={styles.fusionLabel}>SafeSeat state</Text>
                <Text style={styles.fusionValue}>{fusionLabel}</Text>
              </View>
            </>
          ) : (
            <View style={styles.notice}>
              <Ionicons name="hardware-chip-outline" size={22} color={themes.textSecondary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.noticeTitle}>No SafeSeat sensor linked</Text>
                <Text style={styles.noticeText}>This passenger can have an independent ride session, but live HR, RR, surface temperature, movement, and verification data are only available for the hardware-linked seat in the current prototype.</Text>
              </View>
            </View>
          )}

          <Text style={styles.privacy}>No camera image or video is shown or stored here.</Text>
          <Pressable onPress={onClose} style={({ pressed }) => [styles.closeButton, pressed && { opacity: 0.75 }]}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (themes: ThemePalette) => StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.48)" },
  card: { backgroundColor: themes.backgroundElevated, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 22, gap: 14, borderWidth: 1, borderColor: themes.divider },
  handle: { width: 42, height: 4, borderRadius: 2, backgroundColor: themes.divider, alignSelf: "center", marginBottom: 2 },
  headerRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  eyebrow: { color: themes.primaryBttn, fontSize: 10.5, letterSpacing: 1.15, fontFamily: "Body-Bold" },
  title: { color: themes.text, fontSize: 22, lineHeight: 28, fontFamily: "Logo-Font", marginTop: 2 },
  name: { color: themes.textSecondary, fontSize: 13, lineHeight: 18, fontFamily: "Body-Medium", marginTop: 2 },
  livePill: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: themes.primarySoft, borderWidth: 1, borderColor: themes.primaryBorder },
  livePillMuted: { backgroundColor: themes.surfaceSoft, borderColor: themes.divider },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: themes.primaryBttn },
  dotMuted: { backgroundColor: themes.textMuted },
  liveText: { color: themes.primaryBttn, fontSize: 9.5, letterSpacing: 0.65, fontFamily: "Body-Bold" },
  liveTextMuted: { color: themes.textMuted },
  freshness: { color: themes.textMuted, fontSize: 11.5, fontFamily: "Body-Regular" },
  readingGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  reading: { width: "48.5%", minHeight: 62, padding: 11, borderRadius: 14, borderWidth: 1, borderColor: themes.divider, backgroundColor: themes.backgroundElement, justifyContent: "center", gap: 4 },
  readingLabel: { color: themes.textMuted, fontSize: 10.5, lineHeight: 14, fontFamily: "Body-Medium" },
  readingValue: { color: themes.text, fontSize: 15, lineHeight: 19, fontFamily: "Body-Bold" },
  hiddenCameraZones: { ...StyleSheet.absoluteFillObject, flexDirection: "row" },
  hiddenCameraZone: { flex: 1, backgroundColor: "transparent" },
  fusionRow: { minHeight: 48, borderRadius: 14, backgroundColor: themes.primarySoft, borderWidth: 1, borderColor: themes.primaryBorder, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  fusionLabel: { color: themes.textSecondary, fontSize: 12, fontFamily: "Body-Medium" },
  fusionValue: { color: themes.primaryBttn, fontSize: 13, fontFamily: "Body-Bold" },
  notice: { flexDirection: "row", gap: 12, padding: 14, borderRadius: 16, backgroundColor: themes.surfaceSoft, borderWidth: 1, borderColor: themes.divider },
  noticeTitle: { color: themes.text, fontSize: 14, lineHeight: 19, fontFamily: "Body-Bold" },
  noticeText: { color: themes.textSecondary, fontSize: 12, lineHeight: 18, fontFamily: "Body-Regular", marginTop: 3 },
  privacy: { color: themes.textMuted, fontSize: 11, lineHeight: 16, fontFamily: "Body-Regular" },
  closeButton: { minHeight: 46, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: themes.backgroundElement, borderWidth: 1, borderColor: themes.divider },
  closeText: { color: themes.text, fontSize: 14, fontFamily: "Body-Bold" },
});
