import ThemedHost from "@/components/themed-host";
import checkXml from "@expo/material-symbols/check.xml";
import warningXml from "@expo/material-symbols/warning.xml";
import sirenXml from "@expo/material-symbols/siren.xml";
import circleXml from "@expo/material-symbols/circle.xml";
import addXml from "@expo/material-symbols/add.xml";
import { type ThemePalette } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import GuidePulseOverlay from "./guide-pulse-overlay";
import { Host, Icon } from "@expo/ui";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

type Profile = {
  id: string;
  name: string;
  icon?: string;
  isAccountOwner?: boolean;
};

type AssignCardProps = {
  seatNo: number;
  seatCode: string;
  assignedProfile?: Profile | null;
  name?: string;
  pfp?: string;
  locked?: boolean;
  hardwareLinked?: boolean;
  guideActive?: boolean;
  state: string;
  onPress: () => void;
};

const titleCase = (value: string) => value.replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function AssignCard({
  seatCode,
  assignedProfile,
  name,
  pfp,
  state = "empty",
  locked = true,
  hardwareLinked = false,
  guideActive = false,
  onPress,
}: AssignCardProps) {
  const themes = useTheme();
  const styles = createStyles(themes);
  const displayName = assignedProfile?.name ?? name;
  const rawIcon = assignedProfile?.icon ?? pfp;
  const seatLabel = titleCase(seatCode);

  const getFormattedImageUri = (img?: string) => {
    if (!img || img === "Not Set" || img.trim() === "") return null;
    if (img.startsWith("http") || img.startsWith("data:")) return img;
    return `data:image/jpeg;base64,${img}`;
  };

  const imageUri = getFormattedImageUri(rawIcon);
  const stateColor = state === "safe" || state === "ready" || state === "monitoring"
    ? themes.green
    : state === "warning" || state === "consent"
      ? themes.lightOrange
      : state === "emergency" || state === "declined"
        ? themes.warnBttn
        : state === "unknown"
          ? themes.info
          : state === "offline"
            ? themes.textMuted
            : hardwareLinked
              ? themes.primaryBttn
              : "#A8B8C8";

  const stateLabel = state === "safe" ? "SAFE"
    : state === "warning" ? "WARNING"
      : state === "emergency" ? "EMERGENCY"
        : state === "unknown" ? "ANALYZING"
          : state === "consent" ? "CONSENT NEEDED"
            : state === "declined" ? "NOT MONITORED"
              : state === "offline" ? (hardwareLinked ? "OFFLINE" : "NOT MONITORED")
                : state === "ready" ? "READY"
                  : state === "monitoring" ? "MONITORING"
                    : displayName ? (hardwareLinked ? "ASSIGNED" : "NOT MONITORED") : "";

  const stateIcon = state === "safe" || state === "ready" || state === "monitoring"
    ? Icon.select({ ios: "checkmark.circle.fill", android: checkXml })
    : state === "warning" || state === "consent" || state === "declined"
      ? Icon.select({ ios: "exclamationmark.triangle.fill", android: warningXml })
      : state === "emergency"
        ? Icon.select({ ios: "light.beacon.max.fill", android: sirenXml })
        : Icon.select({ ios: "circle.dotted", android: circleXml });

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${seatLabel}: ${displayName ?? "assign a person"}`}
      android_ripple={{ color: "rgba(255,255,255,0.08)" }}
      style={({ pressed }) => [
        styles.baseCard,
        displayName ? styles.assignedCard : styles.emptyCard,
        hardwareLinked && styles.hardwareCard,
        {
          borderColor: stateColor,
          opacity: pressed ? 0.9 : 1,
          transform: [{ scale: pressed ? 0.965 : 1 }],
        },
      ]}
    >
      {displayName ? (
        <View style={styles.profileContainer}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={[styles.avatar, { borderColor: stateColor }]} />
          ) : (
            <View style={[styles.avatarFallback, { borderColor: stateColor }]}> 
              <Text style={styles.monogram}>{displayName.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <Text style={styles.seatLabel} numberOfLines={1}>{seatLabel}</Text>
          <Text style={styles.profileName} numberOfLines={1}>{displayName}</Text>
          {stateLabel ? (
            <View style={styles.compactState}>
              <ThemedHost matchContents><Icon name={stateIcon} color={stateColor} size={13} /></ThemedHost>
              <Text style={[styles.compactStateText, { color: stateColor }]} numberOfLines={1}>{stateLabel}</Text>
            </View>
          ) : (
            <Text style={styles.assignedText}>Assigned</Text>
          )}
        </View>
      ) : (
        <View style={styles.emptyContent}>
          {!locked ? (
            <View style={styles.plusCircle}>
              <ThemedHost matchContents>
                <Icon name={Icon.select({ ios: "plus", android: addXml })} color={themes.text} size={18} />
              </ThemedHost>
            </View>
          ) : null}
          <Text style={[styles.seatLabel, styles.emptySeatLabel]} numberOfLines={2}>{seatLabel}</Text>
          <View style={styles.actionPill}>
            <Text style={styles.actionText}>{locked ? "EMPTY" : "ASSIGN PERSON"}</Text>
          </View>
        </View>
      )}
      <GuidePulseOverlay
        active={guideActive}
        label="TAP SEAT"
        borderRadius={18}
        inset={-3}
        beaconPosition="bottom"
      />
    </Pressable>
  );
}

const createStyles = (themes: ThemePalette) => StyleSheet.create({
  baseCard: {
    flex: 1,
    position: "relative",
    borderRadius: 18,
    borderWidth: 1.25,
    justifyContent: "center",
    alignItems: "center",
    overflow: "visible",
    padding: 6,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  emptyCard: {
    backgroundColor: themes.mode === "dark" ? "rgba(6,14,24,0.34)" : "rgba(255,255,255,0.60)",
    borderColor: themes.mode === "dark" ? "rgba(255,255,255,0.38)" : "rgba(16,32,51,0.26)",
  },
  assignedCard: {
    backgroundColor: themes.cardTranslucent,
  },
  hardwareCard: {
    shadowOpacity: 0.28,
    elevation: 5,
  },
  profileContainer: { alignItems: "center", justifyContent: "center", width: "100%", gap: 2 },
  avatar: { width: 38, height: 38, borderRadius: 19, resizeMode: "cover", borderWidth: 2 },
  avatarFallback: { width: 38, height: 38, borderRadius: 19, justifyContent: "center", alignItems: "center", backgroundColor: themes.backgroundElevated, borderWidth: 2 },
  monogram: { fontSize: 16, fontFamily: "Body-Bold", color: themes.text },
  seatLabel: { fontSize: 11.5, lineHeight: 14, letterSpacing: 0.28, color: themes.textSecondary, fontFamily: "Body-Bold", textAlign: "center" },
  emptySeatLabel: { color: themes.text, fontSize: 12, lineHeight: 15, textShadowColor: "rgba(0,0,0,0.78)", textShadowRadius: 4 },
  profileName: { fontSize: 13.5, lineHeight: 16, color: themes.text, fontFamily: "Body-Bold", textAlign: "center", maxWidth: "100%" },
  assignedText: { fontSize: 10.5, color: themes.textSecondary, fontFamily: "Body-Medium" },
  compactState: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 1 },
  compactStateText: { fontSize: 8.3, letterSpacing: 0.18, fontFamily: "Body-Bold" },
  emptyContent: { justifyContent: "center", alignItems: "center", gap: 4, width: "100%" },
  plusCircle: { width: 29, height: 29, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: themes.mode === "dark" ? "rgba(6,14,24,0.58)" : "rgba(255,255,255,0.82)", borderWidth: 1, borderColor: themes.mode === "dark" ? "rgba(255,255,255,0.58)" : themes.divider },
  actionPill: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999, backgroundColor: themes.mode === "dark" ? "rgba(6,14,24,0.56)" : "rgba(255,255,255,0.86)", borderWidth: 1, borderColor: themes.divider },
  actionText: { fontSize: 9.5, color: themes.textSecondary, fontFamily: "Body-Bold", textAlign: "center", letterSpacing: 0.35 },
});
