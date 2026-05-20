import React from "react";
import { Text, View } from "react-native";
import { Radio } from "lucide-react-native";
import { spacing, typography } from "@/theme";
import { useStyles, useTheme } from "@/theme/ThemeProvider";

type Props = {
  size?: "sm" | "md" | "lg";
  subtitle?: string;
};

export function Brand({ size = "md", subtitle }: Props) {
  const { palette } = useTheme();
  const dims =
    size === "lg" ? { icon: 28, font: 26 } : size === "sm" ? { icon: 18, font: 16 } : { icon: 22, font: 20 };
  const styles = useStyles((c) => ({
    container: { alignItems: "center" as const, gap: spacing.sm },
    row: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: spacing.sm,
    },
    brand: { ...typography.h1, color: c.foreground, letterSpacing: 0.5 },
    subtitle: { ...typography.small, color: c.mutedForeground, textAlign: "center" as const },
  }));

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Radio size={dims.icon} color={palette.crisisRescue} />
        <Text style={[styles.brand, { fontSize: dims.font }]}>CrisisGrid</Text>
      </View>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}
