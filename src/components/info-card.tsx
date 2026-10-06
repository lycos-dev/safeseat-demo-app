import { type ThemePalette, Spacing as spacing, FontSize as fontsize } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { Host, Icon } from "@expo/ui";
import {
    StyleSheet,
    Text,
    View,
} from "react-native";

type InfoCardProps = {
    smolTopText?: string;
    smolBottomText?: string;
    bigText?: string;
    icon?: any;
};

export default function InfoCard({
    smolTopText,
    smolBottomText,
    bigText = "big text",
    icon,
}: InfoCardProps) {
    const themes = useTheme();
    const seatcard = createStyles(themes);
    return (
        <View
            style={[
                seatcard.baseCard,
            ]}
        >
            <View
                style={[
                    seatcard.leftArea,
                ]}
            >
                {icon}
            </View>
            <View
                style={{
                    paddingVertical: spacing.one,
                    flex: 1,
                    borderWidth: spacing.none,
                    borderColor: "#fff",
                    gap: spacing.half
                }}
            >
                {smolTopText &&
                    <Text
                        style={ seatcard.role }
                    >
                        {smolTopText}
                    </Text>
                }

                <Text style={ seatcard.name }>
                    {bigText}
                </Text>

                {smolBottomText &&
                    <Text
                        style={ seatcard.role }
                    >
                        {smolBottomText}
                    </Text>
                }

            </View>
            
        </View>
    );
}

const createStyles = (themes: ThemePalette) => StyleSheet.create({
    baseCard: {
        width: "100%",
        borderWidth: spacing.quarter,
        borderColor: themes.secondaryBttn,
        flexDirection: "row",
        gap: spacing.one,
        borderRadius: spacing.edge,
        overflow: "hidden",
        padding: spacing.quarter,
        minHeight: spacing.ten,
        backgroundColor: themes.backgroundElement,

    },
    seatNoCont: {
        width: "15%",
        alignItems: "center",
        justifyContent: "center",
    },
    leftArea: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        width: spacing.seven,
        borderTopLeftRadius: spacing.one,
        borderTopRightRadius: spacing.quarter,
        borderBottomLeftRadius: spacing.one,
        borderBottomRightRadius: spacing.quarter,
        backgroundColor: themes.secondaryBttn,
    },
    name: {
        fontSize: fontsize.pageHeader,
        fontFamily: "Body-Bold",
        color: themes.text,
        margin: spacing.none
    },
    stateName: {
        fontSize: fontsize.body,
        fontFamily: "Body-Bold",
    },
    role: {
        fontSize: fontsize.body,
        fontFamily: "Body-Bold",
        color: themes.textSecondary,
        margin: spacing.none
    },
    emptySeat: {
        opacity: 0.5,
    },
});
