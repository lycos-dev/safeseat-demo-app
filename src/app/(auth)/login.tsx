import AuthBackground from "@/components/auth-background";
import Button from "@/components/button";
import TextInput from "@/components/text-input";
import { Spacing as spacing } from "@/constants/theme";
import visibilityXml from "@expo/material-symbols/visibility.xml";
import visibilityOffXml from "@expo/material-symbols/visibility_off.xml";
import { Host, Icon } from "@expo/ui";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { getLocalValue, setLocalValue, deleteLocalValue } from "@/services/local-storage";
import { StatusBar } from "expo-status-bar";
import { sendPasswordResetEmail, signInWithEmailAndPassword } from "firebase/auth";
import { useRef, useState } from "react";
import { saveUserProfile } from "@/services/user-profile";
import { accountErrorMessage } from "@/utils/account-errors";
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

export default function Login() {
  const router = useRouter();
  const { email: initialEmail } = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(initialEmail ?? "");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const submittingRef = useRef(false);

  const handleLogin = async () => {
    if (submittingRef.current) return;
    if (!email.trim() || !password) {
      Alert.alert("Missing fields", "Please enter your email and password.");
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    let authenticated = false;
    try {
      const cleanEmail = email.toLowerCase().trim();
      const credential = await signInWithEmailAndPassword(auth, cleanEmail, password);
      authenticated = true;
      await saveUserProfile(credential.user);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await setLocalValue("is_logged_in", "true");
      router.replace("/(tabs)/home");
    } catch (error: any) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert(authenticated ? "Profile setup incomplete" : "Log-in failed",
        accountErrorMessage(error, authenticated
          ? "You are authenticated, but your profile could not be prepared. Please try logging in again."
          : "We couldn't log you in. Please try again."));
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    const cleanEmail = email.toLowerCase().trim();
    if (!cleanEmail) {
      Alert.alert("Enter your email", "Type your account email first, then tap Forgot password.");
      return;
    }

    try {
      await sendPasswordResetEmail(auth, cleanEmail);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Reset email sent", "Check your inbox and follow the password reset link.");
    } catch (error: any) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      let message = "We couldn't send a password reset email. Please try again.";
      if (error?.code === "auth/invalid-email") message = "Please enter a valid email address.";
      if (error?.code === "auth/too-many-requests") message = "Too many requests. Please try again later.";
      Alert.alert("Password reset unavailable", message);
    }
  };

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
                <Text style={styles.eyebrow}>SECURE DRIVER ACCESS</Text>
              </View>

              <View style={styles.card}>
                <Text style={styles.title}>Welcome back</Text>
                <Text style={styles.subtitle}>Log in to continue to your SafeSeat cabin monitor.</Text>

                <View style={styles.fields}>
                  <View>
                    <Text style={styles.fieldLabel}>Email</Text>
                    <TextInput
                      variant="regular"
                      placeholder="name@example.com"
                      type="email"
                      value={email}
                      enabled={!isSubmitting}
                      onChangeText={setEmail}
                    />
                  </View>

                  <View>
                    <Text style={styles.fieldLabel}>Password</Text>
                    <View style={styles.passwordRow}>
                      <View style={styles.passwordInput}>
                        <TextInput
                          variant="regular"
                          placeholder="Enter your password"
                          type={passwordVisible ? "text" : "password"}
                          value={password}
                          enabled={!isSubmitting}
                          onChangeText={setPassword}
                        />
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={passwordVisible ? "Hide password" : "Show password"}
                        onPress={() => setPasswordVisible((value) => !value)}
                        style={({ pressed }) => [styles.eyeButton, pressed && styles.pressed]}
                      >
                        <Host>
                          <Icon
                            name={Icon.select({
                              ios: passwordVisible ? "eye.slash.fill" : "eye.fill",
                              android: passwordVisible ? visibilityOffXml : visibilityXml,
                            })}
                          />
                        </Host>
                      </Pressable>
                    </View>
                  </View>
                </View>

                <Button
                  variant="primary"
                  enabled={!isSubmitting}
                  label="Log in"
                  onPress={() => {
                    if (!isSubmitting) void handleLogin();
                  }}
                  fullWidth
                  loading={isSubmitting}
                />

                <Pressable
                  accessibilityRole="button"
                  onPress={() => void handleForgotPassword()}
                  disabled={isSubmitting}
                  style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}
                >
                  <Text style={styles.textButtonLabel}>Forgot password?</Text>
                </Pressable>
              </View>

              <View style={styles.switchRow}>
                <Text style={styles.switchText}>Don't have an account?</Text>
                <Pressable
                  accessibilityRole="button"
                  disabled={isSubmitting}
                  onPress={() => router.replace("/(auth)/signup")}
                  style={({ pressed }) => pressed && styles.pressed}
                >
                  <Text style={styles.switchLink}>Create account</Text>
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
    maxWidth: 520,
    alignSelf: "center",
    paddingHorizontal: spacing.three,
  },
  brandBlock: { marginBottom: spacing.three },
  brand: {
    color: "#F8FAFC",
    fontFamily: "Logo-Font",
    fontSize: 40,
    lineHeight: 46,
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
    backgroundColor: "rgba(8,18,30,0.88)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    shadowColor: "#000000",
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  title: {
    color: "#F8FAFC",
    fontFamily: "Body-Bold",
    fontSize: 26,
  },
  subtitle: {
    color: "#A9B7C8",
    fontFamily: "Body-Medium",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 6,
    marginBottom: spacing.three,
  },
  fields: { gap: spacing.two, marginBottom: spacing.three },
  fieldLabel: {
    color: "#D7E0EA",
    fontFamily: "Body-Bold",
    fontSize: 13,
    marginBottom: 7,
  },
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
  textButton: { alignSelf: "center", padding: 10, marginTop: 4 },
  textButtonLabel: { color: "#66E3A0", fontFamily: "Body-Bold", fontSize: 14 },
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
