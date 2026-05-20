import React, { useCallback, useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react-native";

import { Screen } from "@/components/ui/Screen";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/Toast";
import { api } from "@/api/client";
import { radius, spacing, typography, ColorPalette } from "@/theme";
import { useStyles, useTheme } from "@/theme/ThemeProvider";
import { useFocusEffect, useNavigation } from "@react-navigation/native";

type Status = { twoFactorEnabled: boolean; backupCodesRemaining: number };

export default function TwoFactorSettingsScreen() {
  const { palette } = useTheme();
  const styles = useStyles((c) => makeStyles(c));
  const toast = useToast();
  const navigation = useNavigation<any>();
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);

  const [disablePassword, setDisablePassword] = useState("");
  const [disableModalOpen, setDisableModalOpen] = useState(false);
  const [disabling, setDisabling] = useState(false);

  const [regenCode, setRegenCode] = useState("");
  const [regenModalOpen, setRegenModalOpen] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const [shownCodes, setShownCodes] = useState<string[] | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.get2FAStatus();
      setStatus(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load 2FA status");
    }
  }, [toast]);

  useEffect(() => {
    (async () => {
      await load();
      setLoading(false);
    })();
  }, [load]);

  // Re-fetch status when navigating back from the setup screen so the UI
  // immediately reflects the newly enabled state.
  useFocusEffect(
    useCallback(() => {
      if (!loading) load();
    }, [load, loading]),
  );

  const handleDisable = async () => {
    if (!disablePassword) {
      toast.error("Enter your password to disable 2FA");
      return;
    }
    setDisabling(true);
    try {
      await api.disable2FA(disablePassword);
      toast.success("Two-factor authentication disabled");
      setDisableModalOpen(false);
      setDisablePassword("");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to disable 2FA");
    } finally {
      setDisabling(false);
    }
  };

  const handleRegenerate = async () => {
    if (regenCode.length !== 6) {
      toast.error("Enter a 6-digit code from your authenticator app");
      return;
    }
    setRegenerating(true);
    try {
      const res = await api.regenerateBackupCodes(regenCode);
      setShownCodes(res.backupCodes || []);
      setRegenModalOpen(false);
      setRegenCode("");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to regenerate codes");
    } finally {
      setRegenerating(false);
    }
  };

  const copyCodes = async () => {
    if (!shownCodes) return;
    await Clipboard.setStringAsync(shownCodes.join("\n"));
    toast.success("Backup codes copied");
  };

  if (loading) return <Spinner fullscreen />;

  const enabled = status?.twoFactorEnabled === true;

  return (
    <Screen>
      <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={10}>
        <ArrowLeft size={16} color={palette.mutedForeground} />
        <Text style={styles.muted}>Back</Text>
      </Pressable>

      <Card>
        <CardContent>
          <View style={styles.cardHeader}>
            <View
              style={[
                styles.iconBubble,
                {
                  backgroundColor: enabled
                    ? "rgba(49, 168, 101, 0.18)"
                    : "rgba(245, 158, 11, 0.18)",
                },
              ]}
            >
              {enabled ? (
                <ShieldCheck size={20} color={palette.statusClaimed} />
              ) : (
                <ShieldAlert size={20} color={palette.warning} />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.h2}>Two-Factor Authentication</Text>
              <Text style={styles.muted}>
                Add a second factor to keep your account safe.
              </Text>
            </View>
            <Badge
              label={enabled ? "Enabled" : "Off"}
              color={enabled ? palette.statusClaimed : palette.warning}
            />
          </View>

          {enabled ? (
            <View style={{ gap: spacing.md, marginTop: spacing.md }}>
              <View style={styles.factRow}>
                <CheckCircle2 size={14} color={palette.statusClaimed} />
                <Text style={styles.fact}>
                  Backup codes remaining: {status?.backupCodesRemaining ?? 0}
                </Text>
              </View>

              <Button
                title="Regenerate Backup Codes"
                variant="outline"
                onPress={() => setRegenModalOpen(true)}
                leftIcon={<RefreshCw size={16} color={palette.foreground} />}
              />
              <Button
                title="Disable Two-Factor"
                variant="destructive"
                onPress={() => setDisableModalOpen(true)}
              />
            </View>
          ) : (
            <View style={{ gap: spacing.md, marginTop: spacing.md }}>
              <Text style={styles.muted}>
                You'll scan a QR code with an authenticator app (Google Authenticator,
                1Password, Authy) and verify a 6-digit code.
              </Text>
              <Button
                title="Set Up Two-Factor"
                onPress={() => navigation.navigate("TwoFactorSetup")}
                leftIcon={<ShieldCheck size={16} color="#03121C" />}
              />
            </View>
          )}
        </CardContent>
      </Card>

      <Modal
        visible={disableModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setDisableModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.h2}>Disable 2FA</Text>
            <Text style={styles.muted}>
              Confirm your password to turn off two-factor authentication.
            </Text>
            <Input
              label="Password"
              value={disablePassword}
              onChangeText={setDisablePassword}
              secure
              inputSize="lg"
            />
            <View style={styles.actionRow}>
              <Button
                title="Cancel"
                variant="outline"
                fullWidth={false}
                onPress={() => {
                  setDisableModalOpen(false);
                  setDisablePassword("");
                }}
              />
              <Button
                title="Disable"
                variant="destructive"
                fullWidth={false}
                loading={disabling}
                onPress={handleDisable}
              />
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={regenModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setRegenModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.h2}>Regenerate Codes</Text>
            <Text style={styles.muted}>
              Enter the current 6-digit code from your authenticator app to issue a fresh batch
              of backup codes. Existing codes will be invalidated.
            </Text>
            <Input
              label="Authenticator Code"
              value={regenCode}
              onChangeText={(v) => setRegenCode(v.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              keyboardType="number-pad"
              maxLength={6}
              inputSize="lg"
              style={styles.codeInput}
            />
            <View style={styles.actionRow}>
              <Button
                title="Cancel"
                variant="outline"
                fullWidth={false}
                onPress={() => {
                  setRegenModalOpen(false);
                  setRegenCode("");
                }}
              />
              <Button
                title="Regenerate"
                fullWidth={false}
                loading={regenerating}
                onPress={handleRegenerate}
              />
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!shownCodes}
        transparent
        animationType="fade"
        onRequestClose={() => setShownCodes(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.h2}>New Backup Codes</Text>
            <Text style={styles.muted}>
              Store these somewhere safe. Each code can only be used once.
            </Text>
            <View style={styles.codeGrid}>
              {(shownCodes || []).map((c) => (
                <Text key={c} style={styles.codeChip}>
                  {c}
                </Text>
              ))}
            </View>
            <Button
              title="Copy All"
              variant="outline"
              onPress={copyCodes}
              leftIcon={<Copy size={16} color={palette.foreground} />}
            />
            <Button title="Done" onPress={() => setShownCodes(null)} />
          </View>
        </View>
      </Modal>
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
    alignItems: "center", justifyContent: "center",
  },
  h2: { ...typography.h2, color: c.foreground },
  muted: { ...typography.small, color: c.mutedForeground, marginTop: 2 },
  factRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  fact: { ...typography.small, color: c.foreground },

  modalBackdrop: {
    flex: 1, backgroundColor: c.overlay,
    alignItems: "center", justifyContent: "center", padding: spacing.lg,
  },
  modalCard: {
    width: "100%", maxWidth: 400,
    backgroundColor: c.surfaceElevated,
    borderRadius: radius.xl, padding: spacing.xl, gap: spacing.md,
    borderWidth: 1, borderColor: c.surfaceGlassBorder,
  },
  actionRow: { flexDirection: "row", gap: spacing.sm, justifyContent: "flex-end" },
  codeInput: { textAlign: "center", letterSpacing: 8, fontSize: 22, fontWeight: "600" },
  codeGrid: {
    flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, justifyContent: "center",
    paddingVertical: spacing.sm,
  },
  codeChip: {
    ...typography.body,
    fontFamily: "monospace",
    color: c.foreground,
    backgroundColor: c.surface,
    borderColor: c.border, borderWidth: 1,
    paddingHorizontal: spacing.md, paddingVertical: 6,
    borderRadius: radius.md,
    letterSpacing: 1.5,
  },
});
