import Button from "@/components/button";
import AssignCard from "@/components/assign-card";
import AssignSeatModal from "@/components/assign-seat-modal";
import SeatOptionsModal from "@/components/seat-options-modal";
import GuidePulseOverlay from "@/components/guide-pulse-overlay";
import { Spacing as spacing, type ThemePalette } from "@/constants/theme";
import { getSeatDisplayState } from "@/utils/monitoring-presentation";
import { useTheme } from "@/hooks/use-theme";
import { useSafeSeatHub } from "@/hooks/safeseat-hub-context";
import { useUserPreferences } from "@/hooks/user-preferences-context";
import { useDriverGuide } from "@/hooks/driver-guide-context";
import { useSeatSessions } from "@/hooks/seat-session-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

type Profile = {
  id: string;
  name: string;
  photoURL?: string;
  icon?: string;
  pfp?: string;
  isAccountOwner?: boolean;
  isGuest?: boolean;
  sessionOnly?: boolean;
};

export type SeatState =
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
  | "monitoring";

type ConsentState = "confirmed" | "declined";

const SEAT_ASSIGNMENTS_KEY = "seatAssignments";
const IS_LOCKED_IN_KEY = "isLockedIn";
const SEAT_STATUSES_KEY = "seatStatuses";
const HARDWARE_SEAT_KEY = "safeSeatHardwareSeatNo";
const SEAT_CONSENTS_KEY = "seatSessionConsents";

const SEATS = [
  { seatNo: 1, seatCode: "driver" },
  { seatNo: 2, seatCode: "front passenger" },
  { seatNo: 3, seatCode: "left rear" },
  { seatNo: 4, seatCode: "center rear" },
  { seatNo: 5, seatCode: "right rear" },
];

