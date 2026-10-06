import ThemedHost from "@/components/themed-host";
import callXml from "@expo/material-symbols/call.xml";
import { FontSize as fontsize, Spacing as spacing, type ThemePalette } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { Host, Icon } from "@expo/ui";
import * as Haptics from "expo-haptics";
import { Alert, Linking, Pressable, StyleSheet, Text, View } from "react-native";

type ContactCardProps = {
  name: string;
  phone: string;
  order: "primary" | "secondary" | "tertiary" | "quaternary" | "quinary" | "none";
  onPress?: () => void;
};

export default function ContactCard({ name, phone, order, onPress }: ContactCardProps) {

  const themes = useTheme();
  const styles = createStyles(themes);
  const ORDER_META = {
    primary: { label: "1ST CONTACT", number: "1", color: themes.primaryBttn },
    secondary: { label: "2ND CONTACT", number: "2", color: themes.info },
    tertiary: { label: "3RD CONTACT", number: "3", color: themes.info },
    quaternary: { label: "4TH CONTACT", number: "4", color: themes.textSecondary },
    quinary: { label: "5TH CONTACT", number: "5", color: themes.textSecondary },
    none: { label: "NO ORDER", number: "—", color: themes.textMuted },
  } as const;
  const meta = ORDER_META[order];

  const handleMakeCall = async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const url = `tel:${phone}`;
    try {
      if (await Linking.canOpenURL(url)) await Linking.openURL(url);
      else Alert.alert("Calling unavailable", "Phone calls are not supported on this device.");
    } catch (error) {
      console.error("Could not open dialer:", error);
      Alert.alert("Calling unavailable", "SafeSeat could not open the phone dialer.");
    }
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${meta.label}, ${phone}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={[styles.orderBadge, { borderColor: `${meta.color}66`, backgroundColor: `${meta.color}12` }]}> 
        <Text style={[styles.orderNumber, { color: meta.color }]}>{meta.number}</Text>
      </View>

      <View style={styles.copy}>
        <Text style={[styles.orderLabel, { color: meta.color }]}>{meta.label}</Text>
        <Text style={styles.name} numberOfLines={1}>{name}</Text>
        <Text style={styles.phone} numberOfLines={1}>{phone}</Text>
        <Text style={styles.hint}>Tap to view or edit</Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Call ${name}`}
        onPress={(event) => {
          event.stopPropagation();
          void handleMakeCall();
        }}
        style={({ pressed }) => [styles.callButton, pressed && styles.callPressed]}
      >
        <ThemedHost matchContents>
          <Icon name={Icon.select({ ios: "phone.fill", android: callXml })} color={themes.primaryBttnText} size={22} />
        </ThemedHost>
        <Text style={styles.callText}>CALL</Text>
      </Pressable>
    </Pressable>
  );
}

const createStyles = (themes: ThemePalette) => StyleSheet.create({
  card: {
    width: "100%",
    minHeight: 88,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.one,
    paddingHorizontal: spacing.one + 4,
    paddingVertical: spacing.one,
    borderRadius: 20,
    backgroundColor: themes.backgroundElement,
    borderWidth: 1,
    borderColor: themes.divider,
    overflow: "hidden",
  },
  cardPressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
  orderBadge: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  orderNumber: { fontSize: 17, fontFamily: "Body-Bold" },
  copy: { flex: 1, minWidth: 0 },
  orderLabel: { fontSize: 8, letterSpacing: 0.75, fontFamily: "Body-Bold" },
  name: { color: themes.text, fontSize: fontsize.body, fontFamily: "Body-Bold", marginTop: 2 },
  phone: { color: themes.textSecondary, fontSize: 10.5, fontFamily: "Body-Medium", marginTop: 2 },
  hint: { color: themes.textMuted, fontSize: 8.5, fontFamily: "Body-Regular", marginTop: 2 },
  callButton: { width: 56, minHeight: 58, borderRadius: 16, alignItems: "center", justifyContent: "center", gap: 2, backgroundColor: themes.primaryBttn },
  callPressed: { opacity: 0.75, transform: [{ scale: 0.96 }] },
  callText: { color: themes.primaryBttnText, fontSize: 7.5, letterSpacing: 0.55, fontFamily: "Body-Bold" },
});
