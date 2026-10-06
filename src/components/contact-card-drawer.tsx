import ThemedHost from "@/components/themed-host";
import closeXml from "@expo/material-symbols/close.xml";
import chatXml from "@expo/material-symbols/chat.xml";
import callXml from "@expo/material-symbols/call.xml";
// components/PasswordVerifyModal.tsx
import { type ThemePalette } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { BottomSheet, Button, Column, Host, Icon, Row, Spacer, Text } from "@expo/ui";
import { buttonBorderShape, buttonStyle, controlSize } from "@expo/ui/swift-ui/modifiers";

import * as Haptics from "expo-haptics"
import { useEffect, useRef, useState } from "react";
import { Alert, StyleSheet } from "react-native";

type Props = {
    visible: boolean;
    name: string;
    number: string;
    order: string;
    onClose: () => void;
};

export default function ContactCardDrawer({ visible, onClose, name, number, order }: Props) {

  const themes = useTheme();
  const styles = createStyles(themes);    const currentTheme = themes;

    useEffect(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    }, [visible])

    return (
        <ThemedHost matchContents>
            <BottomSheet isPresented={visible} onDismiss={onClose} showDragIndicator={false} snapPoints={["half"]}>
                <Column spacing={16} alignment="start">
                    <Spacer size={0} />
                    {/* 🧭 Header Row */}
                    <Row>
                        <Column spacing={0}>
                            {/* Main Content Body */}
                            <Text textStyle={{ color: currentTheme.textSecondary, fontSize: 18, textAlign: "left" }}>
                                {order.toUpperCase()}
                            </Text>
                            <Text textStyle={{ color: currentTheme.text, fontSize: 36, fontWeight: "bold", textAlign: "left" }}>
                                {name}
                            </Text>
                            <Row spacing={6} alignment="center">
                                <Text textStyle={{ color: currentTheme.text, fontSize: 20, fontWeight: "600", textAlign: "left" }}>
                                    {number}
                                </Text>
                                <Button
                                    label="Copy"
                                    variant="text"
                                    onPress={() => Alert.alert("Action 2")}
                                >
                                </Button>
                            </Row>
                        </Column>

                        <Spacer flexible />

                        <Button
                            modifiers={[buttonStyle('glass'), controlSize("large"), buttonBorderShape("circle")]}
                        >
                            <Icon name={Icon.select({
                                ios: "xmark",
                                android: closeXml
                            })} color={themes.textSecondary} />
                        </Button>
                    </Row>
                    {/* 🔲 Native Large Square Action Buttons Grid */}
                    <Row spacing={12} alignment="center">
                        <Button
                            variant="outlined"
                            modifiers={[
                                controlSize("extraLarge"),
                                buttonBorderShape("roundedRectangle")
                            ]}
                            onPress={() => Alert.alert("Action 2")}
                            style={{ height: 100 }}
                        >
                            <Column alignment="center" spacing={4}>
                                <Icon name={Icon.select({
                                    ios: "pencil",
                                    android: chatXml
                                })} size={24} color={themes.text} />
                                <Text textStyle={{ fontSize: 14, fontWeight: "600" }}>Edit</Text>
                            </Column>
                        </Button>
                        <Button
                            variant="outlined"
                            modifiers={[
                                controlSize("extraLarge"),
                                buttonBorderShape("roundedRectangle")
                            ]}
                            onPress={() => Alert.alert("Action 2")}
                            style={{ height: 100 }}
                        >
                            <Column alignment="center" spacing={4}>
                                <Icon name={Icon.select({
                                    ios: "bubble.left.and.bubble.right.fill",
                                    android: chatXml
                                })} size={24} color={themes.text} />
                                <Text textStyle={{ fontSize: 14, fontWeight: "600" }}>Message</Text>
                            </Column>
                        </Button>
                        <Button
                            modifiers={[
                                buttonStyle('borderedProminent'),
                                controlSize("extraLarge"),
                                buttonBorderShape("roundedRectangle")
                            ]}
                            onPress={() => Alert.alert("Action 1")}
                            style={{ height: 100 }}
                        >
                            <Column alignment="center" spacing={4}>
                                <Icon name={Icon.select({
                                    ios: "phone.fill",
                                    android: callXml
                                })} size={24} color={themes.primaryBttnText} />
                                <Text textStyle={{ fontSize: 14, fontWeight: "600" }}>Call</Text>
                            </Column>
                        </Button>
                    </Row>
                    <Spacer />
                </Column>
            </BottomSheet>
        </ThemedHost>
    );
}

const createStyles = (themes: ThemePalette) => StyleSheet.create({
    title: {
        fontSize: 36,
        textAlign: "center",
        height: 100,
        fontFamily: "Logo-Font",
        borderWidth: 1,
        borderColor: "#fff",
        marginBottom: 8
    }
});