export default function Assign() {
  const themes = useTheme();
  const styles = createStyles(themes);
  const router = useRouter();
  const { prototypeIndicator } = useUserPreferences();
  const [sensorPickerVisible, setSensorPickerVisible] = useState(false);
  const [savingSensor, setSavingSensor] = useState(false);
  const [starting, setStarting] = useState(false);
  const startingRef = useRef(false);
  const insets = useSafeAreaInsets();
  const { height: viewportHeight, width: viewportWidth } = useWindowDimensions();
  const carMapHeight = Math.max(360, Math.min(560, viewportHeight * 0.56));
  const [stickyActionHeight, setStickyActionHeight] = useState(0);
  const bottomPad = stickyActionHeight + spacing.one;
  const {
    isStep,
    stepId: guideStepId,
    selectedSeatNo: guideSeatNo,
    recordSeatTapped,
    recordConsentConfirmed,
    recordSensorSelected,
    recordMonitoringStarted,
  } = useDriverGuide();
  const { activeSessions, startSeatSessions } = useSeatSessions();
  const {
    connected: hubConnected,
    telemetryReady,
    refresh: refreshHub,
    resetDecisionLatch,
    setSimulationState,
    cancelUatWarning,
    silenceAlertFeedback,
  } = useSafeSeatHub();

  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [selectedSeat, setSelectedSeat] = useState(1);
  const [assignments, setAssignments] = useState<Record<number, Profile>>({});
  const [isLockedIn, setIsLockedIn] = useState(false);
  const [hardwareSeatNo, setHardwareSeatNo] = useState<number | null>(null);
  const [consents, setConsents] = useState<Record<number, ConsentState>>({});
  const [consentModalVisible, setConsentModalVisible] = useState(false);
  const [consentSeatNo, setConsentSeatNo] = useState<number | null>(null);
  const [seatOptionsVisible, setSeatOptionsVisible] = useState(false);
  const [seatOptionsSeatNo, setSeatOptionsSeatNo] = useState<number | null>(null);

  const assignedSeatCount = useMemo(
    () => SEATS.filter((seat) => Boolean(assignments[seat.seatNo])).length,
    [assignments],
  );
  const hasAssignedSeats = assignedSeatCount > 0;

  const loadState = useCallback(async () => {
    try {
      const [rawAssignments, rawLockedIn, rawHardwareSeat, rawConsents] = await Promise.all([
        AsyncStorage.getItem(SEAT_ASSIGNMENTS_KEY),
        AsyncStorage.getItem(IS_LOCKED_IN_KEY),
        AsyncStorage.getItem(HARDWARE_SEAT_KEY),
        AsyncStorage.getItem(SEAT_CONSENTS_KEY),
      ]);

      const parsedAssignments: Record<number, Profile> = rawAssignments ? JSON.parse(rawAssignments) : {};
      const parsedHardwareSeat = rawHardwareSeat ? Number(JSON.parse(rawHardwareSeat)) : null;
      const fallbackHardwareSeat = Number(Object.keys(parsedAssignments)[0]) || null;

      setAssignments(parsedAssignments);
      setConsents(rawConsents ? JSON.parse(rawConsents) : {});
      setIsLockedIn(rawLockedIn ? JSON.parse(rawLockedIn) : false);
      setHardwareSeatNo(parsedHardwareSeat && parsedAssignments[parsedHardwareSeat] ? parsedHardwareSeat : fallbackHardwareSeat);
    } catch (error) {
      console.error("Failed to load seat & lock state:", error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadState();
    }, [loadState]),
  );

  const isAccountOwnerDriver = (seatNo: number) =>
    seatNo === 1 && Boolean(assignments[seatNo]?.isAccountOwner);

  const hasEffectiveConsent = (seatNo: number) =>
    isAccountOwnerDriver(seatNo) || consents[seatNo] === "confirmed";

  const getCardState = (seatNo: number): SeatState => {
    return getSeatDisplayState({
      assigned: Boolean(assignments[seatNo]), ownerDriver: isAccountOwnerDriver(seatNo),
      consent: consents[seatNo], linked: seatNo === hardwareSeatNo,
      connected: hubConnected, ready: telemetryReady, active: Boolean(activeSessions[seatNo]), liveState: "monitoring",
    });
  };

  const getSeatLabel = (seatNo: number | null) => {
    if (!seatNo) return "Not selected";
    const seat = SEATS.find((item) => item.seatNo === seatNo);
    if (!seat) return `Seat ${seatNo}`;
    return seat.seatCode.replace(/\b\w/g, (letter) => letter.toUpperCase());
  };

  const persistHardwareSeat = async (seatNo: number | null) => {
    if (seatNo) {
      await AsyncStorage.setItem(HARDWARE_SEAT_KEY, JSON.stringify(seatNo));
    } else {
      await AsyncStorage.removeItem(HARDWARE_SEAT_KEY);
    }
    setHardwareSeatNo(seatNo);
  };

  const persistConsents = async (next: Record<number, ConsentState>) => {
    setConsents(next);
    if (Object.keys(next).length > 0) {
      await AsyncStorage.setItem(SEAT_CONSENTS_KEY, JSON.stringify(next));
    } else {
      await AsyncStorage.removeItem(SEAT_CONSENTS_KEY);
    }
  };

  const openConsentForSeat = (seatNo: number) => {
    if (!assignments[seatNo] || isAccountOwnerDriver(seatNo)) return;
    setConsentSeatNo(seatNo);
    setConsentModalVisible(true);
  };

  const setSeatConsent = async (seatNo: number, value: ConsentState | null) => {
    const next = { ...consents };
    if (value) next[seatNo] = value;
    else delete next[seatNo];
    await persistConsents(next);
    if (value === "confirmed") {
      recordConsentConfirmed(seatNo);
      // During an ongoing ride, an inactive seat can accept a new passenger
      // without restarting the sessions that are already running.
      if (isLockedIn && assignments[seatNo] && !activeSessions[seatNo]) {
        await startSeatSessions({ assignments, hardwareSeatNo, consents: next });
      }
    }
    void Haptics.notificationAsync(
      value === "confirmed"
        ? Haptics.NotificationFeedbackType.Success
        : value === "declined"
          ? Haptics.NotificationFeedbackType.Warning
          : Haptics.NotificationFeedbackType.Success,
    );
    setConsentModalVisible(false);
  };

  const chooseHardwareSeat = () => {
    if (isLockedIn) {
      Alert.alert("Monitoring is active", "End the session before changing the monitored seat.");
      return;
    }

    const assigned = SEATS.filter((seat) => Boolean(assignments[seat.seatNo]));
    if (assigned.length === 0) {
      Alert.alert("Assign a seat first", "Choose who is sitting in a seat before linking the SafeSeat hardware.");
      return;
    }

    setSensorPickerVisible(true);
  };

  const selectHardwareSeat = async (seatNo: number) => {
    if (savingSensor || isLockedIn || !assignments[seatNo]) return;
    setSavingSensor(true);
    try {
      await persistHardwareSeat(seatNo);
      recordSensorSelected(seatNo, !hasEffectiveConsent(seatNo));
      setSensorPickerVisible(false);
      void Haptics.selectionAsync();
      if (!hasEffectiveConsent(seatNo)) setTimeout(() => openConsentForSeat(seatNo), 180);
    } catch {
      Alert.alert("Could not select seat", "Please try again.");
    } finally {
      setSavingSensor(false);
    }
  };

  const handleLockIn = async () => {
    if (!hasAssignedSeats || startingRef.current) return;
    startingRef.current = true;
    setStarting(true);
    try {
    let linkedSeat = hardwareSeatNo;
    if (!linkedSeat || !assignments[linkedSeat]) {
      linkedSeat = Number(Object.keys(assignments)[0]) || null;
      await persistHardwareSeat(linkedSeat);
    }

    if (!linkedSeat) return;
    // Persist fallback selection too, so Home and alert routing use the same seat.
    await persistHardwareSeat(linkedSeat);

    if (!hasEffectiveConsent(linkedSeat)) {
      openConsentForSeat(linkedSeat);
      return;
    }

    // Re-check the hub at the exact moment monitoring starts so a stale
    // green UI state cannot accidentally launch an ANALYZING session.
    const liveStatus = await refreshHub();
    if (!liveStatus || !liveStatus.telemetry_ready) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert(
        "SafeSeat is offline",
        "SafeSeat must be connected and ready before monitoring can start.",
        [{ text: "OK" }],
      );
      return;
    }

    const initialStatuses: Record<number, SeatState> = {};
    Object.keys(assignments).forEach((seatStr) => {
      const seatNum = Number(seatStr);
      if (!isAccountOwnerDriver(seatNum) && consents[seatNum] === "declined") initialStatuses[seatNum] = "declined";
      else if (!hasEffectiveConsent(seatNum)) initialStatuses[seatNum] = "consent";
      else if (seatNum === linkedSeat) initialStatuses[seatNum] = "unknown";
      else initialStatuses[seatNum] = "offline";
    });

      // A new monitoring session must begin from ANALYZING until the Main Hub
      // produces its first decisive SAFE/WARNING/EMERGENCY result. Clear any
      // previous trip latch and any local UAT simulation before starting.
      cancelUatWarning();
      silenceAlertFeedback();
      resetDecisionLatch();
      setSimulationState("off");

      await Promise.all([
        AsyncStorage.setItem(IS_LOCKED_IN_KEY, JSON.stringify(true)),
        AsyncStorage.setItem(SEAT_STATUSES_KEY, JSON.stringify(initialStatuses)),
      ]);
      await startSeatSessions({ assignments, hardwareSeatNo: linkedSeat, consents });
      setIsLockedIn(true);
      recordMonitoringStarted();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/home");
    } catch (error) {
      console.error("Failed to start monitoring:", error);
      Alert.alert("Could not start monitoring", "SafeSeat could not save the current seat setup. Please try again.");
    } finally {
      startingRef.current = false;
      setStarting(false);
    }
  };

  const handleEndSession = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      "Manage passenger sessions",
      "Sessions now end per seat so one passenger can get off while the other seats continue. Open Home to choose the specific seat to end.",
      [
        { text: "Keep Here", style: "cancel" },
        { text: "Open Home", onPress: () => router.replace("/home") },
      ],
    );
  };

  const handleSeatAssigned = async (seatNumber: number, profile: Profile | null) => {
    const previousProfile = assignments[seatNumber];
    const updated = { ...assignments };
    if (profile) updated[seatNumber] = profile;
    else delete updated[seatNumber];

    // Keep the rendered seat map and the persisted assignment in lockstep.
    // Seat Options used to update only React state when removing a person,
    // leaving a stale profile in AsyncStorage. The assignment picker then
    // correctly (but confusingly) hid that profile as "already assigned".
    setAssignments(updated);
    if (Object.keys(updated).length > 0) {
      await AsyncStorage.setItem(SEAT_ASSIGNMENTS_KEY, JSON.stringify(updated));
    } else {
      await AsyncStorage.removeItem(SEAT_ASSIGNMENTS_KEY);
    }

    const nextConsents = { ...consents };
    if (!profile || previousProfile?.id !== profile.id) {
      delete nextConsents[seatNumber];
    }

    // Assigning the authenticated account owner to Driver is itself the
    // driver's active setup action. Store it as confirmed for consistency,
    // but every readiness check also treats it as confirmed even if an older
    // saved assignment has no consent entry.
    if (profile && seatNumber === 1 && profile.isAccountOwner) {
      nextConsents[seatNumber] = "confirmed";
    }
    await persistConsents(nextConsents);

    if (profile && hardwareSeatNo === null) {
      await persistHardwareSeat(seatNumber);
    } else if (!profile && hardwareSeatNo === seatNumber && !isLockedIn) {
      // Between rides the first remaining assignment can become the default
      // hardware seat. During an active ride the physical sensor stays linked
      // to its real seat even if that passenger has already left.
      const nextSeat = Number(Object.keys(updated)[0]) || null;
      await persistHardwareSeat(nextSeat);
    }

    if (profile && seatNumber === 1 && profile.isAccountOwner && isLockedIn && !activeSessions[seatNumber]) {
      await startSeatSessions({ assignments: updated, hardwareSeatNo, consents: nextConsents });
    }

    if (profile && !(seatNumber === 1 && profile.isAccountOwner)) {
      setConsentSeatNo(seatNumber);
      setTimeout(() => setConsentModalVisible(true), 180);
    }
  };

  const handleCardPress = (seatNo: number) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (guideStepId === "seats") {
      const profile = assignments[seatNo];
      if (!profile) {
        recordSeatTapped(seatNo, "assign");
      } else if (!hasEffectiveConsent(seatNo)) {
        recordSeatTapped(seatNo, "consent");
        openConsentForSeat(seatNo);
        return;
      } else {
        // Replay adapts to an already-configured seat instead of forcing the
        // user to reassign or reconfirm something that is already valid.
        recordSeatTapped(seatNo, "sensor");
        return;
      }
    }

    if (activeSessions[seatNo]) {
      Alert.alert(
        "Seat session is active",
        "End this passenger's session from Home before changing the person in this seat.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Open Home", onPress: () => router.replace("/home") },
        ],
      );
      return;
    }

    if (assignments[seatNo]) {
      setSeatOptionsSeatNo(seatNo);
      setSeatOptionsVisible(true);
      return;
    }

    setSelectedSeat(seatNo);
    setAssignModalVisible(true);
  };

  const getDisplayProfile = (profile?: Profile): Profile | undefined => {
    if (!profile) return undefined;

    const image = profile.icon || profile.pfp || profile.photoURL;
    return {
      ...profile,
      name: profile.sessionOnly || profile.isGuest
        ? "Guest"
        : profile.isAccountOwner
          ? "Me"
          : profile.name,
      icon: image,
    };
  };

  const startReadiness = !hasAssignedSeats
    ? "empty"
    : !hardwareSeatNo || !assignments[hardwareSeatNo]
      ? "offline"
      : !hasEffectiveConsent(hardwareSeatNo)
        ? "consent"
        : !hubConnected || !telemetryReady
          ? "offline"
          : "ready";

  const linkedSeatLabel = getSeatLabel(hardwareSeatNo);
  const linkedProfileName = hardwareSeatNo ? getDisplayProfile(assignments[hardwareSeatNo])?.name : undefined;

  return (
    <SafeAreaView style={styles.screen} edges={["left", "right", "bottom"]}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
        bounces={false}
        alwaysBounceVertical={false}
        overScrollMode="never"
      >
        <View style={styles.container}>
          <View style={styles.headerBlock}>
            <Text style={styles.eyebrow}>TRIP SETUP</Text>
            <View style={styles.titleRow}>
              <Text style={styles.pageHeader}>Assign Seats</Text>
              <View style={[styles.sessionPill, isLockedIn && styles.sessionPillLocked]}>
                <Text style={[styles.sessionPillText, isLockedIn && styles.sessionPillTextLocked]}>
                  {isLockedIn ? "MONITORING" : `${assignedSeatCount}/5 ASSIGNED`}
                </Text>
              </View>
            </View>
            <Text style={styles.pageSubhead}>{isLockedIn ? "Monitoring active · Inactive seats can take the next passenger." : "Tap a seat to assign."}</Text>
          </View>

          <View
            style={[
              styles.carMap,
              { height: carMapHeight },
            ]}
          >
            <Image
              source={require("../../../../assets/images/appImgs/car-cropped.png")}
              style={styles.carBackgroundImage}
              resizeMode="cover"
            />
            <View pointerEvents="none" style={StyleSheet.absoluteFill}>
              <LinearGradient colors={[themes.background, "transparent"]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.leftFade} />
              <LinearGradient colors={["transparent", themes.background]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.rightFade} />
              <LinearGradient colors={["transparent", themes.background]} style={styles.bottomFade} />
            </View>
            <View style={[styles.frontRow, { left: viewportWidth < 360 ? 28 : 38, right: viewportWidth < 360 ? 28 : 38 }]}>
              {SEATS.slice(0, 2).map((seat) => (
                <AssignCard
                  key={seat.seatNo}
                  seatNo={seat.seatNo}
                  assignedProfile={getDisplayProfile(assignments[seat.seatNo])}
                  pfp={assignments[seat.seatNo]?.icon || assignments[seat.seatNo]?.pfp || assignments[seat.seatNo]?.photoURL}
                  onPress={() => handleCardPress(seat.seatNo)}
                  state={getCardState(seat.seatNo)}
                  seatCode={seat.seatCode}
                  locked={Boolean(activeSessions[seat.seatNo])}
                  hardwareLinked={seat.seatNo === hardwareSeatNo}
                  guideActive={isStep("seats") && seat.seatNo === (guideSeatNo ?? 2)}
                />
              ))}
            </View>

            <View style={styles.backRow}>
              {SEATS.slice(2).map((seat) => (
                <AssignCard
                  key={seat.seatNo}
                  seatNo={seat.seatNo}
                  assignedProfile={getDisplayProfile(assignments[seat.seatNo])}
                  pfp={assignments[seat.seatNo]?.icon || assignments[seat.seatNo]?.pfp || assignments[seat.seatNo]?.photoURL}
                  onPress={() => handleCardPress(seat.seatNo)}
                  state={getCardState(seat.seatNo)}
                  seatCode={seat.seatCode}
                  locked={Boolean(activeSessions[seat.seatNo])}
                  hardwareLinked={seat.seatNo === hardwareSeatNo}
                  guideActive={isStep("seats") && seat.seatNo === (guideSeatNo ?? 2)}
                />
              ))}
            </View>
          </View>

          {prototypeIndicator ? <Pressable
            accessibilityRole="button"
            accessibilityLabel="SafeSeat Sensor. Choose the seat connected to the hardware"
            onPress={chooseHardwareSeat}
            style={({ pressed }) => [
              styles.hardwareLinkCard,
              pressed && !isLockedIn && styles.hardwareLinkPressed,
            ]}
          >
            <View style={styles.sensorMark}>
              <View
                style={[
                  styles.sensorDot,
                  { backgroundColor: hubConnected ? themes.primaryBttn : themes.textMuted },
                ]}
              />
            </View>
            <View style={styles.hardwareLinkCopy}>
              <Text style={styles.hardwareLinkEyebrow}>SAFESEAT SENSOR</Text>
              <Text style={styles.hardwareLinkTitle}>{getSeatLabel(hardwareSeatNo)}</Text>
              <Text style={styles.hardwareLinkText}>
                {hubConnected ? (telemetryReady ? "Connected and ready" : "Connecting") : "Offline"}
              </Text>
            </View>
            <View style={[styles.changePill, isLockedIn && styles.changePillLocked]}>
              <Text style={[styles.changePillText, isLockedIn && styles.changePillTextLocked]}>
                {isLockedIn ? "LINKED" : "CHANGE"}
              </Text>
            </View>
            <GuidePulseOverlay
              active={isStep("sensor")}
              label="TAP SENSOR"
              borderRadius={18}
              inset={-3}
              beaconPosition="top"
            />
          </Pressable> : null}

          <Modal visible={prototypeIndicator && sensorPickerVisible} transparent animationType="fade" onRequestClose={() => { if (!savingSensor) setSensorPickerVisible(false); }}>
            <View style={styles.pickerBackdrop}>
              <View style={styles.pickerSheet} accessibilityViewIsModal>
                <Text style={styles.hardwareLinkEyebrow}>{prototypeIndicator ? "SENSOR SEAT" : "MONITORING SETUP"}</Text>
                <Text style={styles.pickerTitle}>Which seat has the sensor?</Text>
                <Text style={styles.hardwareLinkText}>Choose the actual hardware location. Other seats stay unmonitored.</Text>
                <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ gap: 8 }}>
                  {SEATS.filter((seat) => Boolean(assignments[seat.seatNo])).map((seat) => (
                    <Pressable key={seat.seatNo} accessibilityRole="button" accessibilityState={{ selected: seat.seatNo === hardwareSeatNo, disabled: savingSensor }} disabled={savingSensor} onPress={() => void selectHardwareSeat(seat.seatNo)} style={[styles.pickerOption, seat.seatNo === hardwareSeatNo && { borderColor: themes.primaryBttn, backgroundColor: themes.primarySoft }]}>
                      <View style={{ flex: 1 }}><Text style={styles.hardwareLinkTitle}>{getSeatLabel(seat.seatNo)}</Text><Text style={styles.hardwareLinkText}>{getDisplayProfile(assignments[seat.seatNo])?.name}{hasEffectiveConsent(seat.seatNo) ? "" : " · Consent needed"}</Text></View>
                      <Text style={styles.changePillText}>{seat.seatNo === hardwareSeatNo ? "SELECTED" : "SELECT"}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
                <Pressable accessibilityRole="button" disabled={savingSensor} onPress={() => setSensorPickerVisible(false)} style={styles.pickerOption}><Text style={styles.hardwareLinkTitle}>{savingSensor ? "Saving…" : "Cancel"}</Text></Pressable>
              </View>
            </View>
          </Modal>

          <AssignSeatModal
            seat={selectedSeat}
            assignments={assignments}
            visible={assignModalVisible}
            onClose={() => setAssignModalVisible(false)}
            onSuccess={handleSeatAssigned}
          />

          <SeatOptionsModal
            visible={seatOptionsVisible && seatOptionsSeatNo !== null}
            seatLabel={getSeatLabel(seatOptionsSeatNo)}
            personName={seatOptionsSeatNo ? (getDisplayProfile(assignments[seatOptionsSeatNo])?.name ?? "Assigned person") : "Assigned person"}
            isDriverOwner={seatOptionsSeatNo ? isAccountOwnerDriver(seatOptionsSeatNo) : false}
            consent={seatOptionsSeatNo ? consents[seatOptionsSeatNo] : undefined}
            onClose={() => setSeatOptionsVisible(false)}
            onConsent={() => {
              if (!seatOptionsSeatNo) return;
              setSeatOptionsVisible(false);
              setTimeout(() => openConsentForSeat(seatOptionsSeatNo), 120);
            }}
            onChangePerson={() => {
              if (!seatOptionsSeatNo) return;
              setSelectedSeat(seatOptionsSeatNo);
              setSeatOptionsVisible(false);
              setTimeout(() => setAssignModalVisible(true), 120);
            }}
            onRemove={() => {
              if (!seatOptionsSeatNo) return;
              const seatNo = seatOptionsSeatNo;
              const person = getDisplayProfile(assignments[seatNo])?.name ?? "this person";
              Alert.alert(
                "Remove from seat?",
                `${person} will be removed from ${getSeatLabel(seatNo)}. The saved profile will not be deleted.`,
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Remove",
                    style: "destructive",
                    onPress: () => {
                      setSeatOptionsVisible(false);
                      void (async () => {
                        try {
                          await handleSeatAssigned(seatNo, null);
                          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        } catch (error) {
                          console.error("Failed to remove seat assignment:", error);
                          Alert.alert("Could not remove person", "Please try again.");
                          void loadState();
                        }
                      })();
                    },
                  },
                ],
              );
            }}
          />

          <Modal
            visible={consentModalVisible}
            transparent
            animationType="fade"
            statusBarTranslucent
            onRequestClose={() => setConsentModalVisible(false)}
          >
            <View style={styles.consentBackdrop}>
              <Pressable
                style={StyleSheet.absoluteFill}
                onPress={() => setConsentModalVisible(false)}
                accessibilityLabel="Close consent dialog"
              />
              <View style={styles.consentCard}>
                <View style={styles.consentHandle} />
                {isStep("consent") && guideSeatNo === consentSeatNo ? (
                  <View style={styles.consentGuideCompact}>
                    <View style={styles.consentGuideDot} />
                    <Text style={styles.consentGuideCompactText}>Guide: choose the passenger's consent response to continue</Text>
                  </View>
                ) : null}
                <Text style={styles.consentEyebrow}>TRIP CONSENT</Text>
                <Text style={styles.consentTitle}>Did {consentSeatNo ? getDisplayProfile(assignments[consentSeatNo])?.name ?? "this person" : "this person"} agree to SafeSeat monitoring?</Text>
                <Text style={styles.consentText}>{consentSeatNo && consents[consentSeatNo] === "confirmed" ? "Consent is currently marked as Agreed. You can leave it as is or choose a different response below." : "Choose the passenger's response for this trip."}</Text>

                <View style={styles.guideButtonWrap}>
                  <Button
                    label={consentSeatNo && consents[consentSeatNo] === "confirmed" ? "Agreed ✓" : "Agreed"}
                    variant="primary"
                    fullWidth
                    onPress={() => consentSeatNo && void setSeatConsent(consentSeatNo, "confirmed")}
                  />
                  <GuidePulseOverlay
                    active={isStep("consent") && guideSeatNo === consentSeatNo}
                    label="AGREED"
                    borderRadius={16}
                    inset={-3}
                    beaconPosition="top"
                  />
                </View>
                <Button
                  label="Not Yet"
                  variant="secondary"
                  fullWidth
                  onPress={() => consentSeatNo && void setSeatConsent(consentSeatNo, null)}
                />
                <Pressable
                  accessibilityRole="button"
                  onPress={() => consentSeatNo && void setSeatConsent(consentSeatNo, "declined")}
                  style={({ pressed }) => [styles.declineButton, pressed && styles.consentPressed]}
                >
                  <Text style={styles.declineButtonText}>Declined</Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    if (!consentSeatNo) return;
                    const seatNo = consentSeatNo;
                    setConsentModalVisible(false);
                    setSelectedSeat(seatNo);
                    setTimeout(() => setAssignModalVisible(true), 180);
                  }}
                  style={({ pressed }) => [styles.changePersonButton, pressed && styles.consentPressed]}
                >
                  <Text style={styles.changePersonText}>Choose Different Person</Text>
                </Pressable>
              </View>
            </View>
          </Modal>
        </View>
      </ScrollView>

      <View
        onLayout={(event) => {
          const nextHeight = Math.ceil(event.nativeEvent.layout.height);
          setStickyActionHeight((currentHeight) =>
            currentHeight === nextHeight ? currentHeight : nextHeight,
          );
        }}
        style={[
          styles.stickyActionWrap,
          { paddingBottom: Math.max(insets.bottom, 8) },
        ]}
      >
        <View style={styles.stickyActionInner}>
          <GuidePulseOverlay
            active={isStep("start")}
            label="START HERE"
            borderRadius={20}
            inset={-4}
            beaconPosition="top"
          />
          <View style={styles.stickyStatusRow}>
            <View style={[styles.stickyStatusDot, { backgroundColor: isLockedIn ? themes.primaryBttn : hasAssignedSeats ? themes.primaryBttn : themes.textMuted }]} />
            <Text style={styles.stickyActionTitle}>
              {isLockedIn
                ? `${linkedSeatLabel} is monitoring`
                : startReadiness === "ready"
                  ? `${linkedSeatLabel} is ready`
                  : startReadiness === "consent"
                    ? `${linkedProfileName ?? linkedSeatLabel} needs consent`
                    : startReadiness === "offline"
                      ? "SafeSeat is offline"
                      : "Choose at least one seat above"}
            </Text>
          </View>
          {isLockedIn ? (
            <Button label="Manage Sessions" onPress={handleEndSession} variant="secondary" fullWidth style={styles.stickyButton} />
          ) : startReadiness === "consent" ? (
            <Button
              label="Passenger Consent"
              onPress={() => hardwareSeatNo && openConsentForSeat(hardwareSeatNo)}
              variant="primary"
              enabled={Boolean(hardwareSeatNo)}
              fullWidth
              style={styles.stickyButton}
            />
          ) : (
            <Button
              label={startReadiness === "ready" ? "Start Monitoring" : startReadiness === "offline" ? "Offline" : "Assign a Person"}
              onPress={() => void handleLockIn()}
              variant="primary"
              loading={starting}
              enabled={startReadiness === "ready" && !starting}
              fullWidth
              style={styles.stickyButton}
            />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (themes: ThemePalette) => StyleSheet.create({
  pickerBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: 20 },
  pickerSheet: { maxHeight: "90%", padding: 20, gap: 14, borderRadius: 24, backgroundColor: themes.backgroundElement, borderWidth: 1, borderColor: themes.divider },
  pickerTitle: { fontSize: 22, lineHeight: 28, color: themes.text, fontFamily: "Body-Bold" },
  pickerOption: { minHeight: 64, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: themes.divider, flexDirection: "row", alignItems: "center", gap: 10 },
  screen: {
    flex: 1,
    backgroundColor: themes.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: spacing.one,
  },
  container: {
    width: "100%",
    paddingHorizontal: spacing.two,
    gap: spacing.one + 4,
  },
  headerBlock: {
    gap: 3,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.one,
  },
  eyebrow: {
    color: themes.primaryBttn,
    fontSize: 12.5,
    letterSpacing: 1.35,
    fontFamily: "Body-Bold",
  },
  pageHeader: {
    fontSize: 31,
    fontFamily: "Logo-Font",
    color: themes.text,
  },
  pageSubhead: {
    color: themes.textSecondary,
    fontSize: 15,
    lineHeight: 21,
    fontFamily: "Body-Regular",
  },
  sessionPill: {
    paddingHorizontal: spacing.one,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: themes.surfaceSoft,
    borderWidth: 1,
    borderColor: themes.divider,
  },
  sessionPillLocked: {
    backgroundColor: themes.primarySoft,
    borderColor: themes.primaryBorder,
  },
  sessionPillText: {
    color: themes.textMuted,
    fontSize: 10.5,
    letterSpacing: 0.7,
    fontFamily: "Body-Bold",
  },
  sessionPillTextLocked: {
    color: themes.primaryBttn,
  },
  hardwareLinkCard: {
    position: "relative",
    overflow: "visible",
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.one + 2,
    paddingHorizontal: spacing.one + 4,
    paddingVertical: spacing.one,
    borderRadius: 20,
    backgroundColor: themes.backgroundElement,
    borderWidth: 1,
    borderColor: themes.divider,
  },
  hardwareLinkPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.99 }],
    borderColor: themes.primaryBorder,
  },
  sensorMark: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: themes.surfaceSoft,
    borderWidth: 1,
    borderColor: themes.divider,
  },
  sensorDot: { width: 11, height: 11, borderRadius: 6 },
  hardwareLinkCopy: { flex: 1, minWidth: 0 },
  hardwareLinkEyebrow: { color: themes.textMuted, fontSize: 10, letterSpacing: 0.9, fontFamily: "Body-Bold" },
  hardwareLinkTitle: { color: themes.text, fontSize: 16, marginTop: 2, fontFamily: "Body-Bold" },
  hardwareLinkText: { color: themes.textSecondary, fontSize: 12, marginTop: 2, fontFamily: "Body-Regular" },
  changePill: {
    paddingHorizontal: spacing.one + 2,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: themes.primarySoft,
    borderWidth: 1,
    borderColor: themes.primaryBorder,
  },
  changePillLocked: { backgroundColor: themes.surfaceSoft, borderColor: themes.divider },
  changePillText: { color: themes.primaryBttn, fontSize: 10, letterSpacing: 0.6, fontFamily: "Body-Bold" },
  changePillTextLocked: { color: themes.textMuted },
  leftFade: { position: "absolute", left: 0, top: 0, bottom: 0, width: 40 },
  rightFade: { position: "absolute", right: 0, top: 0, bottom: 0, width: 40 },
  bottomFade: { position: "absolute", left: 0, right: 0, bottom: 0, height: 36 },
  carMap: {
    minHeight: 360,
    marginTop: 0,
    borderRadius: 26,
    overflow: "hidden",
    backgroundColor: themes.surfaceSoft,
    borderWidth: 1,
    borderColor: "rgba(117,184,255,0.18)",
    shadowColor: themes.shadow,
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  carBackgroundImage: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    width: "100%",
    height: "100%",
  },
  frontRow: {
    position: "absolute",
    top: "22%",
    left: 52,
    right: 52,
    gap: spacing.one + 4,
    flexDirection: "row",
    height: "27%",
  },
  backRow: {
    position: "absolute",
    top: "61%",
    left: 14,
    right: 14,
    gap: spacing.one,
    flexDirection: "row",
    height: "26%",
  },
  stickyActionWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.two,
    paddingTop: 10,
    backgroundColor: themes.mode === "dark" ? "rgba(11,18,32,0.97)" : "rgba(244,248,246,0.97)",
    borderTopWidth: 1,
    borderTopColor: themes.divider,
    shadowColor: themes.shadow,
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -8 },
    elevation: 12,
  },
  stickyActionInner: {
    position: "relative",
    overflow: "visible",
    gap: 8,
    paddingTop: 2,
  },
  stickyStatusRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  stickyStatusDot: { width: 7, height: 7, borderRadius: 4 },
  stickyActionTitle: { color: themes.textSecondary, fontSize: 10.5, fontFamily: "Body-Medium" },
  stickyButton: { minHeight: 50, borderRadius: 16 },
  consentBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: themes.overlay,
    padding: spacing.two,
  },
  consentGuideCallout: {
    padding: 11,
    borderRadius: 14,
    backgroundColor: "rgba(31,210,149,0.09)",
    borderWidth: 1,
    borderColor: "rgba(31,210,149,0.32)",
    gap: 3,
    marginBottom: 8,
  },
  consentGuideEyebrow: { color: themes.primaryBttn, fontSize: 9, letterSpacing: 0.9, fontFamily: "Body-Bold" },
  consentGuideTitle: { color: themes.text, fontSize: 12.5, lineHeight: 17, fontFamily: "Body-Bold" },
  consentGuideText: { color: themes.textSecondary, fontSize: 11, lineHeight: 15, fontFamily: "Body-Regular" },
  consentCard: {
    borderRadius: 28,
    backgroundColor: themes.backgroundElevated,
    borderWidth: 1,
    borderColor: themes.divider,
    padding: spacing.two,
    gap: spacing.one,
    shadowColor: themes.shadow,
    shadowOpacity: 0.34,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -8 },
    elevation: 16,
  },
  consentHandle: {
    alignSelf: "center",
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: themes.divider,
    marginBottom: 4,
  },
  consentEyebrow: { color: themes.primaryBttn, fontSize: 9.5, letterSpacing: 1.15, fontFamily: "Body-Bold" },
  consentTitle: { color: themes.text, fontSize: 24, lineHeight: 27, fontFamily: "Body-Bold" },
  consentText: { color: themes.textSecondary, fontSize: 15, lineHeight: 21, fontFamily: "Body-Regular", marginBottom: 3 },
  declineButton: {
    minHeight: 46,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: `${themes.warnBttn}88`,
    backgroundColor: `${themes.warnBttn}0F`,
    alignItems: "center",
    justifyContent: "center",
  },
  declineButtonText: { color: themes.warnBttn, fontSize: 15, fontFamily: "Body-Bold" },
  changePersonButton: { alignItems: "center", justifyContent: "center", paddingVertical: 8 },
  changePersonText: { color: themes.textSecondary, fontSize: 14, fontFamily: "Body-Bold" },
  consentPressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
  guideTarget: {
    borderWidth: 2,
    borderColor: themes.primaryBttn,
    shadowColor: themes.primaryBttn,
    shadowOpacity: 0.32,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  guideStickyTarget: {
    borderTopWidth: 2,
    borderTopColor: themes.primaryBttn,
    shadowColor: themes.primaryBttn,
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -2 },
    elevation: 10,
  },

  consentGuideCompact: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(31,210,149,0.09)",
    borderWidth: 1,
    borderColor: "rgba(31,210,149,0.28)",
  },
  consentGuideDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: themes.primaryBttn },
  consentGuideCompactText: { color: themes.primaryBttn, fontSize: 10, fontFamily: "Body-Bold" },
  guideButtonWrap: { position: "relative", overflow: "visible" },
});
