import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import {
  ArrowLeft,
  Building2,
  Mail,
  MessageSquare,
  Phone,
  Send,
  User,
} from "lucide-react-native";

import { Screen } from "@/components/ui/Screen";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { useToast } from "@/components/Toast";
import { api } from "@/api/client";
import { radius, spacing, typography, ColorPalette } from "@/theme";
import { useStyles, useTheme } from "@/theme/ThemeProvider";
import type { AuthStackProps } from "@/navigation/types";

export default function ContactScreen({ navigation }: AuthStackProps<"Contact">) {
  const { palette } = useTheme();
  const styles = useStyles((c) => makeStyles(c));
  const toast = useToast();
  const [form, setForm] = useState({
    orgName: "",
    contactName: "",
    email: "",
    phone: "",
    message: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.orgName.trim()) e.orgName = "Organization name is required";
    if (!form.contactName.trim()) e.contactName = "Contact name is required";
    if (!form.email.trim()) e.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      e.email = "Please enter a valid email address";
    if (!form.message.trim()) e.message = "Message is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      await api.submitContact({
        orgName: form.orgName.trim(),
        contactName: form.contactName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        message: form.message.trim(),
      });
      setSubmitted(true);
      toast.success("Your message has been sent successfully");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send message");
    } finally {
      setIsSubmitting(false);
    }
  };

  const update = (field: keyof typeof form, value: string) => {
    setForm((p) => ({ ...p, [field]: value }));
    if (errors[field]) setErrors((p) => {
      const next = { ...p };
      delete next[field];
      return next;
    });
  };

  if (submitted) {
    return (
      <Screen contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}>
        <Card>
          <CardContent>
            <View style={{ alignItems: "center", gap: spacing.md, paddingVertical: spacing.lg }}>
              <View style={styles.successBubble}>
                <Send size={26} color={palette.statusClaimed} />
              </View>
              <Text style={styles.successTitle}>Message Sent</Text>
              <Text style={{ color: palette.mutedForeground, textAlign: "center" }}>
                Thank you for reaching out. Our team will review your submission and get back to you shortly.
              </Text>
              <Button
                title="Back to Home"
                variant="outline"
                fullWidth={false}
                onPress={() => navigation.goBack()}
                leftIcon={<ArrowLeft size={16} color={palette.foreground} />}
              />
            </View>
          </CardContent>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen keyboardOffset={20}>
      <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={10}>
        <ArrowLeft size={16} color={palette.mutedForeground} />
        <Text style={styles.smallMuted}>Back</Text>
      </Pressable>

      <Card>
        <CardHeader>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
            <View style={styles.iconBubble}>
              <MessageSquare size={20} color={palette.crisisRescue} />
            </View>
            <View style={{ flex: 1 }}>
              <CardTitle>Contact Us</CardTitle>
              <CardDescription>
                Interested in partnering with CrisisGrid? Send us a message.
              </CardDescription>
            </View>
          </View>
        </CardHeader>

        <CardContent>
          <Input
            label="Organization Name"
            value={form.orgName}
            onChangeText={(v) => update("orgName", v)}
            placeholder="Your organization"
            error={errors.orgName}
            leftIcon={<Building2 size={16} color={palette.mutedForeground} />}
            inputSize="lg"
          />
          <Input
            label="Contact Name"
            value={form.contactName}
            onChangeText={(v) => update("contactName", v)}
            placeholder="Your full name"
            error={errors.contactName}
            leftIcon={<User size={16} color={palette.mutedForeground} />}
            autoCapitalize="words"
            inputSize="lg"
          />
          <Input
            label="Email Address"
            value={form.email}
            onChangeText={(v) => update("email", v)}
            placeholder="you@organization.com"
            keyboardType="email-address"
            error={errors.email}
            leftIcon={<Mail size={16} color={palette.mutedForeground} />}
            inputSize="lg"
          />
          <Input
            label="Phone Number"
            value={form.phone}
            onChangeText={(v) => update("phone", v)}
            placeholder="+1 (555) 000-0000"
            keyboardType="phone-pad"
            leftIcon={<Phone size={16} color={palette.mutedForeground} />}
            hint="Optional"
            inputSize="lg"
          />

          <View>
            <Text style={styles.label}>Message</Text>
            <TextInput
              value={form.message}
              onChangeText={(v) => update("message", v)}
              placeholder="Tell us about your organization and how you'd like to work with CrisisGrid..."
              placeholderTextColor={palette.mutedForeground}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              style={[
                styles.textarea,
                errors.message ? { borderColor: palette.destructive } : undefined,
              ]}
            />
            {errors.message ? <Text style={styles.error}>{errors.message}</Text> : null}
          </View>

          <Button
            title="Send Message"
            size="lg"
            loading={isSubmitting}
            onPress={handleSubmit}
            leftIcon={<Send size={16} color="#03121C" />}
          />
        </CardContent>
      </Card>
    </Screen>
  );
}

const makeStyles = (c: ColorPalette) =>
  StyleSheet.create({
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: spacing.md,
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
  smallMuted: { ...typography.small, color: c.mutedForeground },
  label: {
    ...typography.small,
    color: c.foreground,
    fontWeight: "600",
    marginBottom: spacing.xs,
  },
  textarea: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: c.input,
    borderRadius: radius.md,
    padding: spacing.md,
    color: c.foreground,
    backgroundColor: c.surface,
    fontSize: 15,
  },
  error: { ...typography.small, color: c.destructive, marginTop: spacing.xs },
  successTitle: { ...typography.h2, color: c.foreground, textAlign: "center" },
});
