import ThemedHost from "@/components/themed-host";
// components/PasswordVerifyModal.tsx
import { type ThemePalette, Spacing as spacing, FontSize as fontsize } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { extendSession } from "@/utils/securitySession";
import { Host, Icon } from "@expo/ui";
import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState } from "react";
import { Alert, StyleSheet } from "react-native";

import { Modal, TouchableWithoutFeedback, View, KeyboardAvoidingView, Platform, Text, Keyboard } from "react-native";

import TextInput from "./text-input";
import Button from "./button";

// 🛠️ Fixed: Using single, unified Firebase imports
import { auth } from "../firebase";
import { EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";

import visibilityXml from "@expo/material-symbols/visibility.xml";
import visibilityOffXml from "@expo/material-symbols/visibility_off.xml";

type Props = {
    visible: boolean;
    onClose: () => void;
    onSuccess: () => void;
};

export default function PasswordVerifyModal({ visible, onClose, onSuccess }: Props) {
    const themes = useTheme();
    const styles = createStyles(themes);
    const [passwordInput, setPasswordInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const passwordInputRef = useRef<any>(null);
    const [passVisible, setPassVisible] = useState(false)

    const handleVerify = async () => {
        const currentUser = auth.currentUser;
        const enteredPassword = passwordInput.trim();

        if (!currentUser || !currentUser.email) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert("Error", "No active session found. Please sign in again.");
            return;
        }

        setIsLoading(true);

        try {
            const credential = EmailAuthProvider.credential(
                currentUser.email,
                enteredPassword
            );

            await reauthenticateWithCredential(currentUser, credential);

            await extendSession();
            setPasswordInput(""); // Reset field
            onSuccess();
        } catch (error: any) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

            if (error.code === "auth/wrong-password" || error.code === "auth/invalid-credential") {
                Alert.alert("Access Denied", "Incorrect password. Please try again.");
            } else {
                console.error("Firebase Reauthentication Failure: ", error);
                Alert.alert("Error", "Could not verify identity. Check your connection.");
            }
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (visible) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
    }, [visible]);

    return (
        <Modal
            animationType="fade"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            {/* Full-screen backdrop wrapper that centers children */}
            <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
                <View style={styles.backdrop}>
                    <KeyboardAvoidingView
                        behavior={Platform.OS == "ios" ? "padding" : "height"}
                        style={{ width: "100%" }}
                    >

                        <View style={styles.container}>
                            <Text style={styles.header}>
                                Password Required
                            </Text>
                            <View style={{ width: "100%", gap: spacing.one }}>

                                <View style={{ flexDirection: "row", gap: spacing.one }}>

                                    <View style={{ flex: 1 }}>
                                        <TextInput
                                            type={passVisible ? "text" : "password"}
                                            variant="regular"
                                            placeholder="Password"
                                            enabled={true}
                                            value={passwordInput}
                                            onChangeText={setPasswordInput}
                                        />
                                    </View>

                                    <Button
                                        variant={!passVisible ? "secondary" : "primary"}
                                        onPress={() => setPassVisible(!passVisible)}
                                    >
                                        <View style={{ paddingHorizontal: spacing.two, paddingVertical: spacing.one }}>
                                            <ThemedHost>
                                                {!passVisible ? (
                                                    <Icon name={Icon.select({
                                                        ios: "eye.fill",
                                                        android: visibilityXml
                                                    })} color={themes.textSecondary} />
                                                ) : (
                                                    <Icon name={Icon.select({
                                                        ios: "eye.slash.fill",
                                                        android: visibilityOffXml
                                                    })} color={themes.textSecondary} />
                                                )
                                                }
                                            </ThemedHost>
                                        </View>
                                    </Button>

                                </View>

                                <Text style={{ fontSize: fontsize.caption, fontFamily: "Body-Regular", color: themes.textSecondary }}>
                                    We require a password to edit critical information. You will not be asked to enter your password again to edit critical information for the next 15 minutes.
                                </Text>

                            </View>

                            <View style={styles.actionRow}>
                                <Button variant="secondary" label="Cancel" onPress={onClose} enabled={!isLoading} style={{ borderRadius: 6 }} />
                                <View style={{ flex: 1 }}>
                                    <Button variant="primary" label="Submit" onPress={handleVerify} style={{ borderRadius: 6 }} enabled={!isLoading} loading={isLoading} />
                                </View>
                            </View>

                        </View>

                    </KeyboardAvoidingView>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
}

const createStyles = (themes: ThemePalette) => StyleSheet.create({
    // Full-screen overlay to dim screen and center content
    backdrop: {
        flex: 1,
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: spacing.two, // Prevents modal from touching screen edges
    },
    // Centered card content container
    container: {
        width: "100%", // Or a fixed width/max-width like 320
        maxWidth: 400,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: themes.backgroundElement,
        borderWidth: spacing.quarter,
        borderColor: themes.secondaryBttn,
        padding: spacing.one,
        borderRadius: spacing.edge,
        gap: spacing.one
    },
    header: {
        color: themes.text,
        fontSize: fontsize.header,
        fontFamily: "Heading-Font"
    },
    actionRow: {
        flexDirection: "row",
        gap: spacing.half,
        maxWidth: "100%",
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
    focused: {
        borderColor: themes.text,
        borderStyle: "solid"
    },
    warnInput: {
        borderColor: themes.warnBttn,
    },
    disabledInput: {
        opacity: 0.5,
    },
});
