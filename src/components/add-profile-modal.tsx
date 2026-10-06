import { FontSize as fontsize, Spacing as spacing, type ThemePalette } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { useUserPreferences } from "@/hooks/user-preferences-context";
import * as Haptics from "expo-haptics";
import { addDoc, collection } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { Dropdown } from "react-native-element-dropdown";

import { auth, db } from "../firebase";
import Button from "./button";
import TextInput from "./text-input";

type Props = {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
};

const bloodTypes = [
  { label: "Not known", value: "" },
  { label: "A+", value: "a+" },
  { label: "A-", value: "a-" },
  { label: "B+", value: "b+" },
  { label: "B-", value: "b-" },
  { label: "AB+", value: "ab+" },
  { label: "AB-", value: "ab-" },
  { label: "O+", value: "o+" },
  { label: "O-", value: "o-" },
];

const isLeapYear = (year: number): boolean =>
  (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

const isValidDate = (year: number, month: number, day: number): boolean => {
  const today = new Date();
  const currentYear = today.getFullYear();
  if (year < 1900 || year > currentYear || month < 1 || month > 12) return false;
  const daysInMonths = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (day < 1 || day > daysInMonths[month - 1]) return false;
  if (year === currentYear) {
    const currentMonth = today.getMonth() + 1;
    if (month > currentMonth || (month === currentMonth && day > today.getDate())) return false;
  }
  return true;
};

function FieldHeader({ label, optional = false, hint }: { label: string; optional?: boolean; hint?: string }) {
  const themes = useTheme();
  const styles = createStyles(themes);
  return (
    <View style={styles.fieldHeaderRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
      </View>
      <View style={[styles.requirementPill, optional && styles.optionalPill]}>
        <Text style={[styles.requirementText, optional && styles.optionalText]}>{optional ? "OPTIONAL" : "REQUIRED"}</Text>
      </View>
    </View>
  );
}

export default function AddProfileModal({ visible, onClose, onSuccess }: Props) {

  const themes = useTheme();
  const styles = createStyles(themes);  const [isLoading, setIsLoading] = useState(false);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const { useMetric: isMetric } = useUserPreferences();
  const [heightCm, setHeightCm] = useState("");
  const [heightFt, setHeightFt] = useState("");
  const [heightIn, setHeightIn] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [weightLb, setWeightLb] = useState("");
  const [bloodType, setBloodType] = useState("");
  const [allergies, setAllergies] = useState("");

  useEffect(() => {
    if (visible) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [visible]);

  const parseNum = (value: string) => parseFloat(value) || 0;
  const hasUnsavedChanges = [name, icon, birthMonth, birthDate, birthYear, bloodType, allergies, heightCm, heightFt, heightIn, weightKg, weightLb]
    .some((value) => value.trim() !== "");

  const parsedYear = parseInt(birthYear, 10);
  const parsedMonth = parseInt(birthMonth, 10);
  const parsedDate = parseInt(birthDate, 10);
  const hasBirthdayInput = [birthYear, birthMonth, birthDate].some((value) => value.trim() !== "");
  const hasCompleteBirthday = [birthYear, birthMonth, birthDate].every((value) => value.trim() !== "");
  const isValidDateInput = hasCompleteBirthday && isValidDate(parsedYear, parsedMonth, parsedDate);
  const isBirthdayInvalid = hasBirthdayInput && !isValidDateInput;

  const metricHeightProvided = heightCm.trim() !== "";
  const imperialHeightProvided = heightFt.trim() !== "" || heightIn.trim() !== "";
  const metricWeightProvided = weightKg.trim() !== "";
  const imperialWeightProvided = weightLb.trim() !== "";

  const isHeightInvalid = isMetric
    ? metricHeightProvided && parseNum(heightCm) <= 0
    : imperialHeightProvided && (heightFt.trim() === "" || parseNum(heightFt) < 0 || parseNum(heightFt) > 10 || parseNum(heightIn || "0") < 0 || parseNum(heightIn || "0") >= 12 || (parseNum(heightFt) * 12 + parseNum(heightIn || "0")) <= 0);
  const isWeightInvalid = isMetric
    ? metricWeightProvided && parseNum(weightKg) <= 0
    : imperialWeightProvided && parseNum(weightLb) <= 0;
  const isFormInvalid = name.trim() === "" || isBirthdayInvalid || isHeightInvalid || isWeightInvalid;

  const handleResetAndClose = () => {
    setName(""); setIcon(""); setBirthYear(""); setBirthMonth(""); setBirthDate("");
    setHeightCm(""); setHeightFt(""); setHeightIn(""); setWeightKg(""); setWeightLb("");
    setBloodType(""); setAllergies("");
    onClose();
  };

  const requestClose = () => {
    if (!hasUnsavedChanges) {
      handleResetAndClose();
      return;
    }
    Alert.alert("Discard this profile?", "Your entered information has not been saved yet.", [
      { text: "Keep Editing", style: "cancel" },
      { text: "Discard", style: "destructive", onPress: handleResetAndClose },
    ]);
  };

  const handleSave = async () => {
    if (isFormInvalid || isLoading) return;
    const currentUser = auth.currentUser;
    if (!currentUser) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Sign-in required", "You must be signed in to add a person.");
      return;
    }

    setIsLoading(true);
    try {
      let finalHeightCm: number | null = null;
      let finalWeightKg: number | null = null;
      if (isMetric) {
        if (metricHeightProvided) finalHeightCm = parseNum(heightCm);
        if (metricWeightProvided) finalWeightKg = parseNum(weightKg);
      } else {
        if (imperialHeightProvided) {
          const totalInches = parseNum(heightFt) * 12 + parseNum(heightIn || "0");
          finalHeightCm = Math.round(totalInches * 2.54 * 10) / 10;
        }
        if (imperialWeightProvided) finalWeightKg = Math.round(parseNum(weightLb) * 0.45359237 * 10) / 10;
      }

      await addDoc(collection(db, "users", currentUser.uid, "profiles"), {
        name: name.trim(),
        icon: icon.trim() || null,
        birthYear: isValidDateInput ? parsedYear : null,
        birthMonth: isValidDateInput ? parsedMonth : null,
        birthDate: isValidDateInput ? parsedDate : null,
        bloodType: bloodType.trim() || null,
        allergies: allergies.trim() || null,
        heightCm: finalHeightCm,
        weightKg: finalWeightKg,
        displayHeight: finalHeightCm === null ? null : (isMetric ? `${heightCm} cm` : `${heightFt} ft ${heightIn || "0"} in`),
        displayWeight: finalWeightKg === null ? null : (isMetric ? `${weightKg} kg` : `${weightLb} lb`),
        createdAt: new Date().toISOString(),
      });

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      handleResetAndClose();
      onSuccess?.();
    } catch (error) {
      console.error("Error saving profile to Firestore:", error);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Could not save person", "Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={requestClose}>
      <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
        <View style={styles.backdrop}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.keyboardWrap}>
            <View style={styles.container}>
              <View style={styles.modalHeader}>
                <View style={styles.profileGlyph}><Text style={styles.profileGlyphText}>+</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.eyebrow}>SAVED PERSON</Text>
                  <Text style={styles.header}>Add a person</Text>
                  <Text style={styles.subhead}>Create a reusable profile for seat assignment.</Text>
                </View>
              </View>

              <View style={styles.requiredNotice}>
                <View style={styles.requiredNoticeDot} />
                <Text style={styles.requiredNoticeText}>Only the person’s name is required. All other details are optional and can be added later.</Text>
              </View>

              <ScrollView style={styles.formScroll} contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <View style={styles.fieldGroup}>
                  <FieldHeader label="Name" />
                  <TextInput type="text" variant="regular" placeholder="Full name" enabled={!isLoading} value={name} onChangeText={setName} />
                </View>

                <View style={styles.fieldGroup}>
                  <FieldHeader label="Birthday" optional hint="Add this only if known." />
                  <View style={styles.dateRow}>
                    <View style={{ flex: 0.8 }}><TextInput type="number" variant="regular" placeholder="MM" enabled={!isLoading} value={birthMonth} onChangeText={setBirthMonth} /></View>
                    <View style={{ flex: 0.8 }}><TextInput type="number" variant="regular" placeholder="DD" enabled={!isLoading} value={birthDate} onChangeText={setBirthDate} /></View>
                    <View style={{ flex: 1.2 }}><TextInput type="number" variant="regular" placeholder="YYYY" enabled={!isLoading} value={birthYear} onChangeText={setBirthYear} /></View>
                  </View>
                  {isBirthdayInvalid ? (
                    <Text style={styles.validationText}>Enter a complete, valid birthday or leave all three fields blank.</Text>
                  ) : null}
                </View>

                <View style={styles.fieldGroup}>
                  <FieldHeader label="Height & weight" optional hint="Optional reference information; not required for seat monitoring." />
                  {isMetric ? (
                    <View style={styles.splitRow}>
                      <View style={{ flex: 1 }}><TextInput type="number" variant="regular" placeholder="Height (cm)" enabled={!isLoading} value={heightCm} onChangeText={setHeightCm} /></View>
                      <View style={{ flex: 1 }}><TextInput type="number" variant="regular" placeholder="Weight (kg)" enabled={!isLoading} value={weightKg} onChangeText={setWeightKg} /></View>
                    </View>
                  ) : (
                    <View style={{ gap: spacing.one }}>
                      <View style={styles.splitRow}>
                        <View style={{ flex: 1 }}><TextInput type="number" variant="regular" placeholder="Height (ft)" enabled={!isLoading} value={heightFt} onChangeText={setHeightFt} /></View>
                        <View style={{ flex: 1 }}><TextInput type="number" variant="regular" placeholder="Height (in)" enabled={!isLoading} value={heightIn} onChangeText={setHeightIn} /></View>
                      </View>
                      <TextInput type="number" variant="regular" placeholder="Weight (lb)" enabled={!isLoading} value={weightLb} onChangeText={setWeightLb} />
                    </View>
                  )}
                  {isHeightInvalid || isWeightInvalid ? (
                    <Text style={styles.validationText}>Enter valid positive height/weight values, or leave them blank.</Text>
                  ) : null}
                </View>

                <View style={styles.fieldGroup}>
                  <FieldHeader label="Blood type" optional hint="Only add this if it is known." />
                  <Dropdown
                    mode="default"
                    data={bloodTypes}
                    labelField="label"
                    valueField="value"
                    selectedTextStyle={styles.dropdownSelected}
                    placeholder="Select blood type"
                    placeholderStyle={styles.dropdownPlaceholder}
                    value={bloodType}
                    disable={isLoading}
                    style={styles.input}
                    containerStyle={styles.dropdownContainer}
                    itemTextStyle={styles.dropdownItemText}
                    itemContainerStyle={styles.dropdownItem}
                    activeColor={themes.primaryBttn}
                    maxHeight={spacing.ten * 3}
                    onChange={(item) => setBloodType(item.value)}
                    autoScroll={false}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <FieldHeader label="Allergies" optional />
                  <TextInput type="text" variant="regular" placeholder="e.g. Peanuts, penicillin" enabled={!isLoading} value={allergies} onChangeText={setAllergies} />
                </View>
              </ScrollView>

              <View style={styles.actionRow}>
                <Button variant={hasUnsavedChanges ? "warn" : "secondary"} label={hasUnsavedChanges ? "Discard" : "Cancel"} enabled={!isLoading} onPress={requestClose} />
                <View style={{ flex: 1 }}>
                  <Button variant="primary" label="Save Person" onPress={() => void handleSave()} enabled={!isFormInvalid && !isLoading} loading={isLoading} fullWidth />
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const createStyles = (themes: ThemePalette) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(3,7,15,0.86)", justifyContent: "center", alignItems: "center", paddingHorizontal: spacing.two },
  keyboardWrap: { width: "100%", maxWidth: 430 },
  container: { width: "100%", maxHeight: "90%", backgroundColor: themes.backgroundElevated, borderWidth: 1, borderColor: themes.divider, borderRadius: 26, padding: spacing.two, gap: spacing.one + 4, shadowColor: "#000", shadowOpacity: 0.32, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 8 },
  modalHeader: { flexDirection: "row", alignItems: "center", gap: spacing.one + 2 },
  profileGlyph: { width: 44, height: 44, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: themes.primarySoft, borderWidth: 1, borderColor: themes.primaryBorder },
  profileGlyphText: { color: themes.primaryBttn, fontSize: 28, lineHeight: 29, fontFamily: "Body-Regular" },
  eyebrow: { color: themes.primaryBttn, fontSize: 8.5, letterSpacing: 1, fontFamily: "Body-Bold" },
  header: { color: themes.text, fontSize: 23, fontFamily: "Heading-Font", marginTop: 2 },
  subhead: { color: themes.textSecondary, fontSize: 10.5, lineHeight: 15, fontFamily: "Body-Regular", marginTop: 2 },
  requiredNotice: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 11, paddingVertical: 9, borderRadius: 14, backgroundColor: "rgba(52,209,127,0.07)", borderWidth: 1, borderColor: themes.primaryBorder },
  requiredNoticeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: themes.primaryBttn },
  requiredNoticeText: { flex: 1, color: themes.textSecondary, fontSize: 9.5, lineHeight: 14, fontFamily: "Body-Medium" },
  formScroll: { width: "100%", flexShrink: 1 },
  formContent: { gap: spacing.two, paddingBottom: spacing.one },
  fieldGroup: { gap: 7 },
  fieldHeaderRow: { flexDirection: "row", alignItems: "center", gap: spacing.one },
  fieldLabel: { color: themes.text, fontSize: 12.5, fontFamily: "Body-Bold" },
  fieldHint: { color: themes.textMuted, fontSize: 8.5, lineHeight: 12, marginTop: 1, fontFamily: "Body-Regular" },
  requirementPill: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999, backgroundColor: themes.primarySoft, borderWidth: 1, borderColor: themes.primaryBorder },
  requirementText: { color: themes.primaryBttn, fontSize: 6.8, letterSpacing: 0.5, fontFamily: "Body-Bold" },
  optionalPill: { backgroundColor: themes.surfaceSoft, borderColor: themes.divider },
  optionalText: { color: themes.textMuted },
  dateRow: { flexDirection: "row", gap: spacing.one },
  splitRow: { flexDirection: "row", gap: spacing.one },
  validationText: { color: themes.lightOrange, fontSize: 9, fontFamily: "Body-Medium" },
  input: { height: spacing.six, borderWidth: 1, paddingHorizontal: spacing.two, fontSize: fontsize.button, borderRadius: spacing.edge, color: themes.text, fontFamily: "Body-Medium", backgroundColor: themes.backgroundElement, borderColor: themes.secondaryBttn },
  dropdownSelected: { color: themes.text, fontFamily: "Body-Medium" },
  dropdownPlaceholder: { color: themes.textInputPlaceholder, fontFamily: "Body-Medium" },
  dropdownContainer: { backgroundColor: themes.backgroundElement, borderRadius: spacing.edge, borderWidth: 1, borderColor: themes.secondaryBttn, overflow: "hidden" },
  dropdownItemText: { color: themes.text, fontFamily: "Body-Medium" },
  dropdownItem: { borderBottomWidth: 1, borderColor: themes.secondaryBttn },
  actionRow: { flexDirection: "row", alignItems: "center", gap: spacing.half, width: "100%" },
});
