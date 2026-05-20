import React from "react";
import {
  ActivityIndicator,
  Pressable,
  PressableProps,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { ColorPalette, radius, spacing, typography } from "@/theme";
import { useTheme } from "@/theme/ThemeProvider";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "destructive";
type Size = "sm" | "md" | "lg";

type Props = Omit<PressableProps, "children"> & {
  title?: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  testID?: string;
  children?: React.ReactNode;
};

export function Button({
  title,
  variant = "primary",
  size = "md",
  loading,
  disabled,
  leftIcon,
  rightIcon,
  fullWidth = true,
  style,
  children,
  ...rest
}: Props) {
  const { palette } = useTheme();
  const variantPalette = getPalette(variant, palette);
  const dims = getDims(size);

  const containerStyle: ViewStyle = {
    backgroundColor: variantPalette.background,
    borderColor: variantPalette.border,
    borderWidth: variant === "outline" ? 1 : 0,
    height: dims.height,
    paddingHorizontal: dims.paddingX,
    borderRadius: radius.md,
    opacity: disabled || loading ? 0.55 : 1,
    alignSelf: fullWidth ? "stretch" : "flex-start",
  };

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        containerStyle,
        pressed && !disabled && !loading && { opacity: 0.85 },
        style as ViewStyle,
      ]}
      {...rest}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator size="small" color={variantPalette.foreground} />
        ) : (
          leftIcon
        )}
        {title ? (
          <Text style={[styles.label, { color: variantPalette.foreground, fontSize: dims.fontSize }]}>
            {title}
          </Text>
        ) : (
          children
        )}
        {!loading && rightIcon}
      </View>
    </Pressable>
  );
}

function getPalette(v: Variant, c: ColorPalette) {
  switch (v) {
    case "primary":
      return { background: c.crisisRescue, foreground: "#03121C", border: c.crisisRescue };
    case "secondary":
      return { background: c.secondary, foreground: c.foreground, border: c.border };
    case "outline":
      return { background: "transparent", foreground: c.foreground, border: c.borderStrong };
    case "ghost":
      return { background: "transparent", foreground: c.foreground, border: "transparent" };
    case "destructive":
      return { background: c.destructive, foreground: c.destructiveForeground, border: c.destructive };
  }
}

function getDims(s: Size) {
  switch (s) {
    case "sm":
      return { height: 38, paddingX: spacing.md, fontSize: 14 };
    case "lg":
      return { height: 52, paddingX: spacing.xl, fontSize: 16 };
    default:
      return { height: 46, paddingX: spacing.lg, fontSize: 15 };
  }
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  label: {
    ...typography.bodyStrong,
  },
});
