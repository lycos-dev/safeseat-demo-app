import { FontSize as fontsize, Spacing as spacing, type ThemePalette } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import * as Haptics from "expo-haptics";
import { addDoc, collection } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { Dropdown } from "react-native-element-dropdown";

import { auth, db } from "../firebase";
import Button from "./button";
import TextInput from "./text-input";

const CONTACT_ORDER = [
  { label: "1st contact", value: 1 },
  { label: "2nd contact", value: 2 },
  { label: "3rd contact", value: 3 },
  { label: "4th contact", value: 4 },
  { label: "5th contact", value: 5 },
];

type Props = {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
};

export default function AddContactModal({ visible, onClose, onSuccess }: Props) {

  const themes = useTheme();
  const styles = createStyles(themes);  const [isLoading, setIsLoading] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [priority, setPriority] = useState(0);

  useEffect(() => {
    if (visible) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [visible]);

  const hasUnsavedChanges = name.trim() !== "" || phone.trim() !== "" || priority !== 0;
  const isFormInvalid = name.trim() === "" || phone.trim() === "";

  const handleResetAndClose = () => {
    setName("");
    setPhone("");
    setPriority(0);
    onClose();
  };

  const requestClose = () => {
    if (!hasUnsavedChanges) {
      handleResetAndClose();
      return;
    }
    Alert.alert("Discard this contact?", "Your entered information has not been saved yet.", [
      { text: "Keep Editing", style: "cancel" },
      { text: "Discard", style: "destructive", onPress: handleResetAndClose },
    ]);
  };

  const handleSave = async () => {
    if (isFormInvalid || isLoading) return;
    const currentUser = auth.currentUser;
    if (!currentUser) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Authentication Error", "You must be signed in to add emergency contacts.");
      return;
    }

    setIsLoading(true);
    try {
      await addDoc(collection(db, "users", currentUser.uid, "emergencyContacts"), {
        name: name.trim(),
        phone: phone.trim(),
        hierarchy: Number(priority),
        createdAt: new Date().toISOString(),
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      handleResetAndClose();
      onSuccess?.();
    } catch (error) {
      console.error("Error saving emergency contact to Firestore:", error);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Save Error", "Failed to create this contact. Please try again.");
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
              <View style={styles.headerRow}>
                <View style={styles.contactGlyph}>
                  <Text style={styles.contactGlyphText}>SOS</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.eyebrow}>EMERGENCY CONTACT</Text>
                  <Text style={styles.header}>Add a contact</Text>
                </View>
              </View>


              <View style={styles.fieldGroup}>
                <View style={styles.fieldLabelRow}>
                  <Text style={styles.fieldLabel}>Name</Text>
                  <Text style={styles.requiredTag}>REQUIRED</Text>
                </View>
                <TextInput type="text" variant="regular" placeholder="Contact name" enabled={!isLoading} value={name} onChangeText={setName} />
              </View>

              <View style={styles.fieldGroup}>
                <View style={styles.fieldLabelRow}>
                  <Text style={styles.fieldLabel}>Phone number</Text>
                  <Text style={styles.requiredTag}>REQUIRED</Text>
                </View>
                <TextInput type="phone" variant="regular" placeholder="Phone number" enabled={!isLoading} value={phone} onChangeText={setPhone} />
              </View>

              <View style={styles.fieldGroup}>
                <View style={styles.fieldLabelRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>Contact order</Text>
                  </View>
                  <Text style={styles.optionalTag}>OPTIONAL</Text>
                </View>
                <Dropdown
                  mode="default"
                  data={CONTACT_ORDER}
                  labelField="label"
                  valueField="value"
                  selectedTextStyle={styles.dropdownSelected}
                  placeholder="No order selected"
                  placeholderStyle={styles.dropdownPlaceholder}
                  value={priority || null}
                  disable={isLoading}
                  style={styles.input}
                  containerStyle={styles.dropdownContainer}
                  itemTextStyle={styles.dropdownItemText}
                  itemContainerStyle={styles.dropdownItem}
                  activeColor={themes.primaryBttn}
                  maxHeight={spacing.ten * 3}
                  onChange={(item) => setPriority(item.value)}
                  autoScroll={false}
                />
              </View>

              <View style={styles.actionRow}>
                <Button variant={hasUnsavedChanges ? "warn" : "secondary"} label={hasUnsavedChanges ? "Discard" : "Cancel"} enabled={!isLoading} onPress={requestClose} />
                <View style={{ flex: 1 }}>
                  <Button variant="primary" label="Add Contact" onPress={() => void handleSave()} enabled={!isFormInvalid && !isLoading} loading={isLoading} fullWidth />
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
  keyboardWrap: { width: "100%", maxWidth: 420 },
  container: { width: "100%", backgroundColor: themes.backgroundElevated, borderWidth: 1, borderColor: themes.divider, padding: spacing.two, borderRadius: 26, gap: spacing.two, shadowColor: "#000", shadowOpacity: 0.32, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 8 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: spacing.one + 2 },
  contactGlyph: { width: 46, height: 46, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,103,111,0.09)", borderWidth: 1, borderColor: "rgba(255,103,111,0.24)" },
  contactGlyphText: { color: themes.warnBttn, fontSize: 10, letterSpacing: 0.8, fontFamily: "Body-Bold" },
  eyebrow: { color: themes.warnBttn, fontSize: 8.5, letterSpacing: 1, fontFamily: "Body-Bold" },
  header: { color: themes.text, fontSize: 23, fontFamily: "Heading-Font", marginTop: 2 },
  subhead: { color: themes.textSecondary, fontSize: 10.5, lineHeight: 15, fontFamily: "Body-Regular", marginTop: 2 },
  helpCard: { padding: spacing.one + 2, borderRadius: 15, backgroundColor: themes.surfaceSoft, borderWidth: 1, borderColor: themes.divider },
  helpTitle: { color: themes.text, fontSize: 10.5, fontFamily: "Body-Bold" },
  helpText: { color: themes.textMuted, fontSize: 9, lineHeight: 13, marginTop: 2, fontFamily: "Body-Regular" },
  fieldGroup: { gap: 7 },
  fieldLabelRow: { flexDirection: "row", alignItems: "center", gap: spacing.one },
  fieldLabel: { color: themes.text, fontSize: 12.5, fontFamily: "Body-Bold" },
  fieldHint: { color: themes.textMuted, fontSize: 8.5, lineHeight: 12, marginTop: 1, fontFamily: "Body-Regular" },
  requiredTag: { color: themes.primaryBttn, fontSize: 6.8, letterSpacing: 0.5, fontFamily: "Body-Bold", paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999, overflow: "hidden", backgroundColor: themes.primarySoft },
  optionalTag: { color: themes.textMuted, fontSize: 6.8, letterSpacing: 0.5, fontFamily: "Body-Bold", paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999, overflow: "hidden", backgroundColor: themes.surfaceSoft },
  input: { height: spacing.six, borderWidth: 1, paddingHorizontal: spacing.two, fontSize: fontsize.button, borderRadius: spacing.edge, color: themes.text, fontFamily: "Body-Medium", backgroundColor: themes.backgroundElement, borderColor: themes.secondaryBttn },
  dropdownSelected: { color: themes.text, fontFamily: "Body-Medium" },
  dropdownPlaceholder: { color: themes.textInputPlaceholder, fontFamily: "Body-Medium" },
  dropdownContainer: { backgroundColor: themes.backgroundElement, borderRadius: spacing.edge, borderWidth: 1, borderColor: themes.secondaryBttn, overflow: "hidden" },
  dropdownItemText: { color: themes.text, fontFamily: "Body-Medium" },
  dropdownItem: { borderBottomWidth: 1, borderColor: themes.secondaryBttn },
  actionRow: { flexDirection: "row", gap: spacing.half, width: "100%", alignItems: "center" },
});
