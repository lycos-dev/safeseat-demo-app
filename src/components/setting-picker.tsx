import ThemedHost from "@/components/themed-host";
import { Spacing as spacing, FontSize as fontsize } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { Host, Icon, Picker } from "@expo/ui";
// 1. Import the native scroll view wrapper designed specifically for Expo UI
// Static import instead of a runtime import() — Icon.select needs an actual
// value, not a Promise, or the Android icon silently breaks.
import unfoldMoreIcon from "@expo/material-symbols/unfold_more.xml";
import { useEffect, useState } from "react";
import {
    Platform,
    Pressable,
    StyleSheet,
    Text,
    useColorScheme,
    View,
} from "react-native";

type SettingPickerProps = {
  iconName?: Parameters<typeof Icon>[0]["name"];
  name: string;
  value?: string; // e.g. "a+", "b-", "none"
  enabled?: boolean;
  isLast?: boolean;
  showChevron?: boolean;
  isOpen?: boolean; // Unused on iOS (inline Picker doesn't need a modal state), but kept for prop-type parity with the Android variant
  onClose?: () => void; // Unused on iOS, same reason as above
  onPress?: () => void;
  onValueChange?: (newValue: string) => void; // Added value updater signature
};

const bloodTypes = [
  { label: "Not Set", value: "none" },
  { label: "A+", value: "a+" },
  { label: "A-", value: "a-" },
  { label: "B+", value: "b+" },
  { label: "B-", value: "b-" },
  { label: "AB+", value: "ab+" },
  { label: "AB-", value: "ab-" },
  { label: "O+", value: "o+" },
  { label: "O-", value: "o-" },
];

export default function SettingPicker({
  iconName,
  name,
  value = "none",
  isLast = false,
  enabled = true,
  onPress,
  onValueChange,
}: SettingPickerProps) {
  const themes = useTheme();
  const [selectedBloodType, setSelectedBloodType] = useState(value);
  const [bloodTypeIsPresented, setBloodTypeIsPresented] = useState(false);
  // 4. FIX: Holds a tapped value until the native sheet has fully finished
  // dismissing. We must NOT mutate list state (which changes every row's
  // isSelected) while Compose is mid-teardown of the BottomSheet/ScrollView,
  // or it crashes. So we stage the value here and only commit it once
  // onDismiss actually fires.
  const [pendingBloodType, setPendingBloodType] = useState<string | null>(null);

  // Keep internal selector state updated when parent SecureStore values resolve asynchronously
  useEffect(() => {
    if (value) {
      setSelectedBloodType(value);
    }
  }, [value]);

  // Format the display label text based on the mapped internal string token
  const currentLabel =
    bloodTypes.find((b) => b.value === selectedBloodType)?.label || "Not Set";

  // Handle updates for the iOS inline picker item selections
  const handleValueChangeIos = (newValue: string) => {
    setSelectedBloodType(newValue);
    if (onValueChange) {
      onValueChange(newValue);
    }
  };

  return (
    <>
      <Pressable
        onPress={
          enabled
            ? Platform.OS === "android"
              ? () => setBloodTypeIsPresented(true)
              : onPress
            : undefined
        }
        disabled={!enabled}
        style={[
          setitem.setItemBase,
          {
            backgroundColor: themes.backgroundElement,
            borderBottomWidth: isLast ? 0 : 1,
            borderBottomColor: themes.secondaryBttn,
          },
        ]}
      >
        {/* LEFT BLOCK */}
        {/* Added pointerEvents="none" to stop native icons from high-jacking gestures */}
        <View style={setitem.leftContainer} pointerEvents="none">
          {iconName && (
            <View
              style={[
                setitem.iconWrapper,
                {
                  backgroundColor: themes.primaryBttn,
                  padding: 6,
                  borderRadius: 8,
                },
              ]}
            >
              <ThemedHost style={{ width: 22, height: 22 }}>
                <Icon name={iconName} color={themes.primaryBttnText} />
              </ThemedHost>
            </View>
          )}
          <Text style={[setitem.settingName, { color: themes.text }]}>
            {name}
          </Text>
        </View>

        {/* RIGHT BLOCK */}
        <View style={setitem.rightContainer}>
          {Platform.OS == "ios" ? (
            <ThemedHost matchContents>
              <Picker
                selectedValue={selectedBloodType}
                onValueChange={handleValueChangeIos}
                appearance="menu"
              >
                {bloodTypes.map((b) => (
                  <Picker.Item key={b.value} label={b.label} value={b.value} />
                ))}
              </Picker>
            </ThemedHost>
          ) : (
            /* Added pointerEvents="none" to pass gestures directly up to the parent row wrapper on Android */
            <View
              style={{ flexDirection: "row", alignItems: "center" }}
              pointerEvents="none"
            >
              <Text
                style={[
                  setitem.settingValue,
                  { color: themes.primaryBttn },
                ]}
              >
                {currentLabel}
              </Text>
              <ThemedHost style={{ width: 20, height: 20 }}>
                <Icon
                  name={Icon.select({
                    ios: "chevron.up.chevron.down",
                    android: unfoldMoreIcon,
                  })}
                  color={themes.primaryBttn}
                />
              </ThemedHost>
            </View>
          )}
        </View>
      </Pressable>
    </>
  );
}

const setitem = StyleSheet.create({
  setItemBase: {
    width: "100%",
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
  },
  leftContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 12,
  },
  rightContainer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    flex: 1,
  },
  iconWrapper: {
    justifyContent: "center",
    alignItems: "center",
  },
  settingName: {
    fontSize: 18,
    fontFamily: "Body-Medium",
  },
  settingValue: {
    fontSize: 18,
    fontFamily: "Condensed-Bold",
  },
  drawerCont: {
    width: "100%",
    flexDirection: "column",
    padding: 24,
  },
  drawerTitle: {
    fontSize: 20,
    fontFamily: "Heading-Font",
    textAlign: "center",
    marginBottom: 16,
  },
  radioRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    padding: 14,
    borderRadius: 8,
    gap: 12,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  regularText: {
    fontSize: 16,
    fontFamily: "Body-Medium",
  },
});
