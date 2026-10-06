import { Spacing as spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import * as Clipboard from "expo-clipboard"; // 🛠️ Import Expo Clipboard
import * as Haptics from "expo-haptics"; // 🛠️ Optional: for nice tap feedback

type TextBlockProps = {
	text: string;
	copyable?: boolean;
	label?: string;
};

export default function TextBlock({ text, copyable = false, label }: TextBlockProps) {
	const themes = useTheme();
	// 🛠️ Copy Action Handler
	const handlePress = async () => {
		if (!copyable || text === "Not Set") return;

		try {
			await Clipboard.setStringAsync(text);
			await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

			// Optional visual confirmation toast
			{(!label || label == "") ? 
				Alert.alert("Copied", "Copied to clipboard!")
			:
			Alert.alert("Copied", `${label} copied to clipboard.`); }
		} catch (error) {
			console.error("Failed to copy text:", error);
		}
	};

	return (
		// 🛠️ Changed View to TouchableOpacity, disabled interaction if copyable is false
		<TouchableOpacity
			activeOpacity={copyable ? 0.7 : 1}
			disabled={!copyable}
			onPress={handlePress}
			style={[
				textblockstyles.baseCard,
				{ backgroundColor: themes.backgroundElement },
			]}
		>
			<Text style={{ color: themes.text, fontSize: 18, fontFamily: "Body-Bold" }}>
				{text}
			</Text>
		</TouchableOpacity>
	);
}

const textblockstyles = StyleSheet.create({
	baseCard: {
		padding: 12,
		borderRadius: 8,
		width: "100%"
	},
});