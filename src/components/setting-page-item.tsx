import { type ThemePalette } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type IconName = ComponentProps<typeof Ionicons>["name"];

type Props = {
  iconName?: IconName;
  name: string;
  value?: string;
  enabled?: boolean;
  isLast?: boolean;
  destructive?: boolean;
  showChevron?: boolean;
  onPress?: () => void;
};

export default function SettingPageItem({
  iconName,
  name,
  value,
  showChevron = false,
  isLast = false,
  destructive = false,
  enabled = true,
  onPress,
}: Props) {
  const themes = useTheme();
  const styles = createStyles(themes);
  const iconColor = destructive ? themes.warnBttn : themes.primaryBttn;

  return (
    <Pressable
      onPress={enabled ? onPress : undefined}
      disabled={!enabled}
      style={({ pressed }) => [
        styles.row,
        { borderBottomWidth: isLast ? 0 : 1, opacity: enabled ? (pressed ? 0.72 : 1) : 0.45 },
      ]}
    >
      <View style={styles.left}>
        {iconName ? (
          <View
            style={[
              styles.iconWrap,
              {
                backgroundColor: destructive ? (themes.mode === "dark" ? "rgba(255,103,111,0.10)" : "rgba(217,75,85,0.08)") : themes.primarySoft,
                borderColor: destructive ? `${themes.warnBttn}66` : themes.primaryBorder,
              },
            ]}
          >
            <Ionicons name={iconName} size={20} color={iconColor} />
          </View>
        ) : null}
        <Text style={[styles.name, { color: destructive ? themes.warnBttn : themes.text }]}>{name}</Text>
      </View>

      <View style={styles.right}>
        {value ? <Text style={styles.value} numberOfLines={1}>{value}</Text> : null}
        {showChevron ? <Ionicons name="chevron-forward" size={19} color={themes.textSecondary} /> : null}
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
  },
  right: {
    maxWidth: "45%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 7,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  name: {
    fontSize: 15.5,
    lineHeight: 21,
    fontFamily: "Body-Medium",
    flexShrink: 1,
  },
  value: {
    fontSize: 13.5,
    lineHeight: 19,
    fontFamily: "Body-Medium",
    color: themes.textSecondary,
    textAlign: "right",
    flexShrink: 1,
  },
});
