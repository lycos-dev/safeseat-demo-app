import ThemedHost from "@/components/themed-host";
import circleXml from "@expo/material-symbols/circle.xml";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Host, Icon } from "@expo/ui";
import { type ThemePalette, Spacing as spacing, FontSize as fontsize } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

// Import Android Material Symbol XMLs at top level to avoid re-render layout shifts
import homeXml from "@expo/material-symbols/home.xml";
import carXml from "@expo/material-symbols/directions_car.xml";
import groupXml from "@expo/material-symbols/group.xml";
import settingsXml from "@expo/material-symbols/settings.xml";

export default function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
    const themes = useTheme();
    const styles = createStyles(themes);
    const getTabIcon = (routeName: string, isFocused: boolean) => {
        switch (routeName) {
            case "home":
                return Icon.select({
                    ios: isFocused ? "house.fill" : "house",
                    android: homeXml
                });
            case "assign":
                return Icon.select({
                    ios: isFocused ? "carseat.right.fill" : "carseat.right",
                    android: carXml,
                });
            case "everyone":
                return Icon.select({
                    ios: isFocused ? "person.3.fill" : "person.3",
                    android: groupXml,
                });
            case "settings":
                return Icon.select({
                    ios: isFocused ? "gearshape.fill" : "gearshape",
                    android: settingsXml,
                });
            default:
                return Icon.select({
                    ios: "square",
                    android: homeXml,
                });
        }
    };

    return (
        <View style={styles.tabContainer}>
            <View style={styles.tabDrawer}>
                {state.routes.map((route, index) => {
                    const { options } = descriptors[route.key];
                    const isFocused = state.index === index;

                    const label =
                        options.tabBarLabel !== undefined
                            ? options.tabBarLabel
                            : options.title !== undefined
                                ? options.title
                                : route.name;

                    const onPress = () => {
                        const event = navigation.emit({
                            type: "tabPress",
                            target: route.key,
                            canPreventDefault: true,
                        });

                        if (!isFocused && !event.defaultPrevented) {
                            navigation.navigate(route.name);
                        }
                    };

                    const iconSource = getTabIcon(route.name, isFocused);
                    const tintColor = isFocused ? themes.primaryBttnText : themes.text;

                    return (
                        <Pressable
                            key={route.key}
                            onPress={onPress}
                            style={[styles.tabButton]}
                        >
                            <ThemedHost>
                                <Icon name={iconSource} color={isFocused ? themes.primaryBttn : themes.textSecondary} />
                            </ThemedHost>

                            <Text style={[styles.label, isFocused && styles.activeLabel]}>
                                {typeof label === "string" ? label : route.name}
                            </Text>

                            { isFocused &&
                                <ThemedHost>
                                    <Icon name={Icon.select({
                                        ios: "circle.fill",
                                        android: circleXml
                                    })} size={spacing.one} color={themes.primaryBttn} />
                                </ThemedHost>
                            }
                        </Pressable>
                    );
                })}
            </View>
        </View>
    );
}

const createStyles = (themes: ThemePalette) => StyleSheet.create({
    tabContainer: {
        flexDirection: "row",
        position: "absolute",
        bottom: -8,
        paddingVertical: spacing.none,
        paddingHorizontal: spacing.two,
        justifyContent: "space-around",
        alignItems: "center",
        height: 112,
        overflow: "visible",
    },
    tabButton: {
        flex: 1,
        alignItems: "center",
        justifyContent: "flex-start",
        paddingTop: spacing.three,
        paddingBottom: spacing.one,
        gap: spacing.two,
        marginHorizontal: spacing.one,
        borderWidth: spacing.none,
        borderColor: "#fff"
    },
    label: {
        color: themes.textSecondary,
        fontSize: fontsize.button
    },
    activeLabel: {
        color: themes.primaryBttn,
        fontWeight: "bold",
    },
    tabDrawer: {
        borderWidth: spacing.quarter,
        borderBottomWidth: spacing.none,
        borderTopLeftRadius: spacing.edge,
        borderTopRightRadius: spacing.edge,
        borderColor: themes.secondaryBttn,
        width: "100%",
        height: 112,
        flexDirection: "row",
        backgroundColor: themes.backgroundElement,
        overflow: "visible",
        paddingBottom: spacing.two,
    },
});
