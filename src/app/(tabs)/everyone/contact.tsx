import ThemedHost from "@/components/themed-host";
import { confirmAction } from "../../../utils/platform-dialog";
import chatXml from "@expo/material-symbols/chat.xml";
import callXml from "@expo/material-symbols/call.xml";
import { FontSize as fontsize, Spacing as spacing, type ThemePalette } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { deleteDoc, doc, getDoc, updateDoc } from "firebase/firestore";
import { useState, useRef, useCallback } from "react";
import { auth, db } from "../../../firebase";
import {
    Alert,
    Dimensions,
    Keyboard,
    Linking,
    Pressable,
    StyleSheet,
    Text,
    View,
    ActivityIndicator
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import * as Haptics from "expo-haptics";

import Button from "@/components/button";
import TextInput from "@/components/text-input";
import { Dropdown } from "react-native-element-dropdown";
import FormScrollView from "@/components/form-scroll-view";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Host, Icon } from "@/components/ui-bridge";
import { normalizePhilippineMobileNumber, PH_MOBILE_VALIDATION_MESSAGE } from "@/utils/philippine-phone";

const { width: screenWidth } = Dimensions.get("window");

const HIERARCHY_OPTIONS = [
    { label: "1st contact", value: 1 },
    { label: "2nd contact", value: 2 },
    { label: "3rd contact", value: 3 },
    { label: "4th contact", value: 4 },
    { label: "5th contact", value: 5 },
];

