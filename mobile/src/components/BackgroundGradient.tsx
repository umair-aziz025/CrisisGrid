import React from "react";
import { StyleSheet, View } from "react-native";
import { ColorPalette } from "@/theme";
import { useStyles, useTheme } from "@/theme/ThemeProvider";

/**
 * Approximates the web's `bg-[radial-gradient(...)]` aesthetic with three
 * soft, low-opacity color blobs positioned around the viewport. The blobs
 * pull their colors from the active palette so the gradient subtly shifts
 * between light and dark modes.
 */
type Variant = "default" | "auth" | "danger";

type Props = {
  variant?: Variant;
};

export function BackgroundGradient({ variant = "default" }: Props) {
  const { palette } = useTheme();
  const styles = useStyles((c) => ({
    base: { ...StyleSheet.absoluteFillObject, backgroundColor: c.background },
    blob: { position: "absolute" as const },
  }));
  const blobs = getBlobs(variant, palette);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={styles.base} />
      {blobs.map((b, i) => (
        <View
          key={i}
          style={[
            styles.blob,
            {
              top: b.top,
              left: b.left,
              right: b.right,
              bottom: b.bottom,
              width: b.size,
              height: b.size,
              borderRadius: b.size,
              backgroundColor: b.color,
              opacity: b.opacity,
            },
          ]}
        />
      ))}
    </View>
  );
}

function getBlobs(variant: Variant, c: ColorPalette) {
  switch (variant) {
    case "auth":
      return [
        { top: -120, left: -80, size: 320, color: c.gradientPrimary, opacity: 0.10 },
        { top: 100, right: -120, size: 280, color: c.gradientRescue, opacity: 0.10 },
        { bottom: -100, left: 40, size: 320, color: c.gradientMedical, opacity: 0.06 },
      ];
    case "danger":
      return [
        { top: -100, left: -60, size: 320, color: c.destructive, opacity: 0.08 },
        { bottom: -80, right: -60, size: 280, color: c.warning, opacity: 0.08 },
      ];
    default:
      return [
        { top: -160, left: -120, size: 360, color: c.gradientPrimary, opacity: 0.13 },
        { top: 80, right: -160, size: 320, color: c.gradientRescue, opacity: 0.11 },
        { bottom: -120, left: 20, size: 360, color: c.gradientMedical, opacity: 0.06 },
      ];
  }
}
