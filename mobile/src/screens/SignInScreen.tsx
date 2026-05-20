import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LogIn, ShieldCheck, ArrowLeft } from "lucide-react-native";

import { Screen } from "@/components/ui/Screen";
import { Brand } from "@/components/ui/Brand";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/hooks/useAuth";
import { api, AuthUser } from "@/api/client";
import { radius, spacing, typography, ColorPalette } from "@/theme";
import { useStyles, useTheme } from "@/theme/ThemeProvider";
import type { AuthStackProps } from "@/navigation/types";

type Step = "credentials" | "totp";

export default function SignInScreen({ navigation }: AuthStackProps<"SignIn">) {
  const { palette } = useTheme();
  const styles = useStyles((c) => makeStyles(c));
  const toast = useToast();
  const { signIn } = useAuth();

  const [step, setStep] = useState<Step>("credentials");
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [twoFactorToken, setTwoFactorToken] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [backupCode, setBackupCode] = useState("");
  const [useBackupCode, setUseBackupCode] = useState(false);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.email.trim()) e.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      e.email = "Enter a valid email address";
    if (!form.password) e.password = "Password is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const finishLogin = async (result: { token: string; user: AuthUser }) => {
    await signIn(result.token, result.user);
    toast.success("Welcome back!");
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      const result = await api.login({ email: form.email.trim(), password: form.password });
      if (result.requiresTwoFactor) {
        setTwoFactorToken(result.twoFactorToken);
        setTotpCode("");
        setBackupCode("");
        setUseBackupCode(false);
        setStep("totp");
        return;
      }
      await finishLogin(result);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Login failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTotpSubmit = async () => {
    setIsSubmitting(true);
    try {
      let result;
      if (useBackupCode) {
        const normalized = backupCode.trim().toUpperCase();
        if (!normalized) {
          setErrors({ totp: "Enter a backup code" });
          setIsSubmitting(false);
          return;
        }
        result = await api.verify2FALogin({ twoFactorToken, backupCode: normalized });
      } else {
        const code = totpCode.replace(/\s/g, "");
        if (code.length !== 6 || !/^\d{6}$/.test(code)) {
          setErrors({ totp: "Enter a valid 6-digit code" });
          setIsSubmitting(false);
          return;
        }
        result = await api.verify2FALogin({ twoFactorToken, code });
      }
      await finishLogin(result);
    } catch (error) {
      setErrors({ totp: error instanceof Error ? error.message : "Invalid code" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateField = (field: "email" | "password", value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  return (
    <Screen contentContainerStyle={{ justifyContent: "center", flexGrow: 1 }} keyboardOffset={20}>
      <View style={styles.brandRow}>
        <Brand size="lg" subtitle="Sign in to access the coordination platform" />
      </View>

      <View style={styles.card}>
        {step === "credentials" ? (
          <View style={{ gap: spacing.lg }}>
            <View style={styles.cardHeader}>
              <View style={styles.iconBubble}>
                <LogIn size={20} color={palette.crisisRescue} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Welcome Back</Text>
                <Text style={styles.cardSub}>Enter your credentials to continue</Text>
              </View>
            </View>

            <Input
              label="Email Address"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              value={form.email}
              onChangeText={(v) => updateField("email", v)}
              placeholder="you@example.com"
              error={errors.email}
              inputSize="lg"
            />

            <View style={{ gap: spacing.xs }}>
              <View style={styles.passwordHeader}>
                <Text style={styles.smallLabel}>Password</Text>
                <Pressable onPress={() => navigation.navigate("ForgotPassword")} hitSlop={8}>
                  <Text style={styles.linkSubtle}>Forgot password?</Text>
                </Pressable>
              </View>
              <Input
                value={form.password}
                onChangeText={(v) => updateField("password", v)}
                placeholder="Enter your password"
                secure
                error={errors.password}
                inputSize="lg"
              />
            </View>

            <Button
              title="Sign In"
              size="lg"
              loading={isSubmitting}
              disabled={isSubmitting}
              onPress={handleSubmit}
            />

            <View style={styles.signupPrompt}>
              <Text style={styles.smallMuted}>Don't have an account?</Text>
              <Pressable onPress={() => navigation.navigate("SignUp")} hitSlop={8}>
                <Text style={styles.linkPrimary}>Create Account</Text>
              </Pressable>
            </View>


          </View>
        ) : (
          <View style={{ gap: spacing.lg }}>
            <View style={styles.cardHeader}>
              <View style={styles.iconBubble}>
                <ShieldCheck size={20} color={palette.crisisRescue} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Two-Factor Authentication</Text>
                <Text style={styles.cardSub}>
                  {useBackupCode
                    ? "Enter one of your saved backup codes"
                    : "Open your authenticator app and enter the 6-digit code"}
                </Text>
              </View>
            </View>

            {useBackupCode ? (
              <Input
                label="Backup Code"
                value={backupCode}
                onChangeText={(v) => {
                  setBackupCode(v.toUpperCase());
                  setErrors({});
                }}
                placeholder="XXXX-XXXX"
                error={errors.totp}
                hint="Each backup code can only be used once."
                inputSize="lg"
                style={styles.codeInput}
                autoCapitalize="characters"
              />
            ) : (
              <Input
                label="Authentication Code"
                value={totpCode}
                onChangeText={(v) => {
                  setTotpCode(v.replace(/\D/g, "").slice(0, 6));
                  setErrors({});
                }}
                placeholder="000000"
                error={errors.totp}
                hint="Code refreshes every 30 seconds"
                keyboardType="number-pad"
                maxLength={6}
                inputSize="lg"
                style={styles.codeInput}
              />
            )}

            <Button
              title="Verify & Sign In"
              size="lg"
              loading={isSubmitting}
              disabled={
                isSubmitting ||
                (!useBackupCode && totpCode.length !== 6) ||
                (useBackupCode && !backupCode.trim())
              }
              onPress={handleTotpSubmit}
            />

            <View style={{ alignItems: "center", gap: spacing.sm }}>
              <Pressable
                onPress={() => {
                  setUseBackupCode((p) => !p);
                  setErrors({});
                  setTotpCode("");
                  setBackupCode("");
                }}
              >
                <Text style={styles.smallMuted}>
                  {useBackupCode ? "Use authenticator app instead" : "Use a backup code instead"}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setStep("credentials");
                  setErrors({});
                  setTotpCode("");
                  setBackupCode("");
                  setUseBackupCode(false);
                }}
                style={styles.backRow}
              >
                <ArrowLeft size={14} color={palette.mutedForeground} />
                <Text style={styles.smallMuted}>Back to sign in</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </Screen>
  );
}

const makeStyles = (c: ColorPalette) =>
  StyleSheet.create({
  brandRow: { alignItems: "center", marginBottom: spacing.xl },
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
  cardTitle: { ...typography.h3, color: c.foreground },
  cardSub: { ...typography.small, color: c.mutedForeground },
  smallLabel: { ...typography.small, color: c.foreground, fontWeight: "600" },
  smallMuted: { ...typography.small, color: c.mutedForeground },
  linkPrimary: { ...typography.small, color: c.crisisRescue, fontWeight: "700" },
  linkSubtle: { ...typography.small, color: c.mutedForeground },
  passwordHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  signupPrompt: { flexDirection: "row", justifyContent: "center", gap: spacing.xs },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: c.border, marginVertical: spacing.xs },
  codeInput: { textAlign: "center", letterSpacing: 8, fontSize: 22, fontWeight: "600" },
  backRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.xs },
});
