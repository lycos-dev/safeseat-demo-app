import { FontSize as fontsize, Spacing as spacing, type ThemePalette } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import * as Haptics from "expo-haptics";
import { ActivityIndicator, Pressable, StyleProp, StyleSheet, Text, ViewStyle } from "react-native";
import type { ReactNode } from "react";

type ButtonProps = {
  variant?: "primary" | "secondary" | "warn" | "tertiary";
  label?: string;
  enabled?: boolean;
  fullWidth?: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  loading?: boolean;
};

export default function Button({ variant = "primary", label, enabled = true, fullWidth = false, onPress, style, children, loading = false }: ButtonProps) {
  const themes = useTheme();
  const styles = createStyles(themes);
  const handlePress = () => {
    if (!enabled || loading) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };
  const spinnerColor = variant === "primary" ? themes.primaryBttnText : variant === "warn" ? themes.warnBttnText : themes.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !enabled || loading }}
      disabled={!enabled || loading}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.baseButton,
        variant === "primary" && styles.primaryButton,
        variant === "secondary" && styles.secondaryButton,
        variant === "warn" && styles.warnButton,
        variant === "tertiary" && styles.tertiaryButton,
        fullWidth && styles.fullWidth,
        (!enabled || loading) && styles.disabledButton,
        pressed && enabled && !loading && styles.pressedButton,
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={spinnerColor} /> : children ?? (
        <Text style={[
          styles.baseText,
          variant === "primary" && styles.primaryText,
          variant === "secondary" && styles.secondaryText,
          variant === "warn" && styles.warnText,
          variant === "tertiary" && styles.tertiaryText,
        ]}>{label}</Text>
      )}
    </Pressable>
  );
}

const createStyles = (themes: ThemePalette) => StyleSheet.create({
  baseButton: { minHeight: 52, paddingVertical: spacing.one + 2, paddingHorizontal: spacing.two, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  primaryButton: { backgroundColor: themes.primaryBttn },
  secondaryButton: { backgroundColor: themes.secondaryBttn, borderWidth: 1, borderColor: themes.divider },
  warnButton: { backgroundColor: themes.warnBttn },
  tertiaryButton: { backgroundColor: "transparent" },
  fullWidth: { width: "100%" },
  disabledButton: { opacity: 0.42 },
  pressedButton: { opacity: 0.82, transform: [{ scale: 0.99 }] },
  baseText: { fontSize: fontsize.button, fontFamily: "Body-Bold", textAlign: "center" },
  primaryText: { color: themes.primaryBttnText },
  secondaryText: { color: themes.secondaryBttnText },
  tertiaryText: { color: themes.primaryBttn },
  warnText: { color: themes.warnBttnText },
});
