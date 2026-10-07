import ThemedHost from "@/components/themed-host";
// components/ChangePasswordModal.tsx
import { Spacing as spacing, FontSize as fontsize, type ThemePalette } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import * as Haptics from "expo-haptics";
import { useEffect, useState } from "react";
import { Host, Icon } from "@expo/ui";
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
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth";
import { auth } from "../firebase";
import Button from "./button";
import TextInput from "./text-input";

import visibilityXml from "@expo/material-symbols/visibility.xml";
import visibilityOffXml from "@expo/material-symbols/visibility_off.xml";

type Props = {
    visible: boolean;
    onClose: () => void;
    onSuccess?: () => void;
};

// Basic password strength check — at least 8 characters
const isValidPassword = (pw: string): boolean => pw.length >= 8;

export default function ChangePasswordModal({ visible, onClose, onSuccess }: Props) {
    const themes = useTheme();
    const styles = createStyles(themes);
    const [isLoading, setIsLoading] = useState(false);

    const [oldPassword, setOldPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    // separate visibility toggle per field, since they're independent inputs
    const [oldVisible, setOldVisible] = useState(false);
    const [newVisible, setNewVisible] = useState(false);
    const [confirmVisible, setConfirmVisible] = useState(false);

    useEffect(() => {
        if (visible) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
    }, [visible]);

    const hasUnsavedChanges =
        oldPassword !== "" || newPassword !== "" || confirmPassword !== "";

    const isFormInvalid =
        oldPassword.trim() === "" ||
        !isValidPassword(newPassword) ||
        newPassword !== confirmPassword;

    const handleResetAndClose = () => {
        setOldPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setOldVisible(false);
        setNewVisible(false);
        setConfirmVisible(false);
        onClose();
    };

    const handleSave = async () => {
        const currentUser = auth.currentUser;

        if (!currentUser || !currentUser.email) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert("Authentication Error", "No active user found. Please sign in again.");
            return;
        }

        if (!isValidPassword(newPassword)) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert("Weak Password", "New password must be at least 8 characters.");
            return;
        }

        if (newPassword !== confirmPassword) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert("Passwords Don't Match", "New password and confirmation must match.");
            return;
        }

        if (newPassword === oldPassword) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert("Same Password", "New password must be different from your old password.");
            return;
        }

        setIsLoading(true);

        try {
            // 1. Re-authenticate with the OLD password — Firebase requires a
            //    recent sign-in before it will let you change the password.
            const credential = EmailAuthProvider.credential(currentUser.email, oldPassword);
            await reauthenticateWithCredential(currentUser, credential);

            // 2. Actually change the password in Firebase Auth
            await updatePassword(currentUser, newPassword);

            handleResetAndClose();
            if (onSuccess) onSuccess();
        } catch (error: any) {
            console.error("Error updating password: ", error);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

            let errorMessage = "Failed to update password. Please try again.";
            if (
                error.code === "auth/wrong-password" ||
                error.code === "auth/invalid-credential" ||
                error.code === "auth/invalid-password"
            ) {
                errorMessage = "Incorrect old password. Please try again.";
            } else if (error.code === "auth/weak-password") {
                errorMessage = "New password is too weak. Please choose a stronger one.";
            } else if (error.code === "auth/requires-recent-login") {
                errorMessage = "For security, please sign in again before changing your password.";
            }

            Alert.alert("Update Failed", errorMessage);
        } finally {
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
                            <Text style={styles.header}>Change Password</Text>

                            <View style={{ width: "100%", gap: spacing.one }}>

                                {/* Old password */}
                                <View style={{ flexDirection: "row", gap: spacing.one }}>
                                    <View style={{ flex: 1 }}>
                                        <TextInput
                                            type={oldVisible ? "text" : "password"}
                                            variant="regular"
                                            placeholder="Old Password"
                                            enabled={true}
                                            value={oldPassword}
                                            onChangeText={setOldPassword}
                                        />
                                    </View>
                                    <Button
                                        variant={!oldVisible ? "secondary" : "primary"}
                                        onPress={() => setOldVisible(!oldVisible)}
                                    >
                                        <View style={{ paddingHorizontal: spacing.two, paddingVertical: spacing.one }}>
                                            <ThemedHost key={`old-eye-${themes.mode}`}>
                                                {!oldVisible ? (
                                                    <Icon name={Icon.select({ ios: "eye.fill", android: visibilityXml })} color={themes.textSecondary} />
                                                ) : (
                                                    <Icon name={Icon.select({ ios: "eye.slash.fill", android: visibilityOffXml })} color={themes.textSecondary} />
                                                )}
                                            </ThemedHost>
                                        </View>
                                    </Button>
                                </View>

                                {/* New password */}
                                <View style={{ flexDirection: "row", gap: spacing.one }}>
                                    <View style={{ flex: 1 }}>
                                        <TextInput
                                            type={newVisible ? "text" : "password"}
                                            variant="regular"
                                            placeholder="New Password"
                                            enabled={true}
                                            value={newPassword}
                                            onChangeText={setNewPassword}
                                        />
                                    </View>
                                    <Button
                                        variant={!newVisible ? "secondary" : "primary"}
                                        onPress={() => setNewVisible(!newVisible)}
                                    >
                                        <View style={{ paddingHorizontal: spacing.two, paddingVertical: spacing.one }}>
                                            <ThemedHost key={`new-eye-${themes.mode}`}>
                                                {!newVisible ? (
                                                    <Icon name={Icon.select({ ios: "eye.fill", android: visibilityXml })} color={themes.textSecondary} />
                                                ) : (
                                                    <Icon name={Icon.select({ ios: "eye.slash.fill", android: visibilityOffXml })} color={themes.textSecondary} />
                                                )}
                                            </ThemedHost>
                                        </View>
                                    </Button>
                                </View>

                                {/* Confirm new password */}
                                <View style={{ flexDirection: "row", gap: spacing.one }}>
                                    <View style={{ flex: 1 }}>
                                        <TextInput
                                            type={confirmVisible ? "text" : "password"}
                                            variant="regular"
                                            placeholder="Confirm New Password"
                                            enabled={true}
                                            value={confirmPassword}
                                            onChangeText={setConfirmPassword}
                                        />
                                    </View>
                                    <Button
                                        variant={!confirmVisible ? "secondary" : "primary"}
                                        onPress={() => setConfirmVisible(!confirmVisible)}
                                    >
                                        <View style={{ paddingHorizontal: spacing.two, paddingVertical: spacing.one }}>
                                            <ThemedHost key={`confirm-eye-${themes.mode}`}>
                                                {!confirmVisible ? (
                                                    <Icon name={Icon.select({ ios: "eye.fill", android: visibilityXml })} color={themes.textSecondary} />
                                                ) : (
                                                    <Icon name={Icon.select({ ios: "eye.slash.fill", android: visibilityOffXml })} color={themes.textSecondary} />
                                                )}
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
                                        label="Change Password"
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
