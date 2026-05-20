import React from "react";
import { Modal, StyleSheet, Text, View } from "react-native";
import { Clock, LogOut, RefreshCw } from "lucide-react-native";

import { Button } from "@/components/ui/Button";
import { radius, spacing, typography, ColorPalette } from "@/theme";
import { useStyles, useTheme } from "@/theme/ThemeProvider";

type Props = {
  open: boolean;
  secondsLeft: number;
  onExtend: () => void;
  onSignOut: () => void;
};

export function SessionTimeoutModal({ open, secondsLeft, onExtend, onSignOut }: Props) {
  const { palette } = useTheme();
  const styles = useStyles((c) => makeStyles(c));
  const accent = secondsLeft <= 10 ? palette.destructive : palette.warning;

  return (
    <Modal visible={open} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.modal}>
          <View style={[styles.iconWrap, { borderColor: `${accent}50` }]}>
            <Clock size={26} color={accent} />
          </View>
          <Text style={styles.title}>Session Expiring Soon</Text>
          <Text style={styles.body}>
            Your session has been idle. For security, you'll be signed out automatically.
          </Text>

          <View style={styles.counter}>
            <Text style={[styles.counterValue, { color: accent }]}>{secondsLeft}</Text>
            <Text style={styles.counterLabel}>seconds remaining</Text>
          </View>

          <Button
            title="Stay Signed In"
            onPress={onExtend}
            leftIcon={<RefreshCw size={16} color="#03121C" />}
            style={{ marginBottom: spacing.sm }}
          />
          <Button
            title="Sign Out Now"
            variant="destructive"
            onPress={onSignOut}
            leftIcon={<LogOut size={16} color="#fff" />}
          />
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (c: ColorPalette) =>
  StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: c.overlay,
    alignItems: "center", justifyContent: "center",
    padding: spacing.lg,
  },
  modal: {
    width: "100%", maxWidth: 380,
    backgroundColor: c.surfaceElevated,
    borderRadius: radius.xl, padding: spacing.xl,
    borderWidth: 1, borderColor: c.surfaceGlassBorder,
    alignItems: "center", gap: spacing.md,
  },
  iconWrap: {
    width: 60, height: 60, borderRadius: radius.pill,
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    alignItems: "center", justifyContent: "center",
    borderWidth: 2,
  },
  title: { ...typography.h2, color: c.foreground, textAlign: "center" },
  body: { ...typography.small, color: c.mutedForeground, textAlign: "center" },
  counter: { alignItems: "center", marginVertical: spacing.md },
  counterValue: { fontSize: 48, fontWeight: "800" },
  counterLabel: { ...typography.caption, color: c.mutedForeground, textTransform: "none" },
});
