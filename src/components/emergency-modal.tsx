import type { SeatVitals } from "@/components/seat-card";
import { FontSize as fontsize, Spacing as spacing, type ThemePalette } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { useUserPreferences } from "@/hooks/user-preferences-context";
import { useSeatSessions } from "@/hooks/seat-session-context";
import { sendEmergencySms } from "@/services/sms-escalation";
import { captureEmergencyLocation, type EmergencyLocation } from "@/services/emergency-location";
import { getOrCreateEmergencyEventId } from "@/services/emergency-event";
import { markCurrentIncidentSmsEscalated } from "@/services/admin-cloud-sync";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { collection, getDocs } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { auth, db } from "../firebase";

interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  hierarchy: number;
}

type Props = {
  visible: boolean;
  seat: number;
  onClose: () => void;
  id?: string;
  name: string;
  icon?: string;
  isAccountOwner?: boolean;
  vitals?: SeatVitals;
  alertAcknowledged?: boolean;
  onAcknowledgeAlert?: () => void;
  /** True only when the emergency comes from a real Main Hub fusion state (not a UAT simulation). */
  isRealEmergency?: boolean;
};

const LOCAL_EMERGENCY_CONTACTS_KEY = "app_emergency_contacts";
const HOLD_TO_CANCEL_MS = 2000;

const ROLE_LABELS: Record<number, string> = {
  1: "Driver",
  2: "Front passenger",
  3: "Left rear",
  4: "Center rear",
  5: "Right rear",
};

const formatImageUri = (value?: string) => {
  if (!value || value === "Not Set" || value.trim() === "") return undefined;
  if (value.startsWith("http") || value.startsWith("data:")) return value;
  return `data:image/jpeg;base64,${value}`;
};

