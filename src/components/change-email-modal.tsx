import ThemedHost from "@/components/themed-host";
// components/ChangeEmailModal.tsx
import { Spacing as spacing, FontSize as fontsize, type ThemePalette } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import * as Haptics from "expo-haptics";
import { Host, Icon } from "@expo/ui";
import { useEffect, useRef, useState } from "react";
import {
    Alert,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    StyleSheet,
    Text,
    TouchableWithoutFeedback,
    View,
} from "react-native";

// 🛠️ Firebase Imports
import { EmailAuthProvider, reauthenticateWithCredential, verifyBeforeUpdateEmail } from "firebase/auth";
import { auth } from "../firebase";
import { accountErrorMessage } from "@/utils/account-errors";
import Button from "./button";
import TextInput from "./text-input";

import visibilityXml from "@expo/material-symbols/visibility.xml";
import visibilityOffXml from "@expo/material-symbols/visibility_off.xml";

type Props = {
    visible: boolean;
    onClose: () => void;
    onSuccess?: () => void;
};

const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
};

export default function ChangeEmailModal({ visible, onClose, onSuccess }: Props) {
    const themes = useTheme();
    const styles = createStyles(themes);
    const [isLoading, setIsLoading] = useState(false);
    const savingRef = useRef(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [passVisible, setPassVisible] = useState(false);

    useEffect(() => {
        if (visible) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
    }, [visible]);

    const hasUnsavedChanges = email !== "" || password !== "";
    const isFormInvalid = !isValidEmail(email) || password.trim() === "";

    const handleResetAndClose = () => {
        setEmail("");
        setPassword("");
        onClose();
    };

    const handleSave = async () => {
        if (savingRef.current) return;
        const currentUser = auth.currentUser;

        if (!currentUser || !currentUser.email) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert("Authentication Error", "No active user found. Please sign in again.");
            return;
        }

        if (!isValidEmail(email)) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert("Invalid Email", "Please enter a valid email address.");
            return;
        }

        savingRef.current = true;
        setIsLoading(true);

        try {
            // 1. Verify the current password against Firebase Auth
            const credential = EmailAuthProvider.credential(currentUser.email, password);
            await reauthenticateWithCredential(currentUser, credential);

            // Auth changes the email only after the new address is verified.
            // The next login/profile load syncs the verified email to Firestore.
            await verifyBeforeUpdateEmail(currentUser, email.trim().toLowerCase());

            handleResetAndClose();
            Alert.alert("Verify your new email", "Follow the link sent to your new email address, then log in with it. Your current email stays active until verification.");
            if (onSuccess) onSuccess();
        } catch (error: any) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

            let errorMessage = "Failed to update email. Please try again.";
            if (
                error.code === "auth/wrong-password" ||
                error.code === "auth/invalid-credential" ||
                error.code === "auth/invalid-password"
            ) {
                errorMessage = "Incorrect password. Please try again.";
            }

            Alert.alert("Update Failed", accountErrorMessage(error, errorMessage));
        } finally {
            savingRef.current = false;
            setIsLoading(false);
        }
    };

    return (
        <Modal
            animationType="fade"
            transparent={true}
            visible={visible}
            onRequestClose={handleResetAndClose}
        >
            <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
                <View style={styles.backdrop}>
                    <KeyboardAvoidingView
                        behavior={Platform.OS === "ios" ? "padding" : "height"}
                        style={{ width: "100%" }}
                    >
                        <View style={styles.container}>
                            <Text style={styles.header}>Change Email</Text>

                            <View style={{ width: "100%", gap: spacing.one }}>
                                <TextInput
                                    type="email"
                                    variant="regular"
                                    placeholder="New Email"
                                    enabled={!isLoading}
                                    value={email}
                                    onChangeText={setEmail}
                                />
                                <View style={{ flexDirection: "row", gap: spacing.one }}>

                                    <View style={{ flex: 1 }}>
                                        <TextInput
                                            type={passVisible ? "text" : "password"}
                                            variant="regular"
                                            placeholder="Password"
                                            enabled={!isLoading}
                                            value={password}
                                            onChangeText={setPassword}
                                        />
                                    </View>

                                    <Button
                                        variant={!passVisible ? "secondary" : "primary"}
                                        onPress={() => setPassVisible(!passVisible)}
                                    >
                                        <View style={{ paddingHorizontal: spacing.two, paddingVertical: spacing.one }}>
                                            <ThemedHost key={`password-eye-${themes.mode}`}>
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
                            </View>

                            <View style={styles.actionRow}>
                                <Button
                                    variant={hasUnsavedChanges ? "warn" : "secondary"}
                                    label={hasUnsavedChanges ? "Discard" : "Cancel"}
                                    enabled={!isLoading}
                                    onPress={() => {
                                        if (hasUnsavedChanges) {
                                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                                            Alert.alert("Discard Changes?", "You have unsaved changes. Discard?", [
                                                { text: "Cancel", style: "cancel" },
                                                { text: "Discard", onPress: handleResetAndClose, style: "destructive" },
                                            ]);
                                        } else {
                                            handleResetAndClose();
                                        }
                                    }}
                                    style={{ borderRadius: 6 }}
                                />
                                <View style={{ flex: 1 }}>
                                    <Button
                                        variant="primary"
                                        label="Update Email"
                                        onPress={handleSave}
                                        style={{ borderRadius: 6 }}
                                        enabled={!isFormInvalid && !isLoading}
                                        loading={isLoading}
                                    />
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
    backdrop: {
        flex: 1,
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: spacing.two,
    },
    container: {
        width: "100%",
        maxWidth: 400,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: themes.backgroundElement,
        borderWidth: spacing.quarter,
        borderColor: themes.secondaryBttn,
        padding: spacing.one,
        borderRadius: spacing.edge,
        gap: spacing.one,
    },
    header: {
        color: themes.text,
        fontSize: fontsize.header,
        fontFamily: "Heading-Font",
    },
    actionRow: {
        flexDirection: "row",
        gap: spacing.half,
        maxWidth: "100%",
    },
}); 
