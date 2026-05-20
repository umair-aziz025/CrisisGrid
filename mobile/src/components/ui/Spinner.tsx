import React from "react";
import { ActivityIndicator, View, ViewStyle } from "react-native";
import { useStyles, useTheme } from "@/theme/ThemeProvider";

type Props = {
  size?: "small" | "large";
  fullscreen?: boolean;
  style?: ViewStyle;
};

export function Spinner({ size = "large", fullscreen, style }: Props) {
  const { palette } = useTheme();
  const styles = useStyles((c) => ({
    fullscreen: {
      flex: 1,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      backgroundColor: c.background,
    },
  }));

  if (fullscreen) {
    return (
      <View style={[styles.fullscreen, style]}>
        <ActivityIndicator size={size} color={palette.crisisRescue} />
      </View>
    );
  }
  return <ActivityIndicator size={size} color={palette.crisisRescue} style={style} />;
}
