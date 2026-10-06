import { useState, type Ref } from "react";
import { StyleSheet, TextInput as RNTextInput, KeyboardTypeOptions } from "react-native";

import { Spacing as spacing, FontSize as fontsize, type ThemePalette } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

type TextInputProps = {
    ref?: Ref<RNTextInput>;
    type?: "text" | "email" | "phone" | "number" | "password";
    variant?: "regular" | "warn";
    placeholder?: string;
    enabled?: boolean;
    value?: string;
    onChangeText?: (text: string) => void;
};

export default function TextInput({
    ref,
    type = "text",
    variant = "regular",
    placeholder,
    enabled = true,
    value,
    onChangeText,
}: TextInputProps) {

  const themes = useTheme();
  const styles = createStyles(themes);    const [internalText, setInternalText] = useState("");
    const [isFocused, setIsFocused] = useState(false);

    // Determines the keyboard layout
    const getKeyboardType = (): KeyboardTypeOptions => {
        switch (type) {
            case "email":
                return "email-address";
            case "phone":
                return "phone-pad";
            case "number":
                return "numeric";
            default:
                return "default";
        }
    };

    return (
        <RNTextInput
            ref={ref}
            style={[
                styles.input,
                variant === "warn" && styles.warnInput,
                !enabled && styles.disabledInput,
                isFocused && enabled && styles.focused,
            ]}
            editable={enabled}
            onChangeText={onChangeText || setInternalText}
            value={value !== undefined ? value : internalText}
            placeholder={placeholder}
            placeholderTextColor={themes.textInputPlaceholder}
            onFocus={() => enabled && setIsFocused(true)}
            onBlur={() => setIsFocused(false)}

            // Native input type configurations
            keyboardType={getKeyboardType()}
            secureTextEntry={type === "password"}
            keyboardAppearance={themes.mode}
            autoCapitalize={type === "email" || type === "password" ? "none" : "sentences"}
            autoCorrect={type !== "password"}
            textContentType={
                type === "password"
                    ? "password"
                    : type === "email"
                        ? "emailAddress"
                        : type === "phone"
                            ? "telephoneNumber"
                            : "none"
            }
        />
    );
}

const createStyles = (themes: ThemePalette) => StyleSheet.create({
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
