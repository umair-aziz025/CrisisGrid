import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ShieldCheck } from "lucide-react-native";

import { Screen } from "@/components/ui/Screen";
import { Brand } from "@/components/ui/Brand";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/api/client";
import { radius, spacing, typography, ColorPalette } from "@/theme";
import { useStyles, useTheme } from "@/theme/ThemeProvider";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

export default function AdminLoginScreen({ navigation }: NativeStackScreenProps<any>) {
  const { palette } = useTheme();
  const styles = useStyles((c) => makeStyles(c));
  const toast = useToast();
  const { signIn } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.email.trim()) e.email = "Email is required";
    if (!form.password) e.password = "Password is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      const result = await api.login({ email: form.email.trim(), password: form.password });
      if (result.user.role !== "ADMIN") {
        toast.error("Access denied. Admin credentials required.");
        return;
      }
      await signIn(result.token, result.user);
      toast.success("Welcome to Command Center");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Login failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const update = (field: "email" | "password", value: string) => {
    setForm((p) => ({ ...p, [field]: value }));
    if (errors[field]) setErrors((p) => ({ ...p, [field]: "" }));
  };

  return (
    <Screen contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }} keyboardOffset={20}>
      <View style={{ alignItems: "center", marginBottom: spacing.xl }}>
        <Brand size="lg" subtitle="Organization & NGO Administration Portal" />
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.iconBubble}>
            <ShieldCheck size={20} color={palette.destructive} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Admin Access</Text>
            <Text style={styles.cardSub}>Authorized personnel only</Text>
          </View>
        </View>

        <View style={{ gap: spacing.lg, marginTop: spacing.md }}>
          <Input
            label="Admin Email"
            value={form.email}
            onChangeText={(v) => update("email", v)}
            placeholder="admin@organization.org"
            keyboardType="email-address"
            error={errors.email}
            inputSize="lg"
          />

          <Input
            label="Password"
            value={form.password}
            onChangeText={(v) => update("password", v)}
            placeholder="Enter admin password"
            secure
            error={errors.password}
            inputSize="lg"
          />

          <Button
            title="Access Command Center"
            size="lg"
            variant="destructive"
            loading={isSubmitting}
            onPress={handleSubmit}
          />

          <Pressable onPress={() => navigation.navigate("SignIn")} style={{ alignSelf: "center" }}>
            <Text style={styles.smallMuted}>Regular User Login</Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

const makeStyles = (c: ColorPalette) =>
  StyleSheet.create({
  card: {
    backgroundColor: c.surfaceGlass,
    borderColor: "rgba(242, 59, 59, 0.30)",
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
    backgroundColor: "rgba(242, 59, 59, 0.18)",
    alignItems: "center", justifyContent: "center",
  },
  cardTitle: { ...typography.h3, color: c.foreground },
  cardSub: { ...typography.small, color: c.mutedForeground },
  smallMuted: { ...typography.small, color: c.mutedForeground },
});
