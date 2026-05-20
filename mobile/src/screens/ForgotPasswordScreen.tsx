import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ArrowLeft, Mail } from "lucide-react-native";

import { Screen } from "@/components/ui/Screen";
import { Brand } from "@/components/ui/Brand";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/Toast";
import { api } from "@/api/client";
import { radius, spacing, typography, ColorPalette } from "@/theme";
import { useStyles, useTheme } from "@/theme/ThemeProvider";
import type { AuthStackProps } from "@/navigation/types";

export default function ForgotPasswordScreen({ navigation }: AuthStackProps<"ForgotPassword">) {
  const { palette } = useTheme();
  const styles = useStyles((c) => makeStyles(c));
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [resetToken, setResetToken] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!email.trim()) {
      setError("Email is required");
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await api.forgotPassword(email.trim());
      setSent(true);
      if (result.resetToken) setResetToken(result.resetToken);
      toast.success("Password reset instructions sent");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to process request");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Screen contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}>
      <View style={{ alignItems: "center", marginBottom: spacing.xl }}>
        <Brand size="lg" />
      </View>

      <View style={styles.card}>
        {!sent ? (
          <View style={{ gap: spacing.lg }}>
            <View style={styles.cardHeader}>
              <View style={styles.iconBubble}>
                <Mail size={20} color={palette.crisisRescue} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Forgot Password</Text>
                <Text style={styles.cardSub}>We'll help you reset your password</Text>
              </View>
            </View>

            <Input
              label="Email Address"
              value={email}
              onChangeText={(v) => {
                setEmail(v);
                setError("");
              }}
              placeholder="you@example.com"
              keyboardType="email-address"
              error={error}
              inputSize="lg"
            />

            <Button title="Send Reset Link" size="lg" loading={isSubmitting} onPress={handleSubmit} />

            <Pressable onPress={() => navigation.navigate("SignIn")} style={styles.backRow}>
              <ArrowLeft size={14} color={palette.mutedForeground} />
              <Text style={styles.smallMuted}>Back to Sign In</Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ gap: spacing.lg, alignItems: "center" }}>
            <View style={styles.successBubble}>
              <Mail size={26} color={palette.statusClaimed} />
            </View>
            <Text style={[styles.cardTitle, { textAlign: "center" }]}>Check Your Email</Text>
            <Text style={[styles.cardSub, { textAlign: "center" }]}>
              If an account exists for{" "}
              <Text style={{ color: palette.foreground, fontWeight: "600" }}>{email}</Text>, password
              reset instructions have been sent.
            </Text>

            {resetToken && (
              <Pressable
                onPress={() => navigation.navigate("ResetPassword", { token: resetToken })}
                style={styles.devCallout}
              >
                <Text style={styles.devLabel}>Development Mode — Reset Link:</Text>
                <Text style={styles.devLink}>Tap here to reset password</Text>
              </Pressable>
            )}

            <Pressable onPress={() => navigation.navigate("SignIn")} style={styles.backRow}>
              <ArrowLeft size={14} color={palette.mutedForeground} />
              <Text style={styles.smallMuted}>Back to Sign In</Text>
            </Pressable>
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
  smallMuted: { ...typography.small, color: c.mutedForeground },
  backRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs, marginTop: spacing.xs },
  devCallout: {
    width: "100%",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border,
    padding: spacing.md,
    backgroundColor: c.surface,
  },
  devLabel: { ...typography.caption, color: c.mutedForeground, marginBottom: spacing.xs },
  devLink: { ...typography.body, color: c.crisisRescue, fontWeight: "600" },
});
