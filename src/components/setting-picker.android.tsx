// @/components/setting-picker.android.tsx
import { useTheme } from "@/hooks/use-theme";
import { useState, useEffect } from "react";
import {
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

type SettingPickerProps = {
    iconName?: any;
    name: string;
    value?: string;
    isLast?: boolean;
    enabled?: boolean;
    isOpen: boolean;
    onClose: () => void;
    onValueChange?: (newValue: string) => void;
    onPress?: () => void;
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
    isOpen,
    onClose,
    onValueChange,
    onPress,
}: SettingPickerProps) {
    const currentTheme = useTheme();

    const [selectedBloodType, setSelectedBloodType] = useState(value);

    useEffect(() => {
        if (value) {
            setSelectedBloodType(value);
        }
    }, [value]);

    const currentLabel = bloodTypes.find(b => b.value === selectedBloodType)?.label || "Not Set";

    const handleSelectValue = (newValue: string) => {
        setSelectedBloodType(newValue);
        if (onValueChange) {
            onValueChange(newValue);
        }
        onClose();
    };

    return (
        <>
            <Pressable
                onPress={enabled ? onPress : undefined}
                disabled={!enabled}
                style={({ pressed }) => [
                    setitem.setItemBase,
                    {
                        backgroundColor: currentTheme.backgroundElement,
                        borderBottomWidth: isLast ? 0 : 1,
                        borderBottomColor: currentTheme.divider,
                        opacity: pressed ? 0.8 : 1
                    }
                ]}
            >
                <View style={setitem.leftContainer}>
                    {iconName && (
                        <View style={[setitem.iconWrapper, { backgroundColor: currentTheme.primaryBttn, padding: 6, borderRadius: 8 }]}>
                            <MaterialIcons
                                name={typeof iconName === 'string' ? iconName as any : "water-drop"}
                                size={22}
                                color={currentTheme.primaryBttnText}
                            />
                        </View>
                    )}
                    <Text style={[setitem.settingName, { color: currentTheme.text }]}>{name}</Text>
                </View>

                <View style={setitem.rightContainer}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Text style={[setitem.settingValue, { color: currentTheme.primaryBttn }]}>
                            {currentLabel}
                        </Text>
                        <MaterialIcons name="chevron-right" size={20} color={currentTheme.primaryBttn} />
                    </View>
                </View>
            </Pressable>

            {/* 📱 Full Screen Immersive Modal view */}
            <Modal
                transparent={false} // Setting this to false forces a full native screen canvas overlay
                visible={isOpen}
                animationType="slide" // Immersive slide-up transition matching mobile paradigms
                onRequestClose={onClose}
            >
                <View style={[setitem.pageContainer, { backgroundColor: currentTheme.background }]}>

                    {/* Header bar structure */}
                    <View style={[setitem.headerBar, { borderBottomColor: currentTheme.divider }]}>
                        <Pressable onPress={onClose} style={setitem.backButton}>
                            <MaterialIcons name="arrow-back" size={24} color={currentTheme.text} />
                        </Pressable>
                        <Text style={[setitem.pageTitle, { color: currentTheme.text }]}>
                            Select {name}
                        </Text>
                        <View style={{ width: 24 }} /> {/* Visual layout stabilizer balance axis */}
                    </View>

                    {/* Full Selection Surface Area */}
                    <ScrollView style={setitem.scrollContainer}>
                        {bloodTypes.map(b => {
                            const isSelected = b.value === selectedBloodType;
                            return (
                                <Pressable
                                    key={b.value}
                                    onPress={() => handleSelectValue(b.value)}
                                    style={({ pressed }) => [
                                        setitem.pageRow,
                                        {
                                            backgroundColor: isSelected ? currentTheme.backgroundElement : "transparent",
                                            borderBottomColor: currentTheme.divider,
                                            opacity: pressed ? 0.7 : 1
                                        }
                                    ]}
                                >
                                    <Text style={[
                                        setitem.regularText,
                                        {
                                            color: isSelected ? currentTheme.primaryBttn : currentTheme.text,
                                            fontFamily: "Body-Medium"
                                        }
                                    ]}>
                                        {b.label}
                                    </Text>

                                    {/* 🛠️ FIX: Use a strict ternary operator here so it returns null instead of a bare boolean false */}
                                    {isSelected ? (
                                        <MaterialIcons name="check" size={22} color={currentTheme.primaryBttn} />
                                    ) : null}
                                </Pressable>
                            );
                        })}
                    </ScrollView>
                </View>
            </Modal>
        </>
    );
}

const setitem = StyleSheet.create({
    setItemBase: { width: "100%", height: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12 },
    leftContainer: { flexDirection: "row", alignItems: "center", gap: 12 },
    rightContainer: { justifyContent: "flex-end", alignItems: "center" },
    iconWrapper: { justifyContent: "center", alignItems: "center" },
    settingName: { fontSize: 18, fontFamily: "Body-Medium" },
    settingValue: { fontSize: 18, fontFamily: "Condensed-Bold" },

    // Full Page Layout Overrides
    pageContainer: { flex: 1, paddingTop: 16 },
    headerBar: { height: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, borderBottomWidth: 1, marginBottom: 8 },
    backButton: { padding: 4 },
    pageTitle: { fontSize: 20, fontFamily: "Heading-Font" },
    scrollContainer: { flex: 1 },
    pageRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%", paddingVertical: 18, paddingHorizontal: 20, borderBottomWidth: 1 },
    regularText: { fontSize: 18 }
});