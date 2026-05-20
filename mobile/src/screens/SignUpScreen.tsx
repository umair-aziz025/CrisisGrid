import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { UserPlus } from "lucide-react-native";

import { Screen } from "@/components/ui/Screen";
import { Brand } from "@/components/ui/Brand";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/api/client";
import { radius, spacing, typography, ColorPalette } from "@/theme";
import { useStyles, useTheme } from "@/theme/ThemeProvider";
import type { AuthStackProps } from "@/navigation/types";

type Field = "fullName" | "email" | "password" | "confirmPassword" | "phone" | "address";

export default function SignUpScreen({ navigation }: AuthStackProps<"SignUp">) {
  const { palette } = useTheme();
  const styles = useStyles((c) => makeStyles(c));
  const toast = useToast();
  const { signIn } = useAuth();

  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    phone: "",
    address: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validate = () => {
    const e: Record<string, string> = {};

    if (!form.fullName.trim()) e.fullName = "Full name is required";
    else if (!/^[a-zA-Z\s]+$/.test(form.fullName.trim()))
      e.fullName = "Name must contain letters only — no numbers or symbols";
    else if (form.fullName.trim().length < 2) e.fullName = "Name must be at least 2 characters";

    if (!form.email.trim()) e.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      e.email = "Enter a valid email address";

    if (!form.address.trim()) {
      e.address = "Address is required";
    } else {
      const hasLetter = /[a-zA-Z]/.test(form.address);
      const hasNumber = /[0-9]/.test(form.address);
      if (!hasNumber) e.address = "Address must include a street number (e.g. 123 Main St)";
      else if (!hasLetter) e.address = "Address must include both letters and numbers";
    }

    if (!form.password) e.password = "Password is required";
    else if (form.password.length < 6) e.password = "Password must be at least 6 characters";

    if (form.password && form.password !== form.confirmPassword)
      e.confirmPassword = "Passwords do not match";

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      const result = await api.register({
        email: form.email.trim(),
        password: form.password,
        name: form.fullName.trim(),
        role: "VICTIM",
        phone: form.phone.trim() || undefined,
        address: form.address.trim() || undefined,
      });
      await signIn(result.token, result.user);
      toast.success(`Account created! Your ID: ${result.user.publicId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Registration failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const update = (field: Field, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  return (
    <Screen contentContainerStyle={{ paddingBottom: spacing["2xl"] }} keyboardOffset={20}>
      <View style={{ alignItems: "center", marginBottom: spacing.xl }}>
        <Brand size="lg" subtitle="Create your account to get started" />
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.iconBubble}>
            <UserPlus size={20} color={palette.crisisRescue} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Create Account</Text>
            <Text style={styles.cardSub}>Join the emergency response network</Text>
          </View>
        </View>

        <View style={{ gap: spacing.lg }}>
          <Input
            label="Full Name *"
            value={form.fullName}
            onChangeText={(v) => update("fullName", v)}
            placeholder="Jane Doe"
            error={errors.fullName}
            hint={errors.fullName ? undefined : "Letters only — no numbers or symbols"}
            autoCapitalize="words"
            inputSize="lg"
          />

          <Input
            label="Email Address *"
            value={form.email}
            onChangeText={(v) => update("email", v)}
            placeholder="you@example.com"
            keyboardType="email-address"
            error={errors.email}
            inputSize="lg"
          />

          <Input
            label="Phone Number"
            value={form.phone}
            onChangeText={(v) => update("phone", v)}
            placeholder="+1 234 567 8900"
            keyboardType="phone-pad"
            inputSize="lg"
          />

          <Input
            label="Address *"
            value={form.address}
            onChangeText={(v) => update("address", v)}
            placeholder="123 Main St, City"
            autoCapitalize="words"
            error={errors.address}
            hint={errors.address ? undefined : "Must include a street number"}
            inputSize="lg"
          />

          <Input
            label="Password *"
            value={form.password}
            onChangeText={(v) => update("password", v)}
            placeholder="Min 6 characters"
            secure
            error={errors.password}
            inputSize="lg"
          />

          <Input
            label="Confirm Password *"
            value={form.confirmPassword}
            onChangeText={(v) => update("confirmPassword", v)}
            placeholder="Re-enter password"
            secure
            error={errors.confirmPassword}
            inputSize="lg"
          />

          <Button
            title="Create Account"
            size="lg"
            loading={isSubmitting}
            disabled={isSubmitting}
            onPress={handleSubmit}
          />

          <View style={styles.signinPrompt}>
            <Text style={styles.smallMuted}>Already have an account?</Text>
            <Pressable onPress={() => navigation.navigate("SignIn")} hitSlop={8}>
              <Text style={styles.linkPrimary}>Sign In</Text>
            </Pressable>
          </View>
        </View>
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
    gap: spacing.lg,
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
  smallMuted: { ...typography.small, color: c.mutedForeground },
  linkPrimary: { ...typography.small, color: c.crisisRescue, fontWeight: "700" },
  signinPrompt: { flexDirection: "row", justifyContent: "center", gap: spacing.xs },
});
