import { type ThemePalette } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import type { ComponentProps } from "react";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";

type IconName = ComponentProps<typeof Ionicons>["name"];

type Props = {
  iconName?: IconName;
  name: string;
  value?: boolean;
  enabled?: boolean;
  isLast?: boolean;
  onValueChange?: (v: boolean) => void;
};

export default function SettingSwitch({
  iconName,
  name,
  isLast = false,
  enabled = true,
  value = false,
  onValueChange,
}: Props) {
  const themes = useTheme();
  const styles = createStyles(themes);
  const [selected, setSelected] = useState(value);

  useEffect(() => setSelected(value), [value]);

  const toggle = () => {
    if (!enabled) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const next = !selected;
    setSelected(next);
    onValueChange?.(next);
  };

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={name}
      accessibilityState={{ checked: selected, disabled: !enabled }}
      onPress={toggle}
      disabled={!enabled}
      style={({ pressed }) => [
        styles.row,
        { borderBottomWidth: isLast ? 0 : 1, opacity: enabled ? (pressed ? 0.76 : 1) : 0.45 },
      ]}
    >
      <View style={styles.left} pointerEvents="none">
        {iconName ? (
          <View style={styles.iconWrap}>
            <Ionicons name={iconName} size={20} color={themes.primaryBttn} />
          </View>
        ) : null}
        <Text style={styles.name}>{name}</Text>
      </View>
      <View pointerEvents="none">
        <Switch
          value={selected}
          disabled={!enabled}
          trackColor={{ false: themes.secondaryBttn, true: themes.primaryBttn }}
          thumbColor={themes.mode === "light" ? "#FFFFFF" : undefined}
        />
      </View>
    </Pressable>
  );
}

const createStyles = (themes: ThemePalette) => StyleSheet.create({
  row: {
    width: "100%",
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: themes.backgroundElement,
    borderBottomColor: themes.divider,
  },
  left: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingRight: 10,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: themes.primaryBorder,
    backgroundColor: themes.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  name: {
    fontSize: 15.5,
    lineHeight: 21,
    fontFamily: "Body-Medium",
    color: themes.text,
    flex: 1,
  },
});
