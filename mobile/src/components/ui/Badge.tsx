import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, typography } from "@/theme";

type Props = {
  label: string;
  color?: string;
  variant?: "solid" | "soft" | "outline";
  leftIcon?: React.ReactNode;
};

export function Badge({ label, color = colors.crisisRescue, variant = "soft", leftIcon }: Props) {
  const styleSet = getStyle(variant, color);
  return (
    <View style={[styles.base, styleSet.container]}>
      {leftIcon}
      <Text style={[styles.text, { color: styleSet.text }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function getStyle(variant: "solid" | "soft" | "outline", color: string) {
  switch (variant) {
    case "solid":
      return { container: { backgroundColor: color, borderColor: color }, text: "#03121C" };
    case "outline":
      return {
        container: { backgroundColor: "transparent", borderColor: color, borderWidth: 1 },
        text: color,
      };
    default:
      return {
        container: { backgroundColor: hexWithAlpha(color, 0.16), borderColor: hexWithAlpha(color, 0.3), borderWidth: 1 },
        text: color,
      };
  }
}

function hexWithAlpha(hex: string, alpha: number): string {
  if (hex.startsWith("rgba") || hex.startsWith("rgb")) return hex;
  if (!hex.startsWith("#")) return hex;
  const c = hex.replace("#", "");
  const full = c.length === 3 ? c.split("").map((x) => x + x).join("") : c;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    alignSelf: "flex-start",
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  text: {
    ...typography.caption,
    textTransform: "uppercase",
    fontWeight: "700",
  },
});
