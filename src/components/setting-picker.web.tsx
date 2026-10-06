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
  onValueChange?: (newValue: string) => void;
};

const bloodTypes = [
  ["Not Set", "none"], ["A+", "a+"], ["A-", "a-"], ["B+", "b+"], ["B-", "b-"],
  ["AB+", "ab+"], ["AB-", "ab-"], ["O+", "o+"], ["O-", "o-"],
];

export default function SettingPicker({ iconName, name, value = "none", enabled = true, isLast = false, onValueChange }: Props) {
  const themes = useTheme();
  return (
    <View style={[styles.row, { backgroundColor: themes.backgroundElement, borderBottomWidth: isLast ? 0 : 1, borderBottomColor: themes.secondaryBttn }]}>
      <View style={styles.left}>
        {iconName ? (
          <View style={[styles.iconWrap, { backgroundColor: themes.primaryBttn }]}>
            <ThemedHost style={{ width: 22, height: 22 }}><Icon name={iconName} color={themes.primaryBttnText} /></ThemedHost>
          </View>
        ) : null}
        <Text style={[styles.name, { color: themes.text }]}>{name}</Text>
      </View>
      {React.createElement("select", {
        value,
        disabled: !enabled,
        onChange: (event: any) => onValueChange?.(event.target.value),
        style: {
          border: 0,
          outline: "none",
          background: "transparent",
          color: themes.primaryBttn,
          fontFamily: "Body-Medium",
          fontSize: 18,
          textAlign: "right",
        },
      }, bloodTypes.map(([label, optionValue]) => React.createElement("option", { key: optionValue, value: optionValue }, label)))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { width: "100%", height: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 12 },
  left: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconWrap: { padding: 6, borderRadius: 8, justifyContent: "center", alignItems: "center" },
  name: { fontSize: 18, fontFamily: "Body-Medium" },
});