export default function Contact() {

  const themes = useTheme();
  const styles = createStyles(themes);    const router = useRouter();
    const insets = useSafeAreaInsets();

    // grab the id the way Everyone.tsx actually sends it
    const { contactId } = useLocalSearchParams();
    const id = Array.isArray(contactId) ? contactId[0] : contactId;

    const [userName, setUserName] = useState<string>("Guest");
    const [userPhone, setUserPhone] = useState<string>("Not Set");
    const [userHierarchy, setUserHierarchy] = useState<number>(1);

    const originalData = useRef({ name: "Guest", phone: "Not Set", hierarchy: 1 });

    // UI Interaction State
    const [editMode, setEditMode] = useState(false);
    const [saving, setSaving] = useState(false);

    const hasUnsavedChanges = () => {
        return (
            userName !== originalData.current.name ||
            userPhone !== originalData.current.phone ||
            userHierarchy !== originalData.current.hierarchy
        );
    };

    useUnsavedChangesGuard(editMode && hasUnsavedChanges());

    const discardChanges = () => {
        Keyboard.dismiss();
        setUserName(originalData.current.name);
        setUserPhone(originalData.current.phone);
        setUserHierarchy(originalData.current.hierarchy);
        setEditMode(false);
    };

    const handleCancelEdit = async () => {
        if (!hasUnsavedChanges()) {
            // nothing to lose, no need to ask
            discardChanges();
            return;
        }

        const discard = await confirmAction({
            title: "Discard?",
            message: "You have unsaved changes. Discard?",
            confirmText: "Discard",
            cancelText: "Keep Editing",
            destructive: true,
        });
        if (discard) discardChanges();
    };

    const handleSaveChanges = async () => {
        const currentUser = auth.currentUser;
        if (!currentUser || !id) return;
        if (!userName.trim() || !userPhone.trim()) {
            Alert.alert("Required information missing", "Name and phone number are required.");
            return;
        }

        const normalizedPhone = normalizePhilippineMobileNumber(userPhone);
        if (!normalizedPhone) {
            Alert.alert("Invalid Phone Number", PH_MOBILE_VALIDATION_MESSAGE);
            return;
        }

        Keyboard.dismiss();
        setSaving(true);
        try {
            await updateDoc(doc(db, "users", currentUser.uid, "emergencyContacts", id), {
                name: userName,
                phone: normalizedPhone,
                hierarchy: userHierarchy,
            });
            setUserPhone(normalizedPhone);
            originalData.current = { name: userName, phone: normalizedPhone, hierarchy: userHierarchy };
            setEditMode(false);
        } catch (error) {
            Alert.alert("Error", "Something went wrong saving your changes. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteContact = () => {
        void confirmAction({
            title: `Delete ${userName}?`,
            message: `Are you sure you want to delete ${userName}? This can't be undone.`,
            confirmText: "Delete",
            destructive: true,
        }).then(async (confirmed) => {
            if (!confirmed) return;
            const currentUser = auth.currentUser;
            if (!currentUser || !id) return;

            setSaving(true);
            try {
                await deleteDoc(doc(db, "users", currentUser.uid, "emergencyContacts", id));
                router.back();
            } catch (error) {
                Alert.alert("Error", "Something went wrong deleting this contact. Please try again.");
                setSaving(false);
            }
        });
    };

    const handleCall = () => {
        if (!userPhone || userPhone === "Not Set") return;
        Linking.openURL(`tel:${userPhone}`);
    };

    const handleText = () => {
        if (!userPhone || userPhone === "Not Set") return;
        Linking.openURL(`sms:${userPhone}`);
    };

    const bottomPad = 104 + (insets.bottom / 2);

    const [isLoaded, setIsLoaded] = useState(false);

    const fetchContact = useCallback(async () => {
        const currentUser = auth.currentUser;
        if (!currentUser || !id) {
            setIsLoaded(true); // nothing to load, stop the spinner anyway
            return;
        }

        try {
            const snap = await getDoc(
                doc(db, "users", currentUser.uid, "emergencyContacts", id)
            );
            if (snap.exists()) {
                const data = snap.data() as any;
                const name = data.name ?? "Guest";
                const phone = data.phone ?? "Not Set";
                const hierarchy =
                    data.hierarchy != null && !isNaN(Number(data.hierarchy))
                        ? Number(data.hierarchy)
                        : 1;

                setUserName(name);
                setUserPhone(phone);
                setUserHierarchy(hierarchy);
                originalData.current = { name, phone, hierarchy };
            }
        } catch (error) {
            Alert.alert("Error", "Couldn't load this contact. Please try again.");
        } finally {
            setIsLoaded(true);
        }
    }, [id]);

    useFocusEffect(
        useCallback(() => {
            let isMounted = true;
            setIsLoaded(false); // show the spinner again while this refetch runs

            fetchContact().then(() => {
                if (!isMounted) setIsLoaded(false); // avoid touching state after unmount
            });

            return () => {
                isMounted = false;
            };
        }, [fetchContact])
    );

    if (!isLoaded) {
        return (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: themes.background }}>
                <ActivityIndicator color={themes.text} size="large" />
            </View>
        )
    }

    return (
        <SafeAreaView
            style={{ flex: 1, backgroundColor: themes.background }}
            edges={["left", "right", "bottom"]}
        >
                <FormScrollView
                    contentContainerStyle={[{ flexGrow: 1 }, { marginTop: spacing.one, paddingBottom: bottomPad }]}
                    showsVerticalScrollIndicator={true}
                    bounces={true}
                >
                    <View style={[styles.container, { marginTop: -spacing.two }]}>
                        <View style={{
                            flexDirection: "column",
                            alignItems: "center",
                            marginBottom: spacing.none,
                            gap: spacing.two,
                        }}>
                            <View style={styles.contactAvatar}>
                                <Text style={styles.contactInitial}>
                                    {(userName || "?").charAt(0).toUpperCase()}
                                </Text>
                            </View>
                            <View style={styles.priorityBadge}>
                                <Text style={styles.priorityBadgeText}>
                                    {HIERARCHY_OPTIONS.find((item) => item.value === userHierarchy)?.label ?? `Contact ${userHierarchy}`}
                                </Text>
                            </View>
                            <Text style={[styles.pageHeader, { color: themes.text, flex: 1 }]}>
                                {userName.split(" ")[0]}
                            </Text>
                        </View>

                        <View style={{ gap: spacing.three }}>

                            <View style={{ gap: spacing.one }}>
                                <Text style={{
                                    fontFamily: "Heading-Font",
                                    color: themes.text,
                                    fontSize: fontsize.header,
                                    marginTop: spacing.one,
                                }}>
                                    Contact details
                                </Text>

                                <View style={{ borderRadius: spacing.edge, overflow: "hidden" }}>

                                    {/* Name */}
                                    <View style={[styles.fixedFieldContainer, !editMode && styles.notLast, { backgroundColor: editMode ? themes.background : themes.backgroundElement }]}>
                                        <Text style={[styles.fixedInfoLabel, { color: themes.primaryBttn }]}>
                                            Name
                                        </Text>
                                        {editMode ? (
                                            <View style={{ flex: 1 }}>
                                                <TextInput
                                                    type="text"
                                                    value={userName}
                                                    onChangeText={setUserName}
                                                    placeholder="Name"
                                                    enabled={!saving}
                                                />
                                            </View>
                                        ) : (
                                            <Text style={{ color: themes.text, fontFamily: "Body-Medium", fontSize: fontsize.body }}>
                                                {userName}
                                            </Text>
                                        )}
                                    </View>

                                    {/* Number */}
                                    <View style={[styles.fixedFieldContainer, !editMode && styles.notLast, { backgroundColor: editMode ? themes.background : themes.backgroundElement }]}>
                                        <Text style={[styles.fixedInfoLabel, { color: themes.primaryBttn }]}>
                                            Phone number
                                        </Text>
                                        {editMode ? (
                                            <View style={{ flex: 1 }}>
                                                <TextInput
                                                    type="phone"
                                                    value={userPhone}
                                                    onChangeText={setUserPhone}
                                                    placeholder="09XXXXXXXXX or +639XXXXXXXXX"
                                                    enabled={!saving}
                                                />
                                            </View>
                                        ) : (
                                            <Text style={{ color: themes.text, fontFamily: "Body-Medium", fontSize: fontsize.body }}>
                                                {userPhone}
                                            </Text>
                                        )}
                                    </View>

                                    {/* Hierarchy */}
                                    <View style={[styles.fixedFieldContainer, { backgroundColor: editMode ? themes.background : themes.backgroundElement }]}>
                                        <Text style={[styles.fixedInfoLabel, { color: themes.primaryBttn }]}>
                                            Contact order
                                        </Text>
                                        {editMode ? (
                                            <View style={{ flex: 1 }}>
                                                <Dropdown
                                                    mode="default"
                                                    data={HIERARCHY_OPTIONS}
                                                    labelField="label"
                                                    valueField="value"
                                                    selectedTextStyle={{ color: themes.text, fontFamily: "Body-Medium" }}
                                                    placeholder="Contact order"
                                                    placeholderStyle={{ color: themes.textInputPlaceholder }}
                                                    value={userHierarchy}
                                                    disable={saving}
                                                    style={[
                                                        styles.input
                                                    ]}
                                                    containerStyle={{
                                                        backgroundColor: themes.backgroundElement,
                                                        borderRadius: spacing.edge,
                                                        borderWidth: spacing.quarter,
                                                        borderColor: themes.secondaryBttn,
                                                        overflow: "hidden",
                                                        gap: spacing.none,
                                                        flex: 1,
                                                    }}
                                                    itemTextStyle={{
                                                        color: themes.text,
                                                        margin: spacing.none,
                                                        padding: spacing.none,
                                                        fontFamily: "Body-Medium"
                                                    }}
                                                    itemContainerStyle={{
                                                        margin: spacing.none,
                                                        marginHorizontal: spacing.none,
                                                        padding: spacing.none,
                                                        borderBottomWidth: spacing.quarter,
                                                        borderColor: themes.secondaryBttn,
                                                        flex: 1,
                                                    }}
                                                    activeColor={themes.primaryBttn}
                                                    maxHeight={spacing.ten * 3}
                                                    onChange={(item) => setUserHierarchy(item.value)}
                                                    autoScroll={false}
                                                />
                                            </View>
                                        ) : (
                                            <Text style={{ color: themes.text, fontFamily: "Body-Medium", fontSize: fontsize.body }}>
                                                {HIERARCHY_OPTIONS.find(o => o.value === userHierarchy)?.label ?? "1st contact"}
                                            </Text>
                                        )}
                                    </View>
                                </View>
                            </View>

                            <View style={{ flexDirection: "column", gap: spacing.one }}>
                                {editMode ? (
                                    <>
                                        <View style={{ flexDirection: "row", gap: spacing.one }}>
                                            <View>
                                                <Button
                                                    variant="secondary"
                                                    label={hasUnsavedChanges() ? "Discard" : "Cancel"}
                                                    onPress={handleCancelEdit}
                                                    enabled={!saving}
                                                />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Button
                                                    variant="primary"
                                                    label="Save"
                                                    onPress={() => {
                                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                                        handleSaveChanges();
                                                    }}
                                                    loading={saving}
                                                    enabled={!saving}
                                                />
                                            </View>
                                        </View>

                                        <View style={{ flex: 1 }}>
                                            <Button
                                                variant="warn"
                                                label={`Delete ${userName}`}
                                                onPress={handleDeleteContact}
                                                enabled={!saving}
                                            />
                                        </View>
                                    </>
                                ) : (
                                    <>
                                        <View style={{ flexDirection: "row", gap: spacing.one }}>
                                            <View style={{ flex: 1 }}>
                                                <Button
                                                    variant="secondary"
                                                    label="Text"
                                                    onPress={handleText}
                                                    enabled={userPhone !== "Not Set"}
                                                    style={{
                                                        height: 120,
                                                        alignItems: "center",
                                                        justifyContent: "center",
                                                        gap: spacing.one,
                                                    }}
                                                >
                                                    <ThemedHost matchContents>
                                                        <Icon name={Icon.select({
                                                            ios: "message.fill",
                                                            android: chatXml
                                                        })} size={spacing.six} color={themes.text} />
                                                    </ThemedHost>
                                                </Button>
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Button
                                                    variant="primary"
                                                    label="Call"
                                                    onPress={handleCall}
                                                    enabled={userPhone !== "Not Set"}
                                                    style={{
                                                        height: 120,
                                                        alignItems: "center",
                                                        justifyContent: "center",
                                                        gap: spacing.one,
                                                    }}
                                                >
                                                    <ThemedHost matchContents>
                                                        <Icon name={Icon.select({
                                                            ios: "phone.fill",
                                                            android: callXml
                                                        })} size={spacing.six} color={themes.primaryBttnText} />
                                                    </ThemedHost>
                                                </Button>
                                            </View>
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Button
                                                variant="secondary"
                                                label="Edit Profile"
                                                onPress={() => {
                                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                                    setEditMode(true);
                                                }}
                                                enabled={!saving}
                                            />
                                        </View>
                                    </>
                                )}
                            </View>
                        </View>
                    </View>
                </FormScrollView>
        </SafeAreaView>
    );
}

