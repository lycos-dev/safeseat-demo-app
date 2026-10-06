import { Spacing as spacing, type ThemePalette } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

type ConsentState = "confirmed" | "declined" | undefined;
type Props = {
  visible: boolean;
  seatLabel: string;
  personName: string;
  isDriverOwner: boolean;
  consent: ConsentState;
  onClose: () => void;
  onConsent: () => void;
  onChangePerson: () => void;
  onRemove: () => void;
};

type ActionRowProps = {
  title: string;
  detail: string;
  onPress: () => void;
  tone?: "normal" | "danger";
  themes: ThemePalette;
  styles: ReturnType<typeof createStyles>;
};

function ActionRow({ title, detail, onPress, tone = "normal", themes, styles }: ActionRowProps) {
  const danger = tone === "danger";
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionRow,
        danger && styles.actionRowDanger,
        pressed && styles.actionPressed,
      ]}
    >
      <View style={styles.actionCopy}>
        <Text style={[styles.actionTitle, danger && { color: themes.warnBttn }]}>{title}</Text>
        <Text style={styles.actionDetail}>{detail}</Text>
      </View>
      <Text style={[styles.chevron, danger && { color: themes.warnBttn }]}>›</Text>
    </Pressable>
  );
}

export default function SeatOptionsModal({
  visible,
  seatLabel,
  personName,
  isDriverOwner,
  consent,
  onClose,
  onConsent,
  onChangePerson,
  onRemove,
}: Props) {
  const themes = useTheme();
  const styles = createStyles(themes);

  const consentLabel = isDriverOwner
    ? "READY"
    : consent === "confirmed"
      ? "AGREED"
      : consent === "declined"
        ? "DECLINED"
        : "CONSENT NEEDED";
  const consentColor = isDriverOwner || consent === "confirmed"
    ? themes.green
    : consent === "declined"
      ? themes.warnBttn
      : themes.lightOrange;

  const consentActionTitle = "Consent";

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close seat options" />
        <View style={styles.card}>
          <View style={styles.handle} />

          <View style={styles.headerBlock}>
            <Text style={styles.eyebrow}>{seatLabel.toUpperCase()}</Text>
            <Text style={styles.title}>{personName}</Text>
            <View style={styles.statusRow}>
              <View style={[styles.dot, { backgroundColor: consentColor }]} />
              <Text style={[styles.status, { color: consentColor }]}>{consentLabel}</Text>
            </View>
            <Text style={styles.help}>
              {isDriverOwner
                ? "This is your Driver seat. Your own monitoring consent is already covered by starting SafeSeat."
                : "Manage this person's trip consent or change who is sitting in this seat."}
            </Text>
          </View>

          <Text style={styles.sectionLabel}>SEAT ACTIONS</Text>
          <View style={styles.actionsCard}>
            {!isDriverOwner ? (
              <>
                <ActionRow
                  title={consentActionTitle}
                  detail={consent === "confirmed"
                    ? "Currently: Agreed. Tap to view or change."
                    : consent === "declined"
                      ? "Currently: Declined. Tap to view or change."
                      : "Choose the passenger's response for this trip."}
                  onPress={onConsent}
                  themes={themes}
                  styles={styles}
                />
                <View style={styles.divider} />
              </>
            ) : null}
            <ActionRow
              title="Change Assigned Person"
              detail="Choose a different saved person for this seat."
              onPress={onChangePerson}
              themes={themes}
              styles={styles}
            />
            <View style={styles.divider} />
            <ActionRow
              title="Remove Person from Seat"
              detail="Clear this seat without deleting the saved profile."
              onPress={onRemove}
              tone="danger"
              themes={themes}
              styles={styles}
            />
          </View>

          <Pressable onPress={onClose} style={({ pressed }) => [styles.close, pressed && styles.actionPressed]}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (t: ThemePalette) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: t.overlay, justifyContent: "flex-end" },
  card: {
    backgroundColor: t.backgroundElevated,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: t.divider,
    paddingHorizontal: spacing.two,
    paddingTop: 10,
    paddingBottom: 28,
    gap: 12,
    shadowColor: t.shadow,
    shadowOpacity: 0.28,
    shadowRadius: 22,
    elevation: 22,
  },
  handle: { width: 44, height: 5, borderRadius: 3, backgroundColor: t.divider, alignSelf: "center", marginBottom: 4 },
  headerBlock: { gap: 8 },
  eyebrow: { color: t.primaryBttn, fontSize: 11, letterSpacing: 1.2, fontFamily: "Body-Bold" },
  title: { color: t.text, fontSize: 24, lineHeight: 29, fontFamily: "Body-Bold" },
  statusRow: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: t.surfaceSoft, borderWidth: 1, borderColor: t.divider },
  dot: { width: 8, height: 8, borderRadius: 4 },
  status: { fontSize: 11.5, fontFamily: "Body-Bold", letterSpacing: 0.4 },
  help: { color: t.textSecondary, fontSize: 14, lineHeight: 20, fontFamily: "Body-Regular" },
  sectionLabel: { color: t.textMuted, fontSize: 10.5, letterSpacing: 1.05, fontFamily: "Body-Bold", marginTop: 2 },
  actionsCard: { overflow: "hidden", borderRadius: 18, borderWidth: 1, borderColor: t.divider, backgroundColor: t.backgroundElement },
  actionRow: { minHeight: 68, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 11, gap: 12, backgroundColor: t.backgroundElement },
  actionRowDanger: { backgroundColor: t.mode === "dark" ? "rgba(255,103,111,0.04)" : "rgba(217,75,85,0.04)" },
  actionCopy: { flex: 1, minWidth: 0 },
  actionTitle: { color: t.text, fontSize: 15, lineHeight: 20, fontFamily: "Body-Bold" },
  actionDetail: { color: t.textSecondary, fontSize: 12.5, lineHeight: 17, fontFamily: "Body-Regular", marginTop: 2 },
  chevron: { color: t.textSecondary, fontSize: 26, lineHeight: 28, fontFamily: "Body-Regular" },
  divider: { height: 1, backgroundColor: t.divider, marginLeft: 14 },
  actionPressed: { opacity: 0.68 },
  close: { minHeight: 44, alignItems: "center", justifyContent: "center", marginTop: 2 },
  closeText: { color: t.textSecondary, fontSize: 15, fontFamily: "Body-Bold" },
});
