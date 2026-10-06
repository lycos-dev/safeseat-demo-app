import ThemedHost from "@/components/themed-host";
import { Icon } from "@/components/ui-bridge";
import { useTheme } from "@/hooks/use-theme";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

type Props = {
  iconName?: any;
  name: string;
  value?: string;
  enabled?: boolean;
  isLast?: boolean;
  onPress?: () => void;
  onValueChange?: (isoDateString: string) => void;
};

export default function SettingDatePickerItem({ iconName, name, value, enabled = true, isLast = false, onValueChange }: Props) {
  const themes = useTheme();
  const safeValue = /^\d{4}-\d{2}-\d{2}$/.test(value ?? "") ? value! : new Date().toISOString().slice(0, 10);
  return (
    <View style={[styles.row, { backgroundColor: themes.backgroundElement, borderBottomWidth: isLast ? 0 : 1, borderBottomColor: themes.divider }]}>
      <View style={styles.left}>
        {iconName ? (
          <View style={[styles.iconWrap, { backgroundColor: themes.primaryBttn }]}>
            <ThemedHost style={{ width: 22, height: 22 }}><Icon name={iconName} color={themes.primaryBttnText} /></ThemedHost>
          </View>
        ) : null}
        <Text style={[styles.name, { color: themes.text }]}>{name}</Text>
      </View>
      {React.createElement("input", {
        type: "date",
        value: safeValue,
        disabled: !enabled,
        onChange: (event: any) => onValueChange?.(event.target.value),
        style: {
          maxWidth: 150,
          border: 0,
          outline: "none",
          background: "transparent",
          color: themes.primaryBttn,
          fontFamily: "Body-Medium",
          fontSize: 16,
          textAlign: "right",
        },
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { width: "100%", minHeight: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 12 },
  left: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconWrap: { padding: 6, borderRadius: 8, justifyContent: "center", alignItems: "center" },
  name: { fontSize: 18, fontFamily: "Body-Medium" },
});
