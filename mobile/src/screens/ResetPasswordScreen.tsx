import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { KeyRound } from "lucide-react-native";

import { Screen } from "@/components/ui/Screen";
import { Brand } from "@/components/ui/Brand";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/Toast";
import { api } from "@/api/client";
import { radius, spacing, typography, ColorPalette } from "@/theme";
import { useStyles, useTheme } from "@/theme/ThemeProvider";
import type { AuthStackProps } from "@/navigation/types";

export default function ResetPasswordScreen({ navigation, route }: AuthStackProps<"ResetPassword">) {
  const { palette } = useTheme();
  const styles = useStyles((c) => makeStyles(c));
  const toast = useToast();
  const token = route.params?.token || "";
  const [form, setForm] = useState({ password: "", confirmPassword: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.password) e.password = "Password is required";
    else if (form.password.length < 6) e.password = "Password must be at least 6 characters";
    if (form.password !== form.confirmPassword) e.confirmPassword = "Passwords do not match";
    if (!token) e.token = "Invalid or missing reset token";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      await api.resetPassword(token, form.password);
      setDone(true);
      toast.success("Password reset successfully");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reset failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!token) {
    return (
      <Screen contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}>
        <View style={{ alignItems: "center", gap: spacing.md }}>
          <Text style={styles.cardTitle}>Invalid Reset Link</Text>
          <Text style={[styles.cardSub, { textAlign: "center" }]}>
            This password reset link is invalid or has expired.
          </Text>
          <Pressable onPress={() => navigation.navigate("ForgotPassword")} hitSlop={8}>
            <Text style={{ color: palette.crisisRescue, fontWeight: "600" }}>Request a new reset link</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  return (
    <Screen contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}>
      <View style={{ alignItems: "center", marginBottom: spacing.xl }}>
        <Brand size="lg" />
      </View>

      <View style={styles.card}>
        {!done ? (
          <View style={{ gap: spacing.lg }}>
            <View style={styles.cardHeader}>
              <View style={styles.iconBubble}>
                <KeyRound size={20} color={palette.crisisRescue} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Set New Password</Text>
                <Text style={styles.cardSub}>Choose a strong password for your account</Text>
              </View>
            </View>

            {errors.token ? (
              <View style={styles.banner}>
                <Text style={styles.bannerText}>{errors.token}</Text>
              </View>
            ) : null}

            <Input
              label="New Password"
              value={form.password}
              onChangeText={(v) => {
                setForm((p) => ({ ...p, password: v }));
                if (errors.password) setErrors((p) => ({ ...p, password: "" }));
              }}
              placeholder="Min 6 characters"
              secure
              error={errors.password}
              inputSize="lg"
            />

            <Input
              label="Confirm New Password"
              value={form.confirmPassword}
              onChangeText={(v) => {
                setForm((p) => ({ ...p, confirmPassword: v }));
                if (errors.confirmPassword) setErrors((p) => ({ ...p, confirmPassword: "" }));
              }}
              placeholder="Re-enter password"
              secure
              error={errors.confirmPassword}
              inputSize="lg"
            />

            <Button title="Reset Password" size="lg" loading={isSubmitting} onPress={handleSubmit} />
          </View>
        ) : (
          <View style={{ gap: spacing.lg, alignItems: "center" }}>
            <View style={styles.successBubble}>
              <KeyRound size={26} color={palette.statusClaimed} />
            </View>
            <Text style={[styles.cardTitle, { textAlign: "center" }]}>Password Updated</Text>
            <Text style={[styles.cardSub, { textAlign: "center" }]}>
              Your password has been successfully reset. You can now sign in with your new password.
            </Text>
            <Button title="Go to Sign In" size="lg" onPress={() => navigation.navigate("SignIn")} />
          </View>
        )}
      </View>
    </Screen>
  );
}

const makeStyles = (c: ColorPalette) =>
  StyleSheet.create({
  card: {
    backgroundColor: c.surfaceGlass,
    borderColor: c.surfaceGlassBorder,
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing.xl,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingBottom: spacing.md,
    borderBottomColor: c.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconBubble: {
    width: 40, height: 40, borderRadius: radius.md,
    backgroundColor: "rgba(43, 179, 242, 0.18)",
    alignItems: "center", justifyContent: "center",
  },
  successBubble: {
    width: 56, height: 56, borderRadius: radius.pill,
    backgroundColor: "rgba(49, 168, 101, 0.18)",
    alignItems: "center", justifyContent: "center",
  },
  cardTitle: { ...typography.h3, color: c.foreground },
  cardSub: { ...typography.small, color: c.mutedForeground },
  banner: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(242, 59, 59, 0.4)",
    backgroundColor: "rgba(242, 59, 59, 0.1)",
    padding: spacing.md,
  },
  bannerText: { ...typography.small, color: c.destructive },
});