const createStyles = (themes: ThemePalette) => StyleSheet.create({
    container: {
        flex: 1,
        width: "100%",
        paddingLeft: spacing.two,
        paddingRight: spacing.two,
        borderWidth: spacing.none,
        borderColor: "#fff",
        gap: spacing.three,
        paddingTop: spacing.three
    },
    fieldContainer: {
        gap: 4,
        width: "100%",
    },
    pageHeader: {
        fontSize: fontsize.title,
        fontFamily: "Body-Bold",
        color: themes.text,
        margin: spacing.none
    },
    infoLabel: {
        fontFamily: "Condensed-Bold",
        fontSize: fontsize.body,
        margin: spacing.none,
    },
    caption: {
        opacity: 0.8,
        fontSize: fontsize.caption
    },
    textInput: {
        width: "100%",
        minHeight: spacing.six,
        justifyContent: "center",
        paddingHorizontal: spacing.two,
        borderRadius: spacing.one,
    },
    fixedInfoLabel: {
        fontSize: fontsize.body,
        fontFamily: "Body-Medium"
    },
    fixedFieldContainer: {
        paddingHorizontal: spacing.two,
        paddingVertical: spacing.one,
        flexDirection: "row",
        gap: spacing.one,
        width: "100%",
        borderWidth: spacing.none,
        borderColor: themes.text,
        alignItems: "center",
        minHeight: spacing.seven
    },
    notLast: {
        borderBottomWidth: spacing.quarter,
        borderColor: themes.secondaryBttn
    },
    dropdown: {
        height: spacing.seven,
        width: "100%",
    },
    sectionHelper: {
        color: themes.textMuted,
        fontSize: 9.5,
        lineHeight: 14,
        fontFamily: "Body-Regular",
        marginTop: -spacing.half,
        marginBottom: spacing.one,
    },
    input: {
        height: spacing.six,
        borderWidth: spacing.quarter,
        paddingHorizontal: spacing.two,
        fontSize: fontsize.button,
        borderRadius: spacing.edge,
        color: themes.text,
        fontFamily: "Body-Medium",
        backgroundColor: themes.backgroundElement,
        borderColor: themes.textSecondary,
        borderStyle: "dashed"
    },

    contactAvatar: {
        width: 112,
        height: 112,
        borderRadius: 56,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: themes.primarySoft,
        borderWidth: 2,
        borderColor: themes.primaryBttn,
    },
    contactInitial: {
        color: themes.primaryBttn,
        fontSize: 44,
        fontFamily: "Body-Bold",
    },
    priorityBadge: {
        paddingHorizontal: spacing.two,
        paddingVertical: spacing.half,
        borderRadius: 999,
        backgroundColor: themes.backgroundElement,
        borderWidth: 1,
        borderColor: themes.divider,
    },
    priorityBadgeText: {
        color: themes.textSecondary,
        fontSize: fontsize.caption,
        fontFamily: "Body-Bold",
    },
});
