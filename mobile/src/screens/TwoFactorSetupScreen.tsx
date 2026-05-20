import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { ArrowLeft, Copy, ShieldCheck } from "lucide-react-native";

import { Screen } from "@/components/ui/Screen";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/Toast";
import { api } from "@/api/client";
import { radius, spacing, typography, ColorPalette } from "@/theme";
import { useStyles, useTheme } from "@/theme/ThemeProvider";
import { useNavigation } from "@react-navigation/native";

type SetupPayload = { secret: string; qrCodeDataUrl: string };

export default function TwoFactorSetupScreen() {
  const { palette } = useTheme();
  
  const styleFactory = useCallback((c: ColorPalette) => makeStyles(c), []);
  const styles = useStyles(styleFactory);
  
  const toast = useToast();
  const navigation = useNavigation<any>();

  const [setup, setSetup] = useState<SetupPayload | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [enabling, setEnabling] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [setupStartTime, setSetupStartTime] = useState<number | null>(null);
  const [tick, setTick] = useState(0);

  const [hasStartedSetup, setHasStartedSetup] = useState(false);

  useEffect(() => {
    if (hasStartedSetup) return;
    setHasStartedSetup(true);

    (async () => {
      try {
        const data = await api.setup2FA();
        setSetup(data);
        setSetupStartTime(Date.now());
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to start 2FA setup");
      } finally {
        setLoading(false);
      }
    })();
  }, [hasStartedSetup]);

  // Timer to force re-render for expiration check
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const refreshSetup = async () => {
    setLoading(true);
    try {
      const data = await api.setup2FA();
      setSetup(data);
      setSetupStartTime(Date.now());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to refresh 2FA setup");
    } finally {
      setLoading(false);
    }
  };

  const isSetupExpired = useMemo(() => {
    if (!setupStartTime) return false;
    // 2 minutes = 120,000ms
    return Date.now() - setupStartTime > 120000;
  }, [setupStartTime, setup, tick]); 

  const expirationRemaining = useMemo(() => {
    if (!setupStartTime) return 0;
    return Math.max(0, Math.floor((120000 - (Date.now() - setupStartTime)) / 1000));
  }, [setupStartTime, setup, tick]);

  const enable = async () => {
    if (code.length !== 6) {
      toast.error("Enter the 6-digit code from your authenticator app");
      return;
    }
    setEnabling(true);
    try {
      const res = await api.enable2FA(code);
      setBackupCodes(res.backupCodes || []);
      toast.success("Two-factor authentication enabled");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Invalid code");
    } finally {
      setEnabling(false);
    }
  };

  const copySecret = async () => {
    if (!setup) return;
    await Clipboard.setStringAsync(setup.secret);
    toast.success("Secret copied");
  };

  const copyCodes = async () => {
    if (!backupCodes) return;
    await Clipboard.setStringAsync(backupCodes.join("\n"));
    toast.success("Backup codes copied");
  };

  if (loading) return <Spinner fullscreen />;

  if (backupCodes) {
    return (
      <Screen>
        <Card>
          <CardContent>
            <View style={styles.successHeader}>
              <View style={styles.successBubble}>
                <ShieldCheck size={26} color={palette.statusClaimed} />
              </View>
              <Text style={styles.h2}>Save Your Backup Codes</Text>
              <Text style={styles.muted}>
                Each code can be used once if you lose access to your authenticator app.
              </Text>
            </View>

            <View style={styles.codeGrid}>
              {backupCodes.map((c) => (
                <Text key={c} style={styles.codeChip}>{c}</Text>
              ))}
            </View>

            <Button
              title="Copy All"
              variant="outline"
              onPress={copyCodes}
              leftIcon={<Copy size={16} color={palette.foreground} />}
            />
            <Button title="Done" onPress={() => navigation.goBack()} />
          </CardContent>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={10}>
        <ArrowLeft size={16} color={palette.mutedForeground} />
        <Text style={styles.muted}>Back</Text>
      </Pressable>

      <Card>
        <CardContent>
          <Text style={styles.h2}>Set Up Two-Factor</Text>
          <Text style={styles.muted}>
            Scan the QR code with your authenticator app, then enter the 6-digit code it shows.
          </Text>

          {setup?.qrCodeDataUrl ? (
            <View style={[styles.qrWrap, isSetupExpired && { opacity: 0.2 }]}>
              <Image source={{ uri: setup.qrCodeDataUrl }} style={styles.qr} resizeMode="contain" />
              {isSetupExpired && (
                <View style={StyleSheet.absoluteFillObject}>
                  <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.05)" }}>
                    <Button title="QR Expired - Refresh" size="sm" onPress={refreshSetup} />
                  </View>
                </View>
              )}
            </View>
          ) : null}

          {setup?.secret ? (
            <Pressable onPress={isSetupExpired ? refreshSetup : copySecret} style={[styles.secretRow, isSetupExpired && { opacity: 0.5 }]}>
              <Text style={styles.secretLabel}>Manual entry</Text>
              <Text style={styles.secret}>{isSetupExpired ? "••••••••" : setup.secret}</Text>
              <View style={styles.copyHint}>
                <Copy size={12} color={palette.crisisRescue} />
                <Text style={styles.copyHintText}>{isSetupExpired ? "Expired" : "Tap to copy"}</Text>
              </View>
            </Pressable>
          ) : null}

          {setupStartTime && !isSetupExpired && (
            <Text style={[styles.muted, { textAlign: "center", fontSize: 11, marginBottom: 12 }]}>
              Expires in {Math.floor(expirationRemaining / 60)}:{(expirationRemaining % 60).toString().padStart(2, "0")}
            </Text>
          )}

          <Input
            label="Verification Code"
            value={code}
            onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))}
            placeholder="000000"
            keyboardType="number-pad"
            maxLength={6}
            inputSize="lg"
            style={styles.codeInput}
            editable={!isSetupExpired}
          />

          <Button
            title="Enable Two-Factor"
            size="lg"
            loading={enabling}
            disabled={code.length !== 6 || enabling || isSetupExpired}
            onPress={enable}
            leftIcon={<ShieldCheck size={16} color="#03121C" />}
          />
        </CardContent>
      </Card>
    </Screen>
  );
}

