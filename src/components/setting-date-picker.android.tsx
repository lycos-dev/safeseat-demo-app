import ThemedHost from "@/components/themed-host";
// @/components/setting-date-picker.android.tsx
import { useTheme } from "@/hooks/use-theme";
import { Host, Icon } from "@expo/ui";
import { useState, useMemo, useEffect } from "react";
import {
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

type SettingDatePickerProps = {
    iconName?: any;
    name: string;
    value?: string; // e.g., "Jan 01, 2000"
    isLast?: boolean;
    enabled?: boolean;
    onValueChange?: (dateString: string) => void;
};

const MONTHS = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

export default function SettingDatePickerItem({
    iconName,
    name,
    value = "Jan 01, 2000",
    isLast = false,
    enabled = true,
    onValueChange,
}: SettingDatePickerProps) {
    const currentTheme = useTheme();

    // Core Visibility State
    const [modalVisible, setModalVisible] = useState(false);

    // Temporary Picker States
    const [selectedMonth, setSelectedMonth] = useState(0); // 0-11
    const [selectedDay, setSelectedDay] = useState(1);
    const [selectedYear, setSelectedYear] = useState(2000);

    // Sync state if asynchronous storage loads after mounting
    useEffect(() => {
        if (value) {
            try {
                const parts = value.replace(",", "").split(" ");
                const mIdx = MONTHS.indexOf(parts[0]);
                const dVal = parseInt(parts[1], 10);
                const yVal = parseInt(parts[2], 10);

                if (mIdx !== -1) setSelectedMonth(mIdx);
                if (!isNaN(dVal)) setSelectedDay(dVal);
                if (!isNaN(yVal)) setSelectedYear(yVal);
            } catch (e) {
                // Fallback catch block
            }
        }
    }, [value]);

    // Generate years dynamically from present-day down to 100 years ago
    const yearsList = useMemo(() => {
        const currentYear = new Date().getFullYear();
        const years = [];
        for (let y = currentYear; y >= currentYear - 100; y--) {
            years.push(y);
        }
        return years;
    }, []);

    // Calculate maximum days available dynamically based on month and leap years
    const daysInMonth = useMemo(() => {
        const days = new Date(selectedYear, selectedMonth + 1, 0).getDate();
        return Array.from({ length: days }, (_, i) => i + 1);
    }, [selectedMonth, selectedYear]);

    const handleOpenModal = () => {
        try {
            const parts = value.replace(",", "").split(" ");
            const mIdx = MONTHS.indexOf(parts[0]);
            const dVal = parseInt(parts[1], 10);
            const yVal = parseInt(parts[2], 10);

            if (mIdx !== -1) setSelectedMonth(mIdx);
            if (!isNaN(dVal)) setSelectedDay(dVal);
            if (!isNaN(yVal)) setSelectedYear(yVal);
        } catch (e) {
            // Safe fallback
        }
        setModalVisible(true);
    };

    const handleSave = () => {
        let finalDay = selectedDay;
        const maxDays = daysInMonth.length;
        if (finalDay > maxDays) finalDay = maxDays;

        const paddedDay = finalDay < 10 ? `0${finalDay}` : `${finalDay}`;
        const dateString = `${MONTHS[selectedMonth]} ${paddedDay}, ${selectedYear}`;

        if (onValueChange) {
            onValueChange(dateString);
        }
        setModalVisible(false);
    };

    return (
        <>
            <Pressable
                onPress={enabled ? handleOpenModal : undefined}
                disabled={!enabled}
                style={({ pressed }) => [{ backgroundColor: currentTheme.backgroundElement, opacity: pressed ? 0.8 : 1 }]}
            >
                <View style={[setitem.setItemBase, { borderBottomWidth: isLast ? 0 : 1, borderBottomColor: currentTheme.divider }]}>
                    <View style={setitem.leftContainer}>
                        {iconName && (
                            /* Fixed touch interception by adding pointerEvents="none" to native icon block */
                            <View style={[setitem.iconWrapper, { backgroundColor: currentTheme.primaryBttn, padding: 6, borderRadius: 8 }]} pointerEvents="none">
                                <ThemedHost style={{ width: 22, height: 22 }}>
                                    <Icon name={iconName} color={currentTheme.primaryBttnText} />
                                </ThemedHost>
                            </View>
                        )}
                        <Text style={[setitem.settingName, { color: currentTheme.text }]}>{name}</Text>
                    </View>

                    <View style={setitem.rightContainer}>
                        <Text style={{ color: currentTheme.primaryBttn, fontSize: 16, fontFamily: "Body-Medium" }}>
                            {value}
                        </Text>
                    </View>
                </View>
            </Pressable>

            <Modal
                transparent={true}
                visible={modalVisible}
                animationType="fade"
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={setitem.modalOverlay}>
                    <View style={[setitem.modalContent, { backgroundColor: currentTheme.backgroundElement }]}>
                        <Text style={[setitem.modalTitle, { color: currentTheme.text }]}>Select Birthday</Text>

                        {/* 3-Column List Select Framework */}
                        <View style={setitem.pickerContainer}>

                            {/* Month Segment */}
                            <View style={setitem.pickerColumn}>
                                <Text style={[setitem.columnLabel, { color: currentTheme.textSecondary }]}>Month</Text>
                                <ScrollView style={[setitem.scrollTrack, { borderColor: currentTheme.divider }]} nestedScrollEnabled={true}>
                                    {MONTHS.map((m, idx) => (
                                        <Pressable
                                            key={m}
                                            style={[setitem.rowItem, selectedMonth === idx && { backgroundColor: currentTheme.primaryBttn }]}
                                            onPress={() => setSelectedMonth(idx)}
                                        >
                                            <Text style={[setitem.rowText, { color: selectedMonth === idx ? currentTheme.primaryBttnText : currentTheme.text }]}>{m}</Text>
                                        </Pressable>
                                    ))}
                                </ScrollView>
                            </View>

                            {/* Day Segment */}
                            <View style={setitem.pickerColumn}>
                                <Text style={[setitem.columnLabel, { color: currentTheme.textSecondary }]}>Day</Text>
                                <ScrollView style={[setitem.scrollTrack, { borderColor: currentTheme.divider }]} nestedScrollEnabled={true}>
                                    {daysInMonth.map((d) => (
                                        <Pressable
                                            key={d}
                                            style={[setitem.rowItem, selectedDay === d && { backgroundColor: currentTheme.primaryBttn }]}
                                            onPress={() => setSelectedDay(d)}
                                        >
                                            <Text style={[setitem.rowText, { color: selectedDay === d ? currentTheme.primaryBttnText : currentTheme.text }]}>{d}</Text>
                                        </Pressable>
                                    ))}
                                </ScrollView>
                            </View>

                            {/* Year Segment */}
                            <View style={setitem.pickerColumn}>
                                <Text style={[setitem.columnLabel, { color: currentTheme.textSecondary }]}>Year</Text>
                                <ScrollView style={[setitem.scrollTrack, { borderColor: currentTheme.divider }]} nestedScrollEnabled={true}>
                                    {yearsList.map((y) => (
                                        <Pressable
                                            key={y}
                                            style={[setitem.rowItem, selectedYear === y && { backgroundColor: currentTheme.primaryBttn }]}
                                            onPress={() => setSelectedYear(y)}
                                        >
                                            <Text style={[setitem.rowText, { color: selectedYear === y ? currentTheme.primaryBttnText : currentTheme.text }]}>{y}</Text>
                                        </Pressable>
                                    ))}
                                </ScrollView>
                            </View>

                        </View>

                        {/* Dialog Action Strip */}
                        <View style={setitem.buttonRow}>
                            <Pressable
                                style={[setitem.btn, { backgroundColor: currentTheme.backgroundSelected }]}
                                onPress={() => setModalVisible(false)}
                            >
                                <Text style={{ color: currentTheme.text, fontFamily: "Body-Medium" }}>Cancel</Text>
                            </Pressable>

                            <Pressable
                                style={[setitem.btn, { backgroundColor: currentTheme.primaryBttn }]}
                                onPress={handleSave}
                            >
                                <Text style={{ color: currentTheme.primaryBttnText, fontFamily: "Condensed-Bold" }}>Save</Text>
                            </Pressable>
                        </View>
                    </View>
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
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", padding: 16 },
    modalContent: { width: "100%", borderRadius: 16, padding: 20, elevation: 5 },
    modalTitle: { fontSize: 20, fontFamily: "Heading-Font", marginBottom: 16, textAlign: "center" },
    pickerContainer: { flexDirection: "row", justifyContent: "space-between", gap: 8, height: 180, marginBottom: 24 },
    pickerColumn: { flex: 1, height: "100%" },
    columnLabel: { fontSize: 12, textAlign: "center", marginBottom: 4, fontFamily: "Condensed-Bold" },
    scrollTrack: { flex: 1, borderWidth: 1, borderRadius: 8, overflow: "hidden" },
    rowItem: { paddingVertical: 10, alignItems: "center", justifyContent: "center" },
    rowText: { fontSize: 16, fontFamily: "Body-Medium" },
    buttonRow: { flexDirection: "row", justifyContent: "flex-end", gap: 12 },
    btn: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, alignItems: "center", justifyContent: "center" }
});
