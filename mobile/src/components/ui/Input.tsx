import React, { forwardRef, useState } from "react";
import { Pressable, Text, TextInput, TextInputProps, View, ViewStyle } from "react-native";
import { Eye, EyeOff } from "lucide-react-native";
import { radius, spacing, typography } from "@/theme";
import { useStyles, useTheme } from "@/theme/ThemeProvider";

type Props = TextInputProps & {
  label?: string;
  hint?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  secure?: boolean;
  containerStyle?: ViewStyle;
  inputSize?: "md" | "lg";
};

export const Input = forwardRef<TextInput, Props>(function Input(
  { label, hint, error, leftIcon, rightIcon, secure, containerStyle, inputSize = "md", style, ...rest },
  ref,
) {
  const { palette } = useTheme();
  const [hidden, setHidden] = useState(Boolean(secure));
  const [focused, setFocused] = useState(false);
  const height = inputSize === "lg" ? 52 : 46;

  const styles = useStyles((c) => ({
    label: {
      ...typography.small,
      color: c.foreground,
      marginBottom: spacing.xs,
      fontWeight: "600" as const,
    },
    field: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      borderWidth: 1,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
    },
    input: {
      flex: 1,
      color: c.foreground,
      fontSize: 15,
      paddingVertical: 0,
    },
    icon: {
      paddingHorizontal: spacing.xs,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    hint: { ...typography.small, color: c.mutedForeground, marginTop: spacing.xs },
    error: { ...typography.small, color: c.destructive, marginTop: spacing.xs },
  }));

  const borderColor = error
    ? palette.destructive
    : focused
    ? palette.crisisRescue
    : palette.input;

  return (
    <View style={[{ width: "100%" }, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View
        style={[
          styles.field,
          { borderColor, height, backgroundColor: palette.surface },
        ]}
      >
        {leftIcon ? <View style={styles.icon}>{leftIcon}</View> : null}
        <TextInput
          ref={ref}
          style={[styles.input, style]}
          placeholderTextColor={palette.mutedForeground}
          secureTextEntry={hidden}
          autoCapitalize="none"
          autoCorrect={false}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          {...rest}
        />
        {secure ? (
          <Pressable
            onPress={() => setHidden((p) => !p)}
            hitSlop={10}
            style={styles.icon}
            accessibilityLabel={hidden ? "Show password" : "Hide password"}
          >
            {hidden ? (
              <Eye size={18} color={palette.mutedForeground} />
            ) : (
              <EyeOff size={18} color={palette.mutedForeground} />
            )}
          </Pressable>
        ) : rightIcon ? (
          <View style={styles.icon}>{rightIcon}</View>
        ) : null}
      </View>
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
});
