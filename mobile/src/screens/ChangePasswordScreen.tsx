import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ArrowLeft, KeyRound } from "lucide-react-native";

import { Screen } from "@/components/ui/Screen";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/Toast";
import { api } from "@/api/client";
import { radius, spacing, typography, ColorPalette } from "@/theme";
import { useStyles, useTheme } from "@/theme/ThemeProvider";
import { useNavigation } from "@react-navigation/native";

export default function ChangePasswordScreen() {
  const { palette } = useTheme();
  const styles = useStyles((c) => makeStyles(c));
  const toast = useToast();
  const navigation = useNavigation<any>();

  const [form, setForm] = useState({
    current: "",
    next: "",
    confirm: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.current) e.current = "Current password is required";
    if (!form.next) e.next = "New password is required";
    else if (form.next.length < 6) e.next = "Password must be at least 6 characters";
    if (form.next && form.next !== form.confirm)
      e.confirm = "Passwords do not match";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      await api.changePassword(form.current, form.next);
      toast.success("Password updated");
      navigation.goBack();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to change password");
    } finally {
      setIsSubmitting(false);
    }
  };

  const update = (field: keyof typeof form, value: string) => {
    setForm((p) => ({ ...p, [field]: value }));
    if (errors[field]) setErrors((p) => ({ ...p, [field]: "" }));
  };

  return (
    <Screen keyboardOffset={20}>
      <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={10}>
        <ArrowLeft size={16} color={palette.mutedForeground} />
        <Text style={styles.muted}>Back</Text>
      </Pressable>

      <Card>
        <CardContent>
          <View style={styles.cardHeader}>
            <View style={styles.iconBubble}>
              <KeyRound size={20} color={palette.crisisRescue} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.h2}>Change Password</Text>
              <Text style={styles.muted}>Use a strong password you don't reuse elsewhere</Text>
            </View>
          </View>

          <View style={{ gap: spacing.lg, marginTop: spacing.md }}>
            <Input
              label="Current Password"
              value={form.current}
              onChangeText={(v) => update("current", v)}
              secure
              error={errors.current}
              inputSize="lg"
            />
            <Input
              label="New Password"
              value={form.next}
              onChangeText={(v) => update("next", v)}
              placeholder="Min 6 characters"
              secure
              error={errors.next}
              inputSize="lg"
            />
            <Input
              label="Confirm New Password"
              value={form.confirm}
              onChangeText={(v) => update("confirm", v)}
              secure
              error={errors.confirm}
              inputSize="lg"
            />
            <Button
              title="Update Password"
              size="lg"
              loading={isSubmitting}
              onPress={submit}
            />
          </View>
        </CardContent>
      </Card>
    </Screen>
  );
}

const makeStyles = (c: ColorPalette) =>
  StyleSheet.create({
  backBtn: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginBottom: spacing.md },
  cardHeader: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    paddingBottom: spacing.md,
    borderBottomColor: c.border, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconBubble: {
    width: 40, height: 40, borderRadius: radius.md,
    backgroundColor: "rgba(43, 179, 242, 0.18)",
    alignItems: "center", justifyContent: "center",
  },
  h2: { ...typography.h2, color: c.foreground },
  muted: { ...typography.small, color: c.mutedForeground, marginTop: 2 },
});
