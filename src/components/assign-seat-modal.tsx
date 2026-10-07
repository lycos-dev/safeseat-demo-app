import { FontSize as fontsize, Spacing as spacing, type ThemePalette } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { useDriverGuide } from "@/hooks/driver-guide-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import * as SecureStore from "expo-secure-store";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { auth, db } from "../firebase";
import Button from "./button";
import GuidePulseOverlay from "./guide-pulse-overlay";
import ProfileList from "./profile-list";

export type Profile = {
  id: string;
  name: string;
  icon?: string;
  isAccountOwner?: boolean;
  isGuest?: boolean;
  sessionOnly?: boolean;
};

type Props = {
  visible: boolean;
  seat: number;
  assignments?: Record<number, Profile>;
  onClose: () => void;
  onSuccess?: (seat: number, profile: Profile | null) => void | Promise<void>;
};

const SEAT_ASSIGNMENTS_KEY = "seatAssignments";

const ROLE_LABELS: Record<number, string> = {
  1: "Driver",
  2: "Front Passenger",
  3: "Left Rear",
  4: "Center Rear",
  5: "Right Rear",
};

export default function AssignSeatModal({ visible, onClose, onSuccess, seat, assignments: liveAssignments }: Props) {
  const themes = useTheme();
  const styles = createStyles(themes);
  const { isStep, selectedSeatNo, recordAssignmentSaved } = useDriverGuide();
  const guideActiveForSeat = isStep("assign") && selectedSeatNo === seat;
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingProfiles, setIsFetchingProfiles] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [isCurrentlyAssigned, setIsCurrentlyAssigned] = useState(false);

  useEffect(() => {
    if (!visible) return;

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const currentUser = auth.currentUser;
    if (!currentUser) return;

    let cancelled = false;

    void (async () => {
      setIsFetchingProfiles(true);
      try {
        const combinedList: Profile[] = [];
        let primaryName = currentUser.displayName;
        let primaryIcon = currentUser.photoURL ?? undefined;

        const localHealthRaw = await SecureStore.getItemAsync("user_health_profile");
        if (localHealthRaw) {
          const localHealth = JSON.parse(localHealthRaw);
          if (localHealth.name) primaryName = localHealth.name;
          if (localHealth.icon || localHealth.pfp) {
            primaryIcon = localHealth.icon ?? localHealth.pfp;
          }
        }

        const userDocSnap = await getDoc(doc(db, "users", currentUser.uid));
        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          if (userData.name) primaryName = userData.name;
          if (userData.icon || userData.photoURL) {
            primaryIcon = userData.icon ?? userData.photoURL;
          }
        }

        combinedList.push({
          id: currentUser.uid,
          name: `${primaryName ?? "Me"} (Me)`,
          icon: primaryIcon,
          isAccountOwner: true,
        });

        const profilesRef = collection(db, "users", currentUser.uid, "profiles");
        const snapshot = await getDocs(profilesRef);
        combinedList.push(
          ...snapshot.docs.map((docSnap) => {
            const data = docSnap.data();
            return {
              id: docSnap.id,
              name: data.name ?? "Unnamed Profile",
              icon: data.icon ?? data.photoURL,
            } satisfies Profile;
          }),
        );

        const raw = liveAssignments ? null : await AsyncStorage.getItem(SEAT_ASSIGNMENTS_KEY);
        const assignments: Record<number, Profile> = liveAssignments ?? (raw ? JSON.parse(raw) : {});
        const assignedSeatProfile = assignments[seat];

        setIsCurrentlyAssigned(Boolean(assignedSeatProfile));
        setSelectedProfileId(
          assignedSeatProfile && !assignedSeatProfile.sessionOnly
            ? assignedSeatProfile.id
            : null,
        );

        const assignedOtherIds = new Set<string>();
        Object.entries(assignments).forEach(([seatNumStr, profile]) => {
          if (
            Number(seatNumStr) !== seat &&
            profile?.id &&
            !profile.sessionOnly
          ) {
            assignedOtherIds.add(profile.id);
          }
        });

        if (cancelled) return;
        setProfiles(combinedList.filter((profile) => !assignedOtherIds.has(profile.id)));
      } catch (error) {
        console.error("Error fetching profiles/user:", error);
        if (!cancelled) {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          Alert.alert("Load Error", "Failed to load saved profiles. Please try again.");
        }
      } finally {
        if (!cancelled) setIsFetchingProfiles(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [visible, seat, liveAssignments]);

  const resetAndClose = () => {
    setSelectedProfileId(null);
    onClose();
  };

  const persistAssignment = async (profile: Profile) => {
    const raw = liveAssignments ? null : await AsyncStorage.getItem(SEAT_ASSIGNMENTS_KEY);
    const assignments: Record<number, Profile> = { ...(liveAssignments ?? (raw ? JSON.parse(raw) : {})) };
    assignments[seat] = profile;
    await AsyncStorage.setItem(SEAT_ASSIGNMENTS_KEY, JSON.stringify(assignments));

    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await onSuccess?.(seat, profile);
    if (guideActiveForSeat) {
      recordAssignmentSaved(seat, !(seat === 1 && profile.isAccountOwner));
    }
    resetAndClose();
  };

  const handleSave = async () => {
    if (!selectedProfileId) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert("No profile selected", "Choose a saved profile, or use Guest for a passenger seat.");
      return;
    }

    const selectedProfile = profiles.find((profile) => profile.id === selectedProfileId);
    if (!selectedProfile) return;

    setIsLoading(true);
    try {
      await persistAssignment(selectedProfile);
    } catch (error) {
      console.error("Error saving seat assignment:", error);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Save Error", "Failed to assign this seat. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuest = async () => {
    if (seat === 1) return;

    setIsLoading(true);
    try {
      await persistAssignment({
        id: `guest-seat-${seat}`,
        name: "Guest",
        isGuest: true,
        sessionOnly: true,
      });
    } catch (error) {
      console.error("Error assigning guest:", error);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Save Error", "Could not create the session-only guest.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnassign = async () => {
    setIsLoading(true);
    try {
      const raw = liveAssignments ? null : await AsyncStorage.getItem(SEAT_ASSIGNMENTS_KEY);
      const assignments: Record<number, Profile> = { ...(liveAssignments ?? (raw ? JSON.parse(raw) : {})) };
      delete assignments[seat];
      if (Object.keys(assignments).length > 0) {
        await AsyncStorage.setItem(SEAT_ASSIGNMENTS_KEY, JSON.stringify(assignments));
      } else {
        await AsyncStorage.removeItem(SEAT_ASSIGNMENTS_KEY);
      }

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await onSuccess?.(seat, null);
      resetAndClose();
    } catch (error) {
      console.error("Error unassigning seat:", error);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", "Failed to unassign this seat. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const role = ROLE_LABELS[seat] ?? `Seat ${seat}`;

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.container}>
          {guideActiveForSeat ? (
            <View style={styles.guideCompact}>
              <View style={styles.guideCompactDot} />
              <Text style={styles.guideCompactText}>
                {selectedProfileId ? "Now tap Assign below" : "Tap a person to select them"}
              </Text>
            </View>
          ) : null}

          <View style={styles.headerBlock}>
            <Text style={styles.eyebrow}>ASSIGN SEAT</Text>
            <Text style={styles.header}>Who is in the {role} seat?</Text>
            <Text style={styles.subhead}>Choose a person below. This person will appear on the {role} seat map.</Text>
          </View>

          {seat !== 1 && (
            <Pressable
              disabled={isLoading || isFetchingProfiles}
              onPress={() => void handleGuest()}
              style={({ pressed }) => [styles.guestCard, pressed && styles.pressed]}
            >
              <View style={styles.guestIcon}>
                <Text style={styles.guestIconText}>G</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.guestTitle}>Guest passenger</Text>
                <Text style={styles.guestText}>Use for this trip only. Nothing is saved after the session.</Text>
              </View>
              <Text style={styles.guestAction}>SELECT</Text>
            </Pressable>
          )}

          <View style={styles.savedHeaderRow}>
            <Text style={styles.savedHeader}>CHOOSE A PERSON</Text>
            <Text style={styles.savedCount}>{profiles.length}</Text>
          </View>

          <View style={styles.listWrap}>
            <GuidePulseOverlay
              active={guideActiveForSeat && !selectedProfileId && !isFetchingProfiles}
              label="CHOOSE PERSON"
              borderRadius={16}
              inset={-3}
              beaconPosition="top"
            />
            {isFetchingProfiles ? (
              <ActivityIndicator size="large" color={themes.primaryBttn} style={styles.loader} />
            ) : (
              <FlatList
                data={profiles}
                keyExtractor={(item) => item.id}
                renderItem={({ item, index }) => (
                  <ProfileList
                    name={item.name}
                    pfp={item.icon}
                    checked={item.id === selectedProfileId}
                    onPress={() => {
                      void Haptics.selectionAsync();
                      setSelectedProfileId(item.id);
                    }}
                    isLast={index !== profiles.length - 1}
                  />
                )}
                style={{ width: "100%" }}
                ListEmptyComponent={
                  <View style={styles.emptyWrap}>
                    <Text style={styles.emptyTitle}>No saved profiles available</Text>
                    <Text style={styles.emptyText}>Create one from Profiles, or use Guest for a passenger seat.</Text>
                  </View>
                }
              />
            )}
          </View>

          <View style={styles.actionRow}>
            {isCurrentlyAssigned && (
              <Button
                variant="tertiary"
                label="Remove"
                onPress={() => void handleUnassign()}
                enabled={!isFetchingProfiles && !isLoading}
              />
            )}
            <Button
              variant="secondary"
              label="Cancel"
              onPress={resetAndClose}
              enabled={!isLoading}
            />
            <View style={styles.assignButtonWrap}>
              <Button
                variant="primary"
                label={`Assign to ${role}`}
                onPress={() => void handleSave()}
                enabled={!isFetchingProfiles && !isLoading && Boolean(selectedProfileId)}
                fullWidth
              />
              <GuidePulseOverlay
                active={guideActiveForSeat && Boolean(selectedProfileId)}
                label="ASSIGN"
                borderRadius={16}
                inset={-3}
                beaconPosition="top"
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (themes: ThemePalette) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: themes.overlay,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.two,
  },
  container: {
    width: "100%",
    maxWidth: 420,
    maxHeight: "88%",
    backgroundColor: themes.backgroundElevated,
    borderWidth: 1,
    borderColor: themes.divider,
    padding: spacing.two,
    borderRadius: 24,
    gap: spacing.two,
  },
  guideCompact: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(31,210,149,0.09)",
    borderWidth: 1,
    borderColor: "rgba(31,210,149,0.28)",
  },
  guideCompactDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: themes.primaryBttn },
  guideCompactText: { color: themes.primaryBttn, fontSize: 11.5, fontFamily: "Body-Bold" },
  headerBlock: {
    gap: spacing.half,
  },
  eyebrow: {
    color: themes.primaryBttn,
    fontSize: 10,
    letterSpacing: 1.2,
    fontFamily: "Body-Bold",
  },
  header: {
    color: themes.text,
    fontSize: 25,
    lineHeight: 31,
    fontFamily: "Heading-Font",
  },
  subhead: {
    color: themes.textSecondary,
    fontSize: 14.5,
    lineHeight: 20,
    fontFamily: "Body-Regular",
  },
  guestCard: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.one,
    padding: spacing.one + 4,
    borderRadius: 17,
    backgroundColor: themes.primarySoft,
    borderWidth: 1,
    borderColor: themes.primaryBorder,
  },
  guestIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: themes.primaryBttn,
  },
  guestIconText: {
    color: themes.primaryBttnText,
    fontSize: 14,
    fontFamily: "Body-Bold",
  },
  guestTitle: {
    color: themes.text,
    fontSize: 14,
    fontFamily: "Body-Bold",
  },
  guestText: {
    color: themes.textSecondary,
    fontSize: 10,
    lineHeight: 14,
    marginTop: 2,
    fontFamily: "Body-Regular",
  },
  guestAction: {
    color: themes.primaryBttn,
    fontSize: 10,
    letterSpacing: 0.8,
    fontFamily: "Body-Bold",
  },
  pressed: {
    opacity: 0.75,
  },
  savedHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  savedHeader: {
    color: themes.textMuted,
    fontSize: 10,
    letterSpacing: 1.1,
    fontFamily: "Body-Bold",
  },
  savedCount: {
    color: themes.textSecondary,
    fontSize: fontsize.caption,
    fontFamily: "Body-Medium",
  },
  listWrap: {
    position: "relative",
    maxHeight: 260,
    width: "100%",
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: themes.divider,
  },
  loader: {
    padding: spacing.three,
  },
  emptyWrap: {
    padding: spacing.three,
    alignItems: "center",
  },
  emptyTitle: {
    color: themes.text,
    fontSize: 14,
    fontFamily: "Body-Bold",
  },
  emptyText: {
    color: themes.textSecondary,
    fontSize: fontsize.caption,
    lineHeight: 17,
    textAlign: "center",
    marginTop: spacing.half,
    fontFamily: "Body-Regular",
  },
  assignButtonWrap: { flex: 1, position: "relative", overflow: "visible" },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.half,
  },
});
