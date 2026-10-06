import AuthBackground from "@/components/auth-background";
import Button from "@/components/button";
import { FontSize as fontsize, Spacing as spacing } from "@/constants/theme";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function SplashScreen() {
  const router = useRouter();

  return (
    <AuthBackground>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <View style={styles.hero}>
            <View style={styles.brandPill}>
              <View style={styles.brandDot} />
              <Text style={styles.brandPillText}>IN-CABIN SAFETY</Text>
            </View>

            <Text style={styles.logo}>SafeSeat</Text>
            <Text style={styles.tagline}>
              Intelligent seat monitoring built for a safer ride.
            </Text>
          </View>

          <View style={styles.actionCard}>
            <Text style={styles.actionTitle}>Ready when you are</Text>
            <Text style={styles.actionCopy}>
              Sign in to continue monitoring, or create an account to get started.
            </Text>

            <View style={styles.actions}>
              <Button
                label="Create account"
                onPress={() => router.push("/(auth)/signup")}
                variant="secondary"
                style={styles.actionButton}
              />
              <Button
                label="Log in"
                onPress={() => router.push("/(auth)/login")}
                style={styles.actionButton}
              />
            </View>
          </View>
        </View>
      </SafeAreaView>
    </AuthBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: {
    flex: 1,
    width: "100%",
    maxWidth: 620,
    alignSelf: "center",
    paddingHorizontal: spacing.three,
    paddingVertical: spacing.two,
    justifyContent: "space-between",
  },
  hero: {
    flex: 1,
    justifyContent: "center",
    alignItems: "flex-start",
    paddingTop: spacing.four,
  },
  brandPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(102,227,160,0.28)",
    backgroundColor: "rgba(18,56,39,0.42)",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    marginBottom: spacing.two,
  },
  brandDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: "#66E3A0",
  },
  brandPillText: {
    color: "#9EF0C1",
    fontSize: 11,
    letterSpacing: 1.3,
    fontFamily: "Body-Bold",
  },
  logo: {
    fontSize: fontsize.giant + 8,
    lineHeight: fontsize.giant + 14,
    fontFamily: "Logo-Font",
    color: "#F8FAFC",
  },
  tagline: {
    marginTop: spacing.one,
    maxWidth: 360,
    color: "#A9B7C8",
    fontSize: 17,
    lineHeight: 25,
    fontFamily: "Body-Medium",
  },
  actionCard: {
    borderRadius: 24,
    padding: spacing.three,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    backgroundColor: "rgba(8,18,30,0.84)",
    shadowColor: "#000000",
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  actionTitle: {
    color: "#F8FAFC",
    fontSize: 20,
    fontFamily: "Body-Bold",
  },
  actionCopy: {
    color: "#A9B7C8",
    fontSize: 14,
    lineHeight: 21,
    fontFamily: "Body-Medium",
    marginTop: 6,
    marginBottom: spacing.two,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.one,
  },
  actionButton: { flex: 1 },
});
