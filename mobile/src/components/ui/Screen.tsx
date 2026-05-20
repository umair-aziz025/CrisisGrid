import React from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ScrollViewProps,
  View,
  ViewStyle,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { spacing } from "@/theme";
import { useStyles } from "@/theme/ThemeProvider";
import { BackgroundGradient } from "@/components/BackgroundGradient";

type Props = {
  children: React.ReactNode;
  scroll?: boolean;
  contentContainerStyle?: ViewStyle;
  keyboardOffset?: number;
  edges?: ("top" | "right" | "bottom" | "left")[];
  scrollProps?: ScrollViewProps;
  padded?: boolean;
  /** Background gradient variant. Pass `false` to disable. */
  gradient?: "default" | "auth" | "danger" | false;
};

export function Screen({
  children,
  scroll = true,
  contentContainerStyle,
  keyboardOffset = 0,
  edges = ["top", "left", "right", "bottom"],
  scrollProps,
  padded = true,
  gradient = "default",
}: Props) {
  const insets = useSafeAreaInsets();

  const styles = useStyles((c) => ({
    safe: { flex: 1, backgroundColor: c.background },
    flex: { flex: 1 },
    padded: { paddingHorizontal: spacing.lg, paddingVertical: spacing.lg },
  }));

  const inner = scroll ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[
        padded && styles.padded,
        { paddingBottom: spacing["2xl"] + insets.bottom },
        contentContainerStyle,
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      {...scrollProps}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, padded && styles.padded, contentContainerStyle]}>{children}</View>
  );

  return (
    <SafeAreaView edges={edges} style={styles.safe}>
      {gradient !== false ? <BackgroundGradient variant={gradient} /> : null}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={keyboardOffset}
      >
        {inner}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
