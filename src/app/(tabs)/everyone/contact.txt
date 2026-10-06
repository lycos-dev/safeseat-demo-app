import { FontSize as fontsize, Spacing as spacing, Themes as themes } from "@/constants/theme";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { deleteDoc, doc, getDoc, updateDoc } from "firebase/firestore";
import { useEffect, useState, useRef, useCallback } from "react";
import { auth, db } from "../../../firebase";
import {
    Alert,
    Dimensions,
    Image,
    Keyboard,
    Linking,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TouchableWithoutFeedback,
    View,
    ActivityIndicator
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import PasswordVerifyModal from "@/components/PasswordVerifyModal";
import { isSessionValid } from "@/utils/securitySession";

import * as Haptics from "expo-haptics";

import Button from "@/components/button";
import TextInput from "@/components/text-input";
import { Dropdown } from "react-native-element-dropdown";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useNavigation } from "expo-router";
import { Host, Icon } from "@expo/ui";

const { width: screenWidth } = Dimensions.get("window");

const HIERARCHY_OPTIONS = [
    { label: "Primary", value: 1 },
    { label: "Secondary", value: 2 },
    { label: "Tertiary", value: 3 },
    { label: "Quaternary", value: 4 },
    { label: "Quinary", value: 5 },
];

export default function Contact() {
    const router = useRouter();
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();

    // grab the id the way Everyone.tsx actually sends it
    const { contactId } = useLocalSearchParams();
    const id = Array.isArray(contactId) ? contactId[0] : contactId;

    const [userName, setUserName] = useState<string>("Guest");
    const [userPhone, setUserPhone] = useState<string>("Not Set");
    const [userHierarchy, setUserHierarchy] = useState<number>(1);

    const originalData = useRef({ name: "Guest", phone: "Not Set", hierarchy: 1 });

    // 4. UI Interaction State
    const [editMode, setEditMode] = useState(false);
    const [authModalVisible, setAuthModalVisible] = useState(false);
    const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
    const [saving, setSaving] = useState(false);

    const hasUnsavedChanges = () => {
        return (
            userName !== originalData.current.name ||
            userPhone !== originalData.current.phone ||
            userHierarchy !== originalData.current.hierarchy
        );
    };

    const unsavedRef = useRef(false);
    useEffect(() => {
        unsavedRef.current = editMode && hasUnsavedChanges();
    });

    // Warn the user if they try to navigate away with unsaved edits
    useEffect(() => {
        const unsubscribe = navigation.addListener("beforeRemove", (e) => {
            if (!unsavedRef.current) {
                return; // nothing unsaved — let it navigate away normally
            }

            e.preventDefault();

            Alert.alert(
                "Discard?",
                "You have unsaved changes. Discard?",
                [
                    { text: "Stay", style: "cancel" },
                    {
                        text: "Discard",
                        style: "destructive",
                        onPress: () => navigation.dispatch(e.data.action),
                    },
                ]
            );
        });

        return unsubscribe;
    }, [navigation]);

    const executeSecureAction = async (action: () => void) => {
        const authenticated = await isSessionValid();
        if (authenticated) {
            action();
        } else {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            setPendingAction(() => () => action());
            setAuthModalVisible(true);
        }
    };

    const discardChanges = () => {
        setUserName(originalData.current.name);
        setUserPhone(originalData.current.phone);
        setUserHierarchy(originalData.current.hierarchy);
        setEditMode(false);
    };

    const handleCancelEdit = () => {
        if (!hasUnsavedChanges()) {
            // nothing to lose, no need to ask
            discardChanges();
            return;
        }

        Alert.alert(
            "Discard?",
            "You have unsaved changes. Discard?",
            [
                { text: "Keep Editing", style: "cancel" },
                {
                    text: "Discard",
                    style: "destructive",
                    onPress: discardChanges,
                },
            ]
        );
    };

    const handleSaveChanges = async () => {
        const currentUser = auth.currentUser;
        if (!currentUser || !id) return;

        setSaving(true);
        try {
            await updateDoc(doc(db, "users", currentUser.uid, "emergencyContacts", id), {
                name: userName,
                phone: userPhone,
                hierarchy: userHierarchy,
            });
            originalData.current = { name: userName, phone: userPhone, hierarchy: userHierarchy };
            setEditMode(false);
        } catch (error) {
            Alert.alert("Error", "Something went wrong saving your changes. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteContact = () => {
        Alert.alert(
            `Nuke ${userName}?`,
            `Are you sure you want to nuke ${userName}? This can't be undone.`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Nuke",
                    style: "destructive",
                    onPress: async () => {
                        const currentUser = auth.currentUser;
                        if (!currentUser || !id) return;

                        setSaving(true);
                        try {
                            await deleteDoc(doc(db, "users", currentUser.uid, "emergencyContacts", id));
                            router.back();
                        } catch (error) {
                            Alert.alert("Error", "Something went wrong nuking this contact. Please try again.");
                            setSaving(false);
                        }
                    },
                },
            ]
        );
    };

    const handleCall = () => {
        if (!userPhone || userPhone === "Not Set") return;
        Linking.openURL(`tel:${userPhone}`);
    };

    const handleText = () => {
        if (!userPhone || userPhone === "Not Set") return;
        Linking.openURL(`sms:${userPhone}`);
    };

    const [keyboardHeight, setKeyboardHeight] = useState(0);

    useEffect(() => {
        const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
        const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

        const showSub = Keyboard.addListener(showEvent, (e) => {
            setKeyboardHeight(e.endCoordinates.height);
        });
        const hideSub = Keyboard.addListener(hideEvent, () => {
            setKeyboardHeight(0);
        });

        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, []);

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
            edges={['left', 'right', "top"]}
        >
            <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
                <KeyboardAwareScrollView
                    contentContainerStyle={[{ flexGrow: 1 }, { marginTop: spacing.one, paddingBottom: bottomPad }]}
                    showsVerticalScrollIndicator={true}
                    bounces={true}
                    extraScrollHeight={spacing.ten}
                >
                    <View style={[styles.container, { marginTop: -spacing.two }]}>
                        <View style={{
                            flexDirection: "column",
                            alignItems: "center",
                            marginBottom: spacing.none,
                            gap: spacing.two,
                        }}>
                            <Pressable
                                disabled={!editMode}
                                onPress={() => { }}
                                style={{
                                    backgroundColor: "transparent",
                                    borderWidth: spacing.half,
                                    borderColor: themes.text,
                                    borderRadius: spacing.eight,
                                    overflow: "hidden",
                                }}
                            >
                                <Image
                                    source={
                                        userHierarchy == 1 ? { uri: "https://pbs.twimg.com/media/C8SFjSYWAAA6452.jpg" }
                                            : userHierarchy == 2 ? { uri: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSNyV3QnQOwXP124try4wkWE0xXqxT6KZitbq4TerzfLkMDDY-v1CXzTGw&s=10" }
                                                : userHierarchy == 3 ? { uri: "https://pbs.twimg.com/media/C8QqGm4UQAAUiET.jpg" }
                                                    : { uri: "https://pbs.twimg.com/media/C8SFjSbXgAAKoZx.jpg" }
                                    }
                                    style={{
                                        width: 120,
                                        height: 120,
                                        alignItems: "center",
                                        justifyContent: "center"
                                    }}
                                />
                            </Pressable>
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
                                    Basic Information
                                </Text>

                                <View style={{ borderRadius: spacing.edge, overflow: "hidden" }}>

                                    {/* Name */}
                                    <View style={[styles.fixedFieldContainer, !editMode && styles.notLast, { backgroundColor: editMode ? themes.background : themes.backgroundElement }]}>
                                        <Text style={[styles.fixedInfoLabel, { color: themes.primaryBttn }]}>
                                            Name:
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
                                            Number:
                                        </Text>
                                        {editMode ? (
                                            <View style={{ flex: 1 }}>
                                                <TextInput
                                                    type="text"
                                                    value={userPhone}
                                                    onChangeText={setUserPhone}
                                                    placeholder="Phone Number"
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
                                            Hierarchy:
                                        </Text>
                                        {editMode ? (
                                            <View style={{ flex: 1 }}>
                                                <Dropdown
                                                    mode="default"
                                                    data={HIERARCHY_OPTIONS}
                                                    labelField="label"
                                                    valueField="value"
                                                    selectedTextStyle={{ color: themes.text, fontFamily: "Body-Medium" }}
                                                    placeholder="Hierarchy"
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
                                                {HIERARCHY_OPTIONS.find(o => o.value === userHierarchy)?.label ?? "Primary"}
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
                                                label={`Nuke ${userName}`}
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
                                                    <Host matchContents>
                                                        <Icon name={Icon.select({
                                                            ios: "message.fill",
                                                            android: import("@expo/material-symbols/chat.xml")
                                                        })} size={spacing.six} />
                                                    </Host>
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
                                                    <Host matchContents>
                                                        <Icon name={Icon.select({
                                                            ios: "phone.fill",
                                                            android: import("@expo/material-symbols/call.xml")
                                                        })} size={spacing.six} />
                                                    </Host>
                                                </Button>
                                            </View>
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Button
                                                variant="secondary"
                                                label="Edit Profile"
                                                onPress={() => {
                                                    executeSecureAction(() => {
                                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                                        setEditMode(true);
                                                    });
                                                }}
                                                enabled={!saving}
                                            />
                                        </View>
                                    </>
                                )}
                            </View>

                            <PasswordVerifyModal
                                visible={authModalVisible}
                                onClose={() => {
                                    setAuthModalVisible(false);
                                    setPendingAction(null);
                                }}
                                onSuccess={() => {
                                    setAuthModalVisible(false);
                                    if (pendingAction) {
                                        pendingAction();
                                        setPendingAction(null);
                                    }
                                }}
                            />
                        </View>
                    </View>
                </KeyboardAwareScrollView>
            </TouchableWithoutFeedback>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
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
        fontFeatureSettings: "Body-Medium",
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
});