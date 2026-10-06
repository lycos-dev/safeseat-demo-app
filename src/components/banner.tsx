import ThemedHost from "@/components/themed-host";
import sirenXml from "@expo/material-symbols/siren.xml";
import closeXml from "@expo/material-symbols/close.xml";
import { Spacing as spacing, FontSize as fontsize, type ThemePalette } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { useBanner } from "@/hooks/banner-context";
import { Host, Icon } from "@expo/ui";
import {
    Linking,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    useColorScheme,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Button from "./button";

// Firebase Imports
import { auth, db } from "../firebase"; // Adjust path to your firebase config
import { collection, getDocs, query, where } from "firebase/firestore";
import { useEffect } from "react";

import * as Haptics from "expo-haptics"

export default function Banner() {
    const themes = useTheme();
    const seatcard = createStyles(themes);
    const { visible, message, hideBanner } = useBanner();
    const insets = useSafeAreaInsets();

    useEffect(() => {
        if (visible) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }, [visible, message]);

    if (!visible) return null;

    // 1. Call Contact Handler (Firebase fetch)
    const handleCallContact = async () => {
        try {
            const user = auth.currentUser;
            if (!user) {
                alert("No user is currently logged in.");
                return;
            }

            // Query emergencyContacts subcollection
            const contactsRef = collection(db, `users/${user.uid}/emergencyContacts`);
            const snapshot = await getDocs(contactsRef);

            if (snapshot.empty) {
                alert("No emergency contacts found.");
                return;
            }

            const contacts = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            }));

            // Find primary contact (hierarchy check: primary === true or priority === 1)
            const primaryContact =
                contacts.find(
                    (c: any) =>
                        c.isPrimary === true ||
                        c.primary === true ||
                        c.hierarchy === "primary" ||
                        c.priority === 1
                ) || contacts[0]; // Fallback to first contact if no primary flag is set

            // @ts-ignore
            const phoneNumber = primaryContact?.phoneNumber || primaryContact?.phone;

            if (phoneNumber) {
                // Sanitize phone string for dialer
                const sanitizedNumber = phoneNumber.replace(/[^0-9+]/g, "");
                Linking.openURL(`tel:${sanitizedNumber}`);
            } else {
                alert("Primary contact does not have a valid phone number.");
            }
        } catch (error) {
            console.error("Error fetching emergency contact:", error);
            alert("Failed to fetch emergency contact.");
        }
    };

    // 2. Locate Hospitals Handler (Google Maps Deep Link)
    const handleLocateHospitals = () => {
        const query = encodeURIComponent("hospitals");

        // Android intent vs iOS Google Maps fallback
        const url = Platform.select({
            ios: `maps://app?q=${query}`,
            android: `geo:0,0?q=${query}`,
        });

        const webUrl = `https://www.google.com/maps/search/?api=1&query=${query}`;

        if (url) {
            Linking.canOpenURL(url).then((supported) => {
                if (supported) {
                    Linking.openURL(url);
                } else {
                    Linking.openURL(webUrl);
                }
            });
        } else {
            Linking.openURL(webUrl);
        }
    };

    return (
        <View
            style={[
                seatcard.baseCard,
                {
                    backgroundColor: themes.backgroundElement,
                    borderWidth: spacing.quarter,
                    boxSizing: "border-box",
                    borderStyle: "solid",
                    borderColor: themes.warnBttn,
                },
            ]}
        >
            <View
                style={[
                    seatcard.leftArea,
                    {
                        backgroundColor: themes.warnBttn,
                    },
                ]}
            >
                <ThemedHost matchContents>
                    <Icon
                        name={Icon.select({
                            ios: "light.beacon.max.fill",
                            android: sirenXml,
                        })}
                        color={themes.warnBttnText}
                        size={spacing.three}
                    />
                </ThemedHost>
            </View>
            <View
                style={{
                    paddingVertical: spacing.one,
                    flex: 1,
                    borderWidth: spacing.none,
                    borderColor: "#fff",
                    paddingRight: spacing.one,
                    gap: spacing.one,
                }}
            >
                <View style={{ flexDirection: "row", gap: spacing.one, alignItems: "center" }}>
                    <Text style={[seatcard.name, { color: themes.text, flex: 1 }]}>
                        {message || "Status update"}
                    </Text>
                    <Pressable
                        style={{
                            width: spacing.three,
                            height: spacing.three,
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                        onPress={() => {
                            hideBanner();
                        }}
                    >
                        <ThemedHost matchContents>
                            <Icon
                                name={Icon.select({
                                    ios: "xmark",
                                    android: closeXml,
                                })}
                                size={spacing.three}
                                color={themes.textSecondary}
                            />
                        </ThemedHost>
                    </Pressable>
                </View>

                <View style={{ flexDirection: "row", gap: spacing.one }}>
                    <View>
                        <Button
                            variant="secondary"
                            label="Call Contact"
                            onPress={handleCallContact}
                            style={{ borderRadius: 6 }}
                        />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Button
                            variant="warn"
                            label="Locate Hospitals"
                            onPress={handleLocateHospitals}
                            fullWidth={true}
                            style={{ borderRadius: 6 }}
                        />
                    </View>
                </View>
            </View>
        </View>
    );
}

const createStyles = (themes: ThemePalette) => StyleSheet.create({
    baseCard: {
        width: "100%",
        borderWidth: spacing.none,
        borderColor: themes.text,
        flexDirection: "row",
        gap: spacing.one,
        borderRadius: spacing.edge,
        overflow: "hidden",
        padding: spacing.quarter,
    },
    seatNoCont: {
        width: "15%",
        alignItems: "center",
        justifyContent: "center",
    },
    leftArea: {
        width: spacing.six,
        borderTopLeftRadius: spacing.one,
        borderTopRightRadius: spacing.quarter,
        borderBottomLeftRadius: spacing.one,
        borderBottomRightRadius: spacing.quarter,
        alignItems: "center",
        justifyContent: "center",
    },
    name: {
        fontSize: fontsize.body,
        fontFamily: "Body-Bold",
    },
    stateName: {
        fontSize: fontsize.body,
        fontFamily: "Body-Bold",
    },
    role: {
        fontSize: fontsize.caption,
        fontFamily: "Body-Bold",
    },
    emptySeat: {
        opacity: 1,
    },
});
