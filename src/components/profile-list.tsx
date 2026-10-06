import ThemedHost from "@/components/themed-host";
import checkXml from "@expo/material-symbols/check.xml";
import { Spacing as spacing, FontSize as fontsize, type ThemePalette } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { View, Pressable, Text, Image, StyleSheet } from "react-native"
import { Host, Icon } from "@expo/ui"

type Profile = {
    id: string;
    name: string;
    icon?: string;
    isAccountOwner?: boolean;
};

type ProfileListProps = {
    name: string;
    pfp?: string;
    checked?: boolean;
    isLast?: boolean;
    onPress?: () => void;
}

export default function ProfileList({
    name,
    pfp,
    checked = false,
    isLast = false,
    onPress,
}: ProfileListProps) {

  const themes = useTheme();
  const styles = createStyles(themes);    return (
        <Pressable
            style={({ pressed }) => [styles.base, checked && styles.checked, isLast && styles.isLast, pressed && styles.pressed]}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityState={{ selected: checked }}
            accessibilityLabel={`${name}${checked ? ", selected" : ""}`}
        >

            {!pfp || pfp == "" ? (
                <View style={styles.pfp}>
                    <Text style={styles.monogram}>{name.charAt(0).toUpperCase()}</Text>
                </View>
            ) : (
                <Image source={{ uri: pfp }} style={styles.pfp} />
            )}

            <Text style={styles.name}>{name}</Text>

            {checked && (
                <ThemedHost matchContents>
                    <Icon name={Icon.select({
                        ios: "checkmark",
                        android: checkXml
                    })} color={themes.primaryBttn} />
                </ThemedHost>
            )}
        </Pressable>
    )
}

const createStyles = (themes: ThemePalette) => StyleSheet.create({
    base: {
        width: "100%",
        minHeight: 64,
        backgroundColor: themes.backgroundElement,
        flexDirection: "row",
        padding: spacing.one + 2,
        gap: spacing.two,
        borderWidth: spacing.none,
        borderColor: themes.divider,
        alignItems: "center",
        borderLeftWidth: 3,
        borderLeftColor: "transparent",
    },
    checked: {
        backgroundColor: themes.primarySoft,
        borderLeftColor: themes.primaryBttn,
    },
    pressed: {
        opacity: 0.78,
    },
    pfp: {
        width: spacing.seven,
        height: spacing.seven,
        backgroundColor: themes.secondaryBttn,
        borderWidth: spacing.quarter,
        borderColor: themes.divider,
        borderRadius: spacing.four,
        alignItems: "center",
        justifyContent: "center",
    },
    monogram: {
        fontSize: fontsize.header,
        fontWeight: 600,
        color: themes.text
    },
    name: {
        fontSize: fontsize.body,
        fontFamily: "Body-Medium",
        color: themes.text,
        flex: 1,
    },
    isLast: {
        borderBottomWidth: spacing.quarter,
        borderColor: themes.secondaryBttn,
    }
})
