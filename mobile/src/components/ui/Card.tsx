import React from "react";
import { Text, View, ViewProps } from "react-native";
import { radius, spacing, typography } from "@/theme";
import { useStyles } from "@/theme/ThemeProvider";

function useCardStyles() {
  return useStyles((c) => ({
    card: {
      backgroundColor: c.surfaceGlass,
      borderColor: c.surfaceGlassBorder,
      borderWidth: 1,
      borderRadius: radius.lg,
      overflow: "hidden" as const,
    },
    header: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.sm,
      gap: spacing.xs,
    },
    title: { ...typography.h3, color: c.foreground },
    description: { ...typography.small, color: c.mutedForeground },
    content: { padding: spacing.lg, gap: spacing.md },
  }));
}

export function Card({ style, children, ...rest }: ViewProps) {
  const styles = useCardStyles();
  return (
    <View style={[styles.card, style]} {...rest}>
      {children}
    </View>
  );
}

export function CardHeader({ children, style, ...rest }: ViewProps) {
  const styles = useCardStyles();
  return (
    <View style={[styles.header, style]} {...rest}>
      {children}
    </View>
  );
}

export function CardTitle({ children }: { children: React.ReactNode }) {
  const styles = useCardStyles();
  return <Text style={styles.title}>{children}</Text>;
}

export function CardDescription({ children }: { children: React.ReactNode }) {
  const styles = useCardStyles();
  return <Text style={styles.description}>{children}</Text>;
}

export function CardContent({ children, style, ...rest }: ViewProps) {
  const styles = useCardStyles();
  return (
    <View style={[styles.content, style]} {...rest}>
      {children}
    </View>
  );
}
