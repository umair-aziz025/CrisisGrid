import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Compass } from "lucide-react-native";

import { Screen } from "@/components/ui/Screen";
import { Button } from "@/components/ui/Button";
import { radius, spacing, typography, ColorPalette } from "@/theme";
import { useStyles, useTheme } from "@/theme/ThemeProvider";
import { useNavigation } from "@react-navigation/native";

export default function NotFoundScreen() {
  const { palette } = useTheme();
  const styles = useStyles((c) => makeStyles(c));
  const navigation = useNavigation<any>();
  return (
    <Screen scroll={false} contentContainerStyle={{ justifyContent: "center", alignItems: "center" }}>
      <View style={styles.bubble}>
        <Compass size={36} color={palette.crisisRescue} />
      </View>
      <Text style={styles.code}>404</Text>
      <Text style={styles.title}>Page not found</Text>
      <Text style={styles.body}>
        The screen you're looking for doesn't exist or has been moved.
      </Text>
      <Button
        title="Return Home"
        onPress={() => {
          if (navigation.canGoBack()) navigation.goBack();
          else navigation.popToTop?.();
        }}
        fullWidth={false}
      />
    </Screen>
  );
}

const makeStyles = (c: ColorPalette) =>
  StyleSheet.create({
  bubble: {
    width: 80, height: 80, borderRadius: radius.pill,
    backgroundColor: "rgba(43, 179, 242, 0.15)",
    alignItems: "center", justifyContent: "center",
    marginBottom: spacing.lg,
  },
  code: { ...typography.display, color: c.foreground, fontSize: 56 },
  title: { ...typography.h2, color: c.foreground, marginTop: spacing.sm },
  body: {
    ...typography.body,
    color: c.mutedForeground,
    textAlign: "center",
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
});