const makeStyles = (c: ColorPalette) =>
  StyleSheet.create({
  backBtn: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginBottom: spacing.md },
  h2: { ...typography.h2, color: c.foreground },
  muted: { ...typography.small, color: c.mutedForeground, marginTop: 2, marginBottom: spacing.md },

  qrWrap: {
    alignSelf: "center", padding: spacing.md,
    backgroundColor: "#fff", borderRadius: radius.lg,
    marginVertical: spacing.md,
  },
  qr: { width: 200, height: 200 },

  secretRow: {
    backgroundColor: c.surface,
    borderRadius: radius.md, padding: spacing.md,
    borderWidth: 1, borderColor: c.border,
    gap: spacing.xs, marginBottom: spacing.lg,
  },
  secretLabel: { ...typography.caption, color: c.mutedForeground, textTransform: "uppercase" },
  secret: { ...typography.body, fontFamily: "monospace", color: c.foreground, letterSpacing: 1.5 },
  copyHint: { flexDirection: "row", alignItems: "center", gap: 4 },
  copyHintText: { ...typography.caption, color: c.crisisRescue, textTransform: "none", fontWeight: "700" },

  codeInput: { textAlign: "center", letterSpacing: 8, fontSize: 22, fontWeight: "600" },

  successHeader: { alignItems: "center", gap: spacing.sm, marginBottom: spacing.md },
  successBubble: {
    width: 60, height: 60, borderRadius: radius.pill,
    backgroundColor: "rgba(49, 168, 101, 0.18)",
    alignItems: "center", justifyContent: "center",
  },
  codeGrid: {
    flexDirection: "row", flexWrap: "wrap", gap: spacing.sm,
    justifyContent: "center", paddingVertical: spacing.md,
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
