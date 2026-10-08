import AuthBackground from "@/components/auth-background";
import Button from "@/components/button";
import TextInput from "@/components/text-input";
import { Spacing as spacing } from "@/constants/theme";
import visibilityXml from "@expo/material-symbols/visibility.xml";
import visibilityOffXml from "@expo/material-symbols/visibility_off.xml";
import { Host, Icon } from "@expo/ui";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { createUserWithEmailAndPassword, updateProfile, type User } from "firebase/auth";
import { getLocalValue, setLocalValue, deleteLocalValue } from "@/services/local-storage";
import { useRef, useState } from "react";
import { saveUserProfile } from "@/services/user-profile";
import { accountErrorMessage } from "@/utils/account-errors";
import { normalizePhilippineMobileNumber, PH_MOBILE_VALIDATION_MESSAGE } from "@/utils/philippine-phone";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth } from "../../firebase";

export default function Signup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const createdUserRef = useRef<User | null>(null);
  const [setupPending, setSetupPending] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);
  const router = useRouter();
  const normalizedPhoneForForm = normalizePhilippineMobileNumber(phone);
  const phoneInputInvalid = phone.trim() !== "" && !normalizedPhoneForForm;
  const canSubmit =
    Boolean(name.trim() && email.trim() && normalizedPhoneForForm && password && confirmPassword) &&
    password === confirmPassword &&
    password.length >= 6;

  const handleSignUp = async () => {
    if (submittingRef.current) return;
    const cleanName = name.trim();
    const cleanEmail = email.toLowerCase().trim();
    const normalizedPhone = normalizePhilippineMobileNumber(phone);

    if (!cleanName || !cleanEmail || !phone.trim() || !password || !confirmPassword) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert("Missing fields", "Name, email, phone number, password, and confirm password are required.");
      return;
    }

    if (!normalizedPhone) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert("Check phone number", PH_MOBILE_VALIDATION_MESSAGE);
      return;
    }

    if (password !== confirmPassword) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert("Passwords don't match", "Please enter the same password in both fields.");
      return;
    }

    if (password.length < 6) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert("Password too short", "Password must be at least 6 characters.");
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      // A retry after a profile-write failure must not create the Auth account again.
      if (!createdUserRef.current || auth.currentUser?.uid !== createdUserRef.current.uid) {
        const credential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        createdUserRef.current = credential.user;
        setSetupPending(true);
      }
      const user = createdUserRef.current;
      await updateProfile(user, { displayName: cleanName });
      await saveUserProfile(user, {
        name: cleanName,
        phone: normalizedPhone,
      });
      await setLocalValue("is_logged_in", "true");
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)/home");
    } catch (error: any) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      const pending = createdUserRef.current !== null;
      const message = accountErrorMessage(error, "Please try again.");
      if (error.code === "auth/email-already-in-use") {
        Alert.alert("Account already exists", message, [
          { text: "Cancel", style: "cancel" },
          { text: "Log in", onPress: () => router.replace({ pathname: "/(auth)/login", params: { email: cleanEmail } }) },
        ]);
      } else {
        Alert.alert(pending ? "Account created — setup incomplete" : "Sign-up failed",
          pending ? `Your account exists. Tap Finish setup to retry, or log in later. ${message}` : message);
      }
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const PasswordEye = ({ visible, onPress, label }: { visible: boolean; onPress: () => void; label: string }) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.eyeButton, pressed && styles.pressed]}
    >
      <Host>
        <Icon
          name={Icon.select({
            ios: visible ? "eye.slash.fill" : "eye.fill",
            android: visible ? visibilityOffXml : visibilityXml,
          })}
        />
      </Host>
    </Pressable>
  );

  return (
    <AuthBackground>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.flex}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            bounces={false}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.content}>
              <View style={styles.brandBlock}>
                <Text style={styles.brand}>SafeSeat</Text>
                <Text style={styles.eyebrow}>DRIVER ACCOUNT</Text>
              </View>

              <View style={styles.card}>
                <Text style={styles.title}>Create your account</Text>
                <Text style={styles.subtitle}>Set up your profile for SafeSeat monitoring and vehicle access.</Text>

                <View style={styles.fields}>
                  <View>
                    <Text style={styles.fieldLabel}>Name</Text>
                    <TextInput
                      variant="regular"
                      placeholder="Full name"
                      type="text"
                      value={name}
                      enabled={!isSubmitting}
                      onChangeText={setName}
                    />
                  </View>

                  <View>
                    <Text style={styles.fieldLabel}>Email</Text>
                    <TextInput
                      variant="regular"
                      placeholder="name@example.com"
                      type="email"
                      value={email}
                      enabled={!isSubmitting && !setupPending}
                      onChangeText={setEmail}
                    />
                  </View>

                  <View>
                    <View style={styles.labelRow}>
                      <Text style={styles.fieldLabel}>Phone number</Text>
                      <Text style={styles.requiredLabel}>REQUIRED</Text>
                    </View>
                    <TextInput
                      variant="regular"
                      placeholder="e.g. +63 912 345 6789"
                      type="phone"
                      value={phone}
                      enabled={!isSubmitting}
                      onChangeText={setPhone}
                    />
                    <Text style={[styles.helper, phoneInputInvalid && styles.helperError]}>
                      {phoneInputInvalid ? PH_MOBILE_VALIDATION_MESSAGE : "Required. Philippine mobile number (09XXXXXXXXX or +639XXXXXXXXX)."}
                    </Text>
                  </View>

                  <View>
                    <Text style={styles.fieldLabel}>Password</Text>
                    <View style={styles.passwordRow}>
                      <View style={styles.passwordInput}>
                        <TextInput
                          variant="regular"
                          placeholder="At least 6 characters"
                          type={passwordVisible ? "text" : "password"}
                          value={password}
                          enabled={!isSubmitting && !setupPending}
                          onChangeText={setPassword}
                        />
                      </View>
                      <PasswordEye
                        visible={passwordVisible}
                        onPress={() => setPasswordVisible((value) => !value)}
                        label={passwordVisible ? "Hide password" : "Show password"}
                      />
                    </View>
                  </View>

                  <View>
                    <Text style={styles.fieldLabel}>Confirm password</Text>
                    <View style={styles.passwordRow}>
                      <View style={styles.passwordInput}>
                        <TextInput
                          variant="regular"
                          placeholder="Re-enter your password"
                          type={confirmPasswordVisible ? "text" : "password"}
                          value={confirmPassword}
                          enabled={!isSubmitting && !setupPending}
                          onChangeText={setConfirmPassword}
                        />
                      </View>
                      <PasswordEye
                        visible={confirmPasswordVisible}
                        onPress={() => setConfirmPasswordVisible((value) => !value)}
                        label={confirmPasswordVisible ? "Hide confirm password" : "Show confirm password"}
                      />
                    </View>
                  </View>
                </View>

                <Button
                  label={setupPending ? "Finish setup" : "Create account"}
                  onPress={() => {
                    if (!isSubmitting) void handleSignUp();
                  }}
                  enabled={!isSubmitting && canSubmit}
                  fullWidth
                  loading={isSubmitting}
                />
              </View>

              <View style={styles.switchRow}>
                <Text style={styles.switchText}>Already have an account?</Text>
                <Pressable
                  accessibilityRole="button"
                  disabled={isSubmitting}
                  onPress={() => router.replace("/(auth)/login")}
                  style={({ pressed }) => pressed && styles.pressed}
                >
                  <Text style={styles.switchLink}>Log in</Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </AuthBackground>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingVertical: spacing.four,
  },
  content: {
    width: "100%",
    maxWidth: 540,
    alignSelf: "center",
    paddingHorizontal: spacing.three,
  },
  brandBlock: { marginBottom: spacing.three },
  brand: {
    color: "#F8FAFC",
    fontFamily: "Logo-Font",
    fontSize: 38,
    lineHeight: 44,
  },
  eyebrow: {
    color: "#66E3A0",
    fontFamily: "Body-Bold",
    fontSize: 11,
    letterSpacing: 1.4,
    marginTop: 2,
  },
  card: {
    borderRadius: 24,
    padding: spacing.three,
    backgroundColor: "rgba(8,18,30,0.90)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    shadowColor: "#000000",
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  title: { color: "#F8FAFC", fontFamily: "Body-Bold", fontSize: 25 },
  subtitle: {
    color: "#A9B7C8",
    fontFamily: "Body-Medium",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 6,
    marginBottom: spacing.three,
  },
  fields: { gap: spacing.two, marginBottom: spacing.three },
  labelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  fieldLabel: {
    color: "#D7E0EA",
    fontFamily: "Body-Bold",
    fontSize: 13,
    marginBottom: 7,
  },
  requiredLabel: {
    color: "#7D8EA3",
    fontFamily: "Body-Bold",
    fontSize: 10,
    letterSpacing: 1,
    marginBottom: 7,
  },
  helper: {
    color: "#7D8EA3",
    fontFamily: "Body-Medium",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 6,
  },
  helperError: { color: "#FF8A8F" },
  passwordRow: { flexDirection: "row", gap: spacing.one, alignItems: "stretch" },
  passwordInput: { flex: 1 },
  eyeButton: {
    width: 54,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#26364C",
    backgroundColor: "#172437",
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 7,
    marginTop: spacing.three,
    flexWrap: "wrap",
  },
  switchText: { color: "#A9B7C8", fontFamily: "Body-Medium", fontSize: 14 },
  switchLink: { color: "#66E3A0", fontFamily: "Body-Bold", fontSize: 14 },
  pressed: { opacity: 0.72 },
});