export default function EmergencyModal({
  visible,
  seat,
  name,
  icon,
  onClose,
  isAccountOwner = false,
  vitals,
  alertAcknowledged = false,
  onAcknowledgeAlert,
  isRealEmergency = false,
}: Props) {
  const themes = useTheme();
  const styles = createStyles(themes);
  const isDriverSeat = seat === 1;
  const {
    emergencyEscalation,
    escalationWindowSeconds,
  } = useUserPreferences();
  const { activeSessions } = useSeatSessions();

  const [contactMenuVisible, setContactMenuVisible] = useState(false);
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number>(escalationWindowSeconds);
  const [windowElapsed, setWindowElapsed] = useState(false);
  const [holdingCancel, setHoldingCancel] = useState(false);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const smsAttemptedRef = useRef(false);
  const emergencyEventIdRef = useRef<string | null>(null);
  const emergencyLocationRef = useRef<EmergencyLocation | null>(null);
  const [locationStatus, setLocationStatus] = useState<"idle" | "capturing" | "ready" | "unavailable">("idle");
  const [smsStatus, setSmsStatus] = useState<"idle" | "sending" | "sent" | "skipped" | "failed">("idle");
  const [smsStatusDetail, setSmsStatusDetail] = useState("");

  const clearHoldTimer = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  useEffect(() => {
    if (!visible) {
      clearHoldTimer();
      setHoldingCancel(false);
      return;
    }

    setSecondsLeft(escalationWindowSeconds);
    setWindowElapsed(false);
    setHoldingCancel(false);
    smsAttemptedRef.current = false;
    emergencyEventIdRef.current = null;
    emergencyLocationRef.current = null;
    setLocationStatus("idle");
    setSmsStatus("idle");
    setSmsStatusDetail("");
  }, [visible, seat, escalationWindowSeconds]);

  // Prepare the event id and a fresh GPS fix immediately when a real driver
  // emergency begins. GPS failure never blocks SMS escalation.
  useEffect(() => {
    if (!visible || !isDriverSeat || !emergencyEscalation || !isRealEmergency) return;

    const sessionId = activeSessions[seat]?.id;
    if (sessionId && !emergencyEventIdRef.current) {
      void getOrCreateEmergencyEventId(sessionId)
        .then((eventId) => {
          emergencyEventIdRef.current = eventId;
        })
        .catch((error) => {
          console.warn("SafeSeat could not prepare emergency event id:", error);
        });
    }

    if (locationStatus === "idle") {
      setLocationStatus("capturing");
      void captureEmergencyLocation()
        .then((location) => {
          emergencyLocationRef.current = location;
          setLocationStatus(location ? "ready" : "unavailable");
        })
        .catch(() => {
          emergencyLocationRef.current = null;
          setLocationStatus("unavailable");
        });
    }
  }, [visible, isDriverSeat, emergencyEscalation, isRealEmergency, activeSessions, seat, locationStatus]);

  useEffect(() => {
    if (!visible || windowElapsed || !isDriverSeat || !emergencyEscalation || !isRealEmergency) return;

    const timer = setInterval(() => {
      setSecondsLeft((previous) => {
        if (previous <= 1) {
          clearInterval(timer);
          setWindowElapsed(true);
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          return 0;
        }
        return previous - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [visible, windowElapsed, isDriverSeat, emergencyEscalation, isRealEmergency]);

  useEffect(() => () => clearHoldTimer(), []);

  // ---- SMS escalation: one server-verified cycle per real Emergency event ----
  useEffect(() => {
    if (!visible || !windowElapsed || !isDriverSeat || !emergencyEscalation || !isRealEmergency) return;
    if (smsAttemptedRef.current) return;

    const sessionId = activeSessions[seat]?.id;
    if (!sessionId) {
      smsAttemptedRef.current = true;
      setSmsStatus("failed");
      setSmsStatusDetail("No active driver monitoring session was available for SMS verification.");
      return;
    }

    smsAttemptedRef.current = true;
    setSmsStatus("sending");
    setSmsStatusDetail("");

    void (async () => {
      try {
        const eventId =
          emergencyEventIdRef.current ?? (await getOrCreateEmergencyEventId(sessionId));
        emergencyEventIdRef.current = eventId;

        // The GPS request started at the beginning of the countdown. At zero,
        // use whatever fresh fix is ready; do not delay emergency messaging
        // just because location is unavailable.
        const result = await sendEmergencySms({
          seatNumber: seat,
          sessionId,
          eventId,
          location: emergencyLocationRef.current,
        });

        if (result.ok) {
          if (result.skipped) {
            setSmsStatus("skipped");
            const skippedMessages: Record<string, string> = {
              duplicate_event: "This Emergency event has already completed its SMS cycle.",
              event_in_progress: "This Emergency SMS cycle is already being processed.",
              no_contacts: "No registered Emergency Contacts are available.",
              no_valid_contacts: "No Emergency Contact has a valid Philippine mobile number.",
              test_mode: "Server test mode is enabled; no real SMS was sent.",
            };
            setSmsStatusDetail(skippedMessages[result.skipped] ?? "Emergency SMS was not sent.");
            console.log(`SafeSeat SMS skipped: ${result.skipped}`);
          } else {
            setSmsStatus("sent");
            const recipientCount = result.sentTo?.length ?? 0;
            setSmsStatusDetail(
              recipientCount > 0
                ? `Emergency SMS sent to ${recipientCount} registered contact${recipientCount === 1 ? "" : "s"}.`
                : "Emergency SMS request completed.",
            );
            console.log(`SafeSeat SMS sent (ID: ${result.messageId})`);
            void markCurrentIncidentSmsEscalated(sessionId);
          }
        } else {
          setSmsStatus("failed");
          setSmsStatusDetail("Emergency SMS could not be sent. Use the contact shortcuts or phone dialer.");
          console.warn("SafeSeat SMS failed:", result.error);
        }
      } catch (error) {
        setSmsStatus("failed");
        setSmsStatusDetail("Emergency SMS could not be sent. Use the contact shortcuts or phone dialer.");
        console.error("SafeSeat SMS escalation error:", error);
      }
    })();
  }, [visible, windowElapsed, isDriverSeat, emergencyEscalation, isRealEmergency, seat, activeSessions]);

  // The attempt flag is scoped to this rendered Emergency cycle. The stable
  // event id is persisted separately and is cleared only after Fusion exits
  // EMERGENCY, protecting against remount/reload duplicates.
  useEffect(() => {
    if (!visible) smsAttemptedRef.current = false;
  }, [visible]);

  const fetchEmergencyContacts = async () => {
    setLoadingContacts(true);
    let loadedContacts: EmergencyContact[] = [];

    try {
      const currentUser = auth.currentUser;
      if (currentUser) {
        const contactsRef = collection(db, "users", currentUser.uid, "emergencyContacts");
        const contactsSnap = await getDocs(contactsRef);

        loadedContacts = contactsSnap.docs.map((docSnap) => {
          const data = docSnap.data();
          const hierarchyNum = Number(data.hierarchy);
          return {
            id: docSnap.id,
            name: data.name || "Unknown contact",
            phone: data.phone || "",
            hierarchy:
              data.hierarchy != null && !Number.isNaN(hierarchyNum) && hierarchyNum > 0
                ? hierarchyNum
                : 0,
          };
        });

        loadedContacts.sort((a, b) => {
          if (a.hierarchy === 0 && b.hierarchy === 0) return 0;
          if (a.hierarchy === 0) return 1;
          if (b.hierarchy === 0) return -1;
          return a.hierarchy - b.hierarchy;
        });

        if (loadedContacts.length > 0) {
          await AsyncStorage.setItem(
            LOCAL_EMERGENCY_CONTACTS_KEY,
            JSON.stringify(loadedContacts),
          );
        }
      }

      if (loadedContacts.length === 0) {
        const cached = await AsyncStorage.getItem(LOCAL_EMERGENCY_CONTACTS_KEY);
        if (cached) loadedContacts = JSON.parse(cached);
      }

      setContacts(loadedContacts);
    } catch (error) {
      console.error("Error syncing emergency contacts:", error);
      const cached = await AsyncStorage.getItem(LOCAL_EMERGENCY_CONTACTS_KEY);
      if (cached) setContacts(JSON.parse(cached));
    } finally {
      setLoadingContacts(false);
    }
  };

  const handleOpenContactMenu = () => {
    setContactMenuVisible(true);
    void fetchEmergencyContacts();
  };

  const handleCall = async (phoneNumber: string) => {
    const cleanNumber = phoneNumber.replace(/[^0-9+]/g, "");
    if (!cleanNumber) {
      Alert.alert("No phone number", "This contact does not have a usable phone number.");
      return;
    }

    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      const url = `tel:${cleanNumber}`;
      if (await Linking.canOpenURL(url)) {
        await Linking.openURL(url);
      } else {
        Alert.alert("Dialer unavailable", "This device cannot open the phone dialer.");
      }
    } catch (error) {
      console.error("Failed to open phone dialer:", error);
      Alert.alert("Dialer unavailable", "Could not open the phone dialer.");
    }
  };

  const handleEmergencyServices = () => {
    Alert.alert(
      "Open emergency dialer?",
      "SafeSeat does not place automated voice calls. This only opens your phone dialer with 911 so you can choose whether to call.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Open Dialer",
          style: "destructive",
          onPress: () => void handleCall("911"),
        },
      ],
    );
  };

  const handleNearbyHospitals = async () => {
    const nativeUrl = Platform.select({
      ios: "http://maps.apple.com/?q=emergency+hospital",
      android: "geo:0,0?q=emergency+hospital",
      default: "https://www.google.com/maps/search/?api=1&query=emergency+hospital",
    }) as string;

    try {
      if (await Linking.canOpenURL(nativeUrl)) {
        await Linking.openURL(nativeUrl);
      } else {
        await Linking.openURL(
          "https://www.google.com/maps/search/?api=1&query=emergency+hospital",
        );
      }
    } catch {
      Alert.alert("Maps unavailable", "Could not open nearby hospital search on this device.");
    }
  };

  const beginCancelHold = () => {
    if (holdingCancel) return;
    setHoldingCancel(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    clearHoldTimer();
    holdTimerRef.current = setTimeout(() => {
      holdTimerRef.current = null;
      setHoldingCancel(false);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();
    }, HOLD_TO_CANCEL_MS);
  };

  const endCancelHold = () => {
    if (!holdTimerRef.current) return;
    clearHoldTimer();
    setHoldingCancel(false);
  };

  if (!visible) return null;

  const role = ROLE_LABELS[seat] ?? `Seat ${seat}`;
  const imageUri = formatImageUri(icon);
  const title = isAccountOwner
    ? "Safety event detected for you"
    : `Safety event detected for ${name}`;
  const countdownPercent = Math.max(
    0,
    Math.min(100, (secondsLeft / escalationWindowSeconds) * 100),
  );
  const isTestEmergency = !isRealEmergency;
  const driverOnlySmsEligible = isDriverSeat && isRealEmergency;

  const escalationMessage = !isDriverSeat
    ? "Passenger emergency: alert the driver now. SafeSeat sound/haptics and this emergency screen stay active until the alert is acknowledged."
    : isTestEmergency
      ? "Researcher Test Emergency is active. This is a local simulation and will not send an automated SMS. Hold the linked seat again to stop the test."
      : !emergencyEscalation
        ? "Driver Emergency SMS is turned off in Settings."
        : smsStatus === "sending"
          ? "Emergency is still active. SafeSeat is sending the automated SMS to the driver's registered Emergency Contacts."
          : smsStatus === "sent"
            ? smsStatusDetail || "Emergency SMS sent to the driver's registered Emergency Contacts."
            : smsStatus === "failed" || smsStatus === "skipped"
              ? smsStatusDetail
              : windowElapsed
                ? "The escalation window has elapsed. SafeSeat is preparing the Emergency SMS request."
                : "If the Driver-seat emergency remains confirmed when this timer reaches zero, SafeSeat will notify all registered Emergency Contacts.";

  const gpsStatusMessage = locationStatus === "ready"
    ? "Phone GPS ready for the Emergency SMS."
    : locationStatus === "capturing"
      ? "Getting the phone's current GPS location..."
      : locationStatus === "unavailable"
        ? "Current GPS is unavailable. Emergency SMS will still be sent."
        : "GPS will be prepared for a confirmed driver Emergency.";

  return (
    <>
      <Modal
        animationType="fade"
        transparent
        visible={visible}
        statusBarTranslucent
        onRequestClose={() => undefined}
      >
        <View style={styles.backdrop}>
          <View style={styles.card}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              bounces={false}
              contentContainerStyle={styles.cardContent}
            >
            <View style={styles.topRow}>
              <View style={styles.alertPill}>
                <Ionicons name="warning" color={themes.warnBttn} size={15} />
                <Text style={styles.alertPillText}>EMERGENCY</Text>
              </View>
              {driverOnlySmsEligible && emergencyEscalation ? <Text style={styles.timerValue}>{windowElapsed ? "00" : String(secondsLeft).padStart(2, "0")}s</Text> : <Text style={styles.passengerAlertText}>{!isDriverSeat ? "DRIVER ALERT" : isTestEmergency ? "TEST MODE" : "SMS OFF"}</Text>}
            </View>

            {driverOnlySmsEligible && emergencyEscalation ? (
              <View style={styles.timerTrack}>
                <View style={[styles.timerFill, { width: `${countdownPercent}%` }]} />
              </View>
            ) : null}

            <View style={styles.headerRow}>
              {imageUri ? (
                <Image source={{ uri: imageUri }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarLetter}>{name.charAt(0).toUpperCase()}</Text>
                </View>
              )}
              <View style={styles.headerCopy}>
                <Text style={styles.titleText}>{title}</Text>
                <Text style={styles.subtitleText}>{role} · sustained abnormal pattern</Text>
              </View>
            </View>

            <View style={styles.vitalsBox}>
              <View style={styles.vitalsHeader}>
                <Text style={styles.vitalsTitle}>VITAL SIGNS</Text>
                <View style={[styles.vitalsStatus, vitals?.trusted && styles.vitalsStatusLive]}>
                  <Text style={[styles.vitalsStatusText, vitals?.trusted && styles.vitalsStatusTextLive]}>
                    {vitals?.trusted ? "LIVE" : vitals?.statusLabel === "UNAVAILABLE" ? "UNAVAILABLE" : "REACQUIRING"}
                  </Text>
                </View>
              </View>
              {vitals?.trusted ? (
                <View style={styles.vitalsValues}>
                  <View style={styles.vitalTile}>
                    <Text style={styles.vitalAbbr}>HR</Text>
                    <Text style={styles.vitalNumber}>{vitals.heartRateBpm ?? "—"}</Text>
                    <Text style={styles.vitalUnit}>bpm</Text>
                  </View>
                  <View style={styles.vitalTile}>
                    <Text style={styles.vitalAbbr}>RR</Text>
                    <Text style={styles.vitalNumber}>{vitals.respirationRateBpm ?? "—"}</Text>
                    <Text style={styles.vitalUnit}>/min</Text>
                  </View>
                </View>
              ) : (
                <Text style={styles.vitalsUnavailable}>SafeSeat is reacquiring a trustworthy heart-rate and breathing signal.</Text>
              )}
            </View>

            <View style={styles.summaryBox}>
              <Text style={styles.summaryLabel}>ALERT CATEGORY</Text>
              <Text style={styles.summaryTitle}>Abnormal multi-sensor pattern</Text>
              <Text style={styles.summaryText}>
                SafeSeat is advisory and does not diagnose a medical condition. Verify the occupant and respond to the situation around you.
              </Text>
            </View>

            <View style={styles.escalationBox}>
              <View style={styles.escalationHeader}>
                <Ionicons
                  name={isDriverSeat && emergencyEscalation ? "chatbubble-ellipses" : "information-circle"}
                  color={themes.primaryBttn}
                  size={18}
                />
                <Text style={styles.escalationTitle}>{isDriverSeat ? "Driver Emergency SMS" : "Driver Alert"}</Text>
              </View>
              <Text style={styles.escalationText}>{escalationMessage}</Text>
              {driverOnlySmsEligible && emergencyEscalation ? (
                <Text style={styles.locationText}>{gpsStatusMessage}</Text>
              ) : null}
            </View>

            <View style={styles.quickActions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => void handleNearbyHospitals()}
                style={({ pressed }) => [styles.quickAction, pressed && styles.pressed]}
              >
                <Ionicons name="map" color={themes.primaryBttn} size={20} />
                <Text style={styles.quickActionText}>Nearby hospitals</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                onPress={handleOpenContactMenu}
                style={({ pressed }) => [styles.quickAction, pressed && styles.pressed]}
              >
                <Ionicons name="people" color={themes.primaryBttn} size={20} />
                <Text style={styles.quickActionText}>Contacts</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                onPress={handleEmergencyServices}
                style={({ pressed }) => [styles.quickAction, pressed && styles.pressed]}
              >
                <Ionicons name="call" color={themes.warnBttn} size={20} />
                <Text style={styles.quickActionText}>Dialer</Text>
              </Pressable>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Acknowledge emergency alert sound"
              disabled={alertAcknowledged}
              onPress={onAcknowledgeAlert}
              style={({ pressed }) => [
                styles.acknowledgeButton,
                alertAcknowledged && styles.acknowledgeButtonDone,
                pressed && !alertAcknowledged && styles.pressed,
              ]}
            >
              <Ionicons name={alertAcknowledged ? "checkmark-circle" : "volume-high"} color={alertAcknowledged ? themes.green : themes.text} size={21} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.acknowledgeTitle, alertAcknowledged && { color: themes.green }]}>
                  {alertAcknowledged ? "Alert acknowledged" : "Acknowledge Alert"}
                </Text>
                <Text style={styles.acknowledgeHint}>
                  {alertAcknowledged ? "Sound stopped. Emergency monitoring continues." : "Stops the repeating sound only. Emergency monitoring stays active."}
                </Text>
              </View>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Hold for two seconds to cancel emergency"
              onPressIn={beginCancelHold}
              onPressOut={endCancelHold}
              style={({ pressed }) => [
                styles.cancelHold,
                holdingCancel && styles.cancelHoldActive,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons
                name={holdingCancel ? "hand-left" : "close-circle-outline"}
                color={holdingCancel ? themes.primaryBttnText : themes.text}
                size={21}
              />
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.cancelHoldTitle,
                    holdingCancel && { color: themes.primaryBttnText },
                  ]}
                >
                  {holdingCancel ? "Keep holding…" : "Hold 2 seconds to cancel"}
                </Text>
                <Text
                  style={[
                    styles.cancelHoldHint,
                    holdingCancel && { color: themes.primaryBttnText },
                  ]}
                >
                  Use only after verifying the alert is a false alarm or the occupant has recovered.
                </Text>
              </View>
            </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="slide"
        transparent
        visible={contactMenuVisible}
        onRequestClose={() => setContactMenuVisible(false)}
      >
        <View style={styles.contactBackdrop}>
          <View style={styles.contactSheet}>
            <View style={styles.contactHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.contactTitle}>Emergency Contacts</Text>
                <Text style={styles.contactSubtitle}>
                  {isDriverSeat
                    ? "These are manual dialer shortcuts. Automated SMS escalation runs in the background when the driver emergency countdown elapses."
                    : "These are manual dialer shortcuts."}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close emergency contacts"
                onPress={() => setContactMenuVisible(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" color={themes.text} size={24} />
              </Pressable>
            </View>

            {loadingContacts ? (
              <ActivityIndicator size="large" color={themes.primaryBttn} style={styles.loader} />
            ) : contacts.length > 0 ? (
              <ScrollView style={styles.contactList} contentContainerStyle={styles.contactListContent}>
                {contacts.map((contact) => (
                  <Pressable
                    key={contact.id}
                    onPress={() => void handleCall(contact.phone)}
                    style={({ pressed }) => [styles.contactRow, pressed && styles.contactRowPressed]}
                  >
                    <View style={styles.contactIcon}>
                      <Ionicons name="call" color={themes.primaryBttn} size={20} />
                    </View>
                    <View style={styles.contactCopy}>
                      <Text style={styles.contactName}>{contact.name}</Text>
                      <Text style={styles.contactPhone}>{contact.phone || "No phone number"}</Text>
                    </View>
                    <Text style={styles.contactOrder}>
                      {contact.hierarchy > 0 ? `${contact.hierarchy}${contact.hierarchy === 1 ? "st" : contact.hierarchy === 2 ? "nd" : contact.hierarchy === 3 ? "rd" : "th"}` : ""}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : (
              <View style={styles.emptyContacts}>
                <Ionicons name="person-add-outline" color={themes.textSecondary} size={34} />
                <Text style={styles.emptyContactsTitle}>No emergency contacts yet</Text>
                <Text style={styles.emptyContactsText}>Add contacts from Profiles → Emergency Contacts.</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const createStyles = (themes: ThemePalette) => StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "center",
    padding: spacing.two,
    backgroundColor: themes.overlay,
  },
  card: {
    width: "100%",
    maxWidth: 520,
    maxHeight: "92%",
    alignSelf: "center",
    borderRadius: 26,
    backgroundColor: themes.backgroundElement,
    borderWidth: 1,
    borderColor: `${themes.warnBttn}55`,
    overflow: "hidden",
  },
  cardContent: {
    gap: spacing.two,
    padding: spacing.two,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  alertPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.half,
    paddingHorizontal: spacing.one,
    paddingVertical: spacing.half,
    borderRadius: 999,
    backgroundColor: `${themes.warnBttn}16`,
    borderWidth: 1,
    borderColor: `${themes.warnBttn}55`,
  },
  alertPillText: {
    color: themes.warnBttn,
    fontSize: 10,
    letterSpacing: 1.2,
    fontFamily: "Body-Bold",
  },
  timerValue: {
    color: themes.warnBttn,
    fontSize: 24,
    fontFamily: "Body-Bold",
  },
  passengerAlertText: { color: themes.textSecondary, fontSize: 12, letterSpacing: 0.7, fontFamily: "Body-Bold" },
  timerTrack: {
    height: 5,
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: themes.secondaryBttn,
  },
  timerFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: themes.warnBttn,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.two,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: themes.warnBttn,
  },
  avatarFallback: {
    width: 60,
    height: 60,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: themes.warnBttn,
    backgroundColor: themes.backgroundElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLetter: {
    color: themes.text,
    fontSize: fontsize.header,
    fontFamily: "Body-Bold",
  },
  headerCopy: {
    flex: 1,
    gap: spacing.half,
  },
  titleText: {
    color: themes.text,
    fontSize: 19,
    lineHeight: 23,
    fontFamily: "Body-Bold",
  },
  subtitleText: {
    color: themes.textSecondary,
    fontSize: fontsize.caption,
    fontFamily: "Body-Regular",
  },
  vitalsBox: {
    padding: spacing.one + 4,
    borderRadius: 18,
    backgroundColor: "rgba(52, 209, 127, 0.055)",
    borderWidth: 1,
    borderColor: "rgba(52, 209, 127, 0.20)",
    gap: spacing.one,
  },
  vitalsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  vitalsTitle: { color: themes.textSecondary, fontSize: 10, letterSpacing: 1.1, fontFamily: "Body-Bold" },
  vitalsStatus: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: themes.surfaceSoft, borderWidth: 1, borderColor: themes.divider },
  vitalsStatusLive: { backgroundColor: "rgba(52, 209, 127, 0.10)", borderColor: themes.primaryBorder },
  vitalsStatusText: { color: themes.textMuted, fontSize: 8, letterSpacing: 0.7, fontFamily: "Body-Bold" },
  vitalsStatusTextLive: { color: themes.green },
  vitalsValues: { flexDirection: "row", gap: spacing.one },
  vitalTile: { flex: 1, minHeight: 66, borderRadius: 15, paddingHorizontal: spacing.one, alignItems: "center", justifyContent: "center", backgroundColor: themes.backgroundElevated, borderWidth: 1, borderColor: themes.divider },
  vitalAbbr: { color: themes.textMuted, fontSize: 9, letterSpacing: 0.8, fontFamily: "Body-Bold" },
  vitalNumber: { color: themes.text, fontSize: 23, lineHeight: 27, fontFamily: "Body-Bold", marginTop: 1 },
  vitalUnit: { color: themes.textSecondary, fontSize: 9, fontFamily: "Body-Medium" },
  vitalsUnavailable: { color: themes.textSecondary, fontSize: fontsize.caption, lineHeight: 17, fontFamily: "Body-Regular" },
  summaryBox: {
    padding: spacing.two,
    borderRadius: 18,
    backgroundColor: themes.surfaceSoft,
    borderWidth: 1,
    borderColor: themes.divider,
  },
  summaryLabel: {
    color: themes.warnBttn,
    fontSize: 10,
    letterSpacing: 1.1,
    fontFamily: "Body-Bold",
  },
  summaryTitle: {
    color: themes.text,
    fontSize: 15,
    marginTop: spacing.half,
    fontFamily: "Body-Bold",
  },
  summaryText: {
    color: themes.textSecondary,
    fontSize: fontsize.caption,
    lineHeight: 18,
    marginTop: spacing.half,
    fontFamily: "Body-Regular",
  },
  escalationBox: {
    padding: spacing.one + 4,
    borderRadius: 16,
    backgroundColor: themes.primarySoft,
    borderWidth: 1,
    borderColor: themes.primaryBorder,
  },
  escalationHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.half,
  },
  escalationTitle: {
    color: themes.primaryBttn,
    fontSize: 13,
    fontFamily: "Body-Bold",
  },
  escalationText: {
    color: themes.text,
    fontSize: fontsize.caption,
    lineHeight: 18,
    marginTop: spacing.half,
    fontFamily: "Body-Regular",
  },
  locationText: {
    color: themes.textSecondary,
    fontSize: 10,
    marginTop: spacing.half,
    fontFamily: "Body-Medium",
  },
  quickActions: {
    flexDirection: "row",
    gap: spacing.one,
  },
  quickAction: {
    flex: 1,
    minHeight: 64,
    paddingHorizontal: spacing.half,
    paddingVertical: spacing.one,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.half,
    backgroundColor: themes.backgroundElevated,
    borderWidth: 1,
    borderColor: themes.divider,
  },
  quickActionText: {
    color: themes.text,
    fontSize: 10,
    textAlign: "center",
    fontFamily: "Body-Bold",
  },
  acknowledgeButton: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.one,
    paddingHorizontal: spacing.one + 4,
    paddingVertical: spacing.one,
    borderRadius: 18,
    backgroundColor: themes.surfaceSoft,
    borderWidth: 1,
    borderColor: themes.divider,
  },
  acknowledgeButtonDone: { backgroundColor: "rgba(52, 209, 127, 0.06)", borderColor: themes.primaryBorder },
  acknowledgeTitle: { color: themes.text, fontSize: 14, fontFamily: "Body-Bold" },
  acknowledgeHint: { color: themes.textSecondary, fontSize: 9.5, lineHeight: 13, marginTop: 2, fontFamily: "Body-Regular" },
  cancelHold: {
    minHeight: 70,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.one,
    padding: spacing.one + 4,
    borderRadius: 18,
    backgroundColor: themes.secondaryBttn,
    borderWidth: 1,
    borderColor: themes.divider,
  },
  cancelHoldActive: {
    backgroundColor: themes.primaryBttn,
    borderColor: themes.primaryBttn,
  },
  cancelHoldTitle: {
    color: themes.text,
    fontSize: 14,
    fontFamily: "Body-Bold",
  },
  cancelHoldHint: {
    color: themes.textSecondary,
    fontSize: 10,
    lineHeight: 14,
    marginTop: 2,
    fontFamily: "Body-Regular",
  },
  pressed: {
    opacity: 0.76,
    transform: [{ scale: 0.99 }],
  },
  contactBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: themes.overlay,
  },
  contactSheet: {
    maxHeight: "72%",
    padding: spacing.two,
    paddingBottom: spacing.four,
    gap: spacing.two,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: themes.backgroundElement,
    borderWidth: 1,
    borderColor: themes.divider,
  },
  contactHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.two,
  },
  contactTitle: {
    color: themes.text,
    fontSize: fontsize.header,
    fontFamily: "Heading-Font",
  },
  contactSubtitle: {
    color: themes.textSecondary,
    fontSize: fontsize.caption,
    lineHeight: 17,
    fontFamily: "Body-Regular",
    marginTop: spacing.half,
  },
  closeButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: themes.backgroundElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  loader: {
    marginVertical: spacing.four,
  },
  contactList: {
    width: "100%",
  },
  contactListContent: {
    gap: spacing.one,
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.one,
    padding: spacing.two,
    borderRadius: 16,
    backgroundColor: themes.backgroundElevated,
  },
  contactRowPressed: {
    opacity: 0.7,
  },
  contactIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: themes.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  contactCopy: {
    flex: 1,
  },
  contactName: {
    color: themes.text,
    fontSize: fontsize.body,
    fontFamily: "Body-Bold",
  },
  contactPhone: {
    color: themes.textSecondary,
    fontSize: fontsize.caption,
    fontFamily: "Body-Regular",
    marginTop: spacing.quarter,
  },
  contactOrder: {
    color: themes.primaryBttn,
    fontSize: fontsize.caption,
    fontFamily: "Body-Bold",
  },
  emptyContacts: {
    alignItems: "center",
    paddingVertical: spacing.four,
    gap: spacing.one,
  },
  emptyContactsTitle: {
    color: themes.text,
    fontSize: fontsize.body,
    fontFamily: "Body-Bold",
  },
  emptyContactsText: {
    color: themes.textSecondary,
    fontSize: fontsize.caption,
    textAlign: "center",
    fontFamily: "Body-Regular",
  },
});
