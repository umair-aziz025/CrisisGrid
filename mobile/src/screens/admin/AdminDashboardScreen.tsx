import React, { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, Text, View } from "react-native";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  FileText,
  Lock,
  LogOut,
  MapPin,
  Moon,
  Radio,
  ShieldAlert,
  Sun,
  Users,
} from "lucide-react-native";

import { Screen } from "@/components/ui/Screen";
import { Card, CardContent } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/api/client";
import { radius, spacing, typography } from "@/theme";
import { useStyles, useTheme } from "@/theme/ThemeProvider";
import { useNavigation } from "@react-navigation/native";

type AdminStats = {
  totalUsers: number;
  totalVolunteers: number;
  totalRequests: number;
  activeRequests: number;
  resolvedRequests: number;
  bannedUsers: number;
  lockedUsers: number;
};

type SecuritySummary = {
  blocked24h: number;
  blocked7d: number;
};

export default function AdminDashboardScreen() {
  const toast = useToast();
  const { user, signOut } = useAuth();
  const navigation = useNavigation<any>();
  const { palette, mode, toggleMode } = useTheme();

  const styles = useStyles((c) => ({
    headerRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: spacing.md,
      marginBottom: spacing.lg,
    },
    brandRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: spacing.sm },
    brand: { ...typography.h2, color: c.foreground },
    subtitle: { ...typography.small, color: c.mutedForeground, marginTop: 2 },
    iconBtn: {
      width: 40,
      height: 40,
      borderRadius: radius.md,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    stack: { gap: spacing.lg },

    statsGrid: {
      flexDirection: "row" as const,
      flexWrap: "wrap" as const,
      gap: spacing.md,
    },
    statTile: {
      flexBasis: "47%" as const,
      flexGrow: 1,
      backgroundColor: c.surface,
      padding: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      gap: spacing.xs,
    },
    statLabel: { ...typography.caption, color: c.mutedForeground, textTransform: "none" as const },
    statValue: { ...typography.h1, fontSize: 24 },

    h2: { ...typography.h2, color: c.foreground, marginBottom: spacing.md },
    muted: { ...typography.small, color: c.mutedForeground, marginTop: spacing.sm },

    securityRow: { flexDirection: "row" as const, gap: spacing.md },
    securityCell: {
      flex: 1,
      backgroundColor: c.surface,
      padding: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      gap: spacing.xs,
    },

    navRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: spacing.md,
      paddingVertical: spacing.sm,
    },
    navIcon: {
      width: 36,
      height: 36,
      borderRadius: radius.md,
      backgroundColor: "rgba(43, 179, 242, 0.15)",
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    navLabel: { ...typography.h3, color: c.foreground, flex: 1, fontSize: 15 },
  }));

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [security, setSecurity] = useState<SecuritySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [statsData, secData] = await Promise.all([
        api.adminGetStats().catch(() => null),
        api.adminGetSecuritySummary().catch(() => null),
      ]);
      setStats(statsData);
      setSecurity(secData);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load admin data");
    }
  }, [toast]);

  useEffect(() => {
    (async () => {
      await load();
      setLoading(false);
    })();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (loading) return <Spinner fullscreen />;

  return (
    <Screen
      scrollProps={{
        refreshControl: (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={palette.crisisRescue}
          />
        ),
      }}
    >
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <View style={styles.brandRow}>
            <Radio size={16} color={palette.destructive} />
            <Text style={styles.brand}>Command Center</Text>
            <Badge
              label={(user?.role || "ADMIN").toUpperCase()}
              color={
                (user?.role || "").toUpperCase() === "STAFF"
                  ? palette.warning
                  : (user?.role || "").toUpperCase() === "SUPERADMIN"
                  ? "#a855f7"
                  : palette.destructive
              }
            />
          </View>
          <Text style={styles.subtitle}>Signed in as {user?.email}</Text>
        </View>
        <Pressable onPress={toggleMode} hitSlop={10} style={styles.iconBtn}>
          {mode === "light" ? (
            <Moon size={18} color={palette.mutedForeground} />
          ) : (
            <Sun size={18} color={palette.mutedForeground} />
          )}
        </Pressable>
        <Pressable onPress={signOut} hitSlop={10} style={styles.iconBtn}>
          <LogOut size={18} color={palette.mutedForeground} />
        </Pressable>
      </View>

      <View style={styles.stack}>
        <View style={styles.statsGrid}>
          <StatTile
            label="Total Users"
            value={stats?.totalUsers ?? 0}
            icon={<Users size={18} color={palette.crisisRescue} />}
            accent={palette.crisisRescue}
            styles={styles}
          />
          <StatTile
            label="Volunteers"
            value={stats?.totalVolunteers ?? 0}
            icon={<CheckCircle2 size={18} color={palette.statusClaimed} />}
            accent={palette.statusClaimed}
            styles={styles}
          />
          <StatTile
            label="Active Crises"
            value={stats?.activeRequests ?? 0}
            icon={<AlertTriangle size={18} color={palette.destructive} />}
            accent={palette.destructive}
            styles={styles}
          />
          <StatTile
            label="Resolved"
            value={stats?.resolvedRequests ?? 0}
            icon={<FileText size={18} color={palette.crisisFoodWater} />}
            accent={palette.crisisFoodWater}
            styles={styles}
          />
          <StatTile
            label="Banned"
            value={stats?.bannedUsers ?? 0}
            icon={<ShieldAlert size={18} color={palette.destructive} />}
            accent={palette.destructive}
            styles={styles}
          />
          <StatTile
            label="Locked"
            value={stats?.lockedUsers ?? 0}
            icon={<Lock size={18} color={palette.mutedForeground} />}
            accent={palette.mutedForeground}
            styles={styles}
          />
        </View>

        <Card>
          <CardContent>
            <Text style={styles.h2}>Security Pulse</Text>
            <View style={styles.securityRow}>
              <SecurityCell
                label="Blocked (24h)"
                value={security?.blocked24h ?? 0}
                accent={palette.destructive}
                styles={styles}
              />
              <SecurityCell
                label="Blocked (7d)"
                value={security?.blocked7d ?? 0}
                accent={palette.warning}
                styles={styles}
              />
            </View>
            <Text style={styles.muted}>
              Auto-blocks include rate-limit violations, repeated failed logins, and suspicious
              geolocation mismatches. Drill into Activity Logs for the full audit trail.
            </Text>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Text style={styles.h2}>Console</Text>
            <NavRow
              label="User Management"
              icon={<Users size={18} color={palette.crisisRescue} />}
              onPress={() => navigation.navigate("AdminUsers")}
              styles={styles}
              palette={palette}
            />
            <NavRow
              label="Crisis Requests"
              icon={<AlertTriangle size={18} color={palette.crisisMedical} />}
              onPress={() => navigation.navigate("AdminRequests")}
              styles={styles}
              palette={palette}
            />
            <NavRow
              label="Activity Logs"
              icon={<FileText size={18} color={palette.statusClaimed} />}
              onPress={() => navigation.navigate("AdminLogs")}
              styles={styles}
              palette={palette}
            />
            <NavRow
              label="Safe Zones"
              icon={<MapPin size={18} color={palette.crisisFoodWater} />}
              onPress={() => navigation.navigate("SafeZones")}
              styles={styles}
              palette={palette}
            />
            <NavRow
              label="Open User Dashboard"
              icon={<MapPin size={18} color={palette.crisisRescue} />}
              onPress={() => navigation.navigate("UserView")}
              styles={styles}
              palette={palette}
            />
          </CardContent>
        </Card>

        <View style={{ marginTop: spacing.md }}>
          <Button
            title="Sign Out"
            variant="outline"
            onPress={signOut}
            leftIcon={<LogOut size={16} color={palette.foreground} />}
          />
        </View>
      </View>
    </Screen>
  );
}

function NavRow({
  label,
  icon,
  onPress,
  styles,
  palette,
}: {
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
  styles: any;
  palette: any;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.navRow, pressed && { opacity: 0.7 }]}
    >
      <View style={styles.navIcon}>{icon}</View>
      <Text style={styles.navLabel}>{label}</Text>
      <ChevronRight size={18} color={palette.mutedForeground} />
    </Pressable>
  );
}

function StatTile({
  label,
  value,
  icon,
  accent,
  styles,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  accent: string;
  styles: any;
}) {
  return (
    <View style={[styles.statTile, { borderColor: `${accent}40` }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
        {icon}
        <Text style={styles.statLabel}>{label}</Text>
      </View>
      <Text style={[styles.statValue, { color: accent }]}>{value}</Text>
    </View>
  );
}

function SecurityCell({
  label,
  value,
  accent,
  styles,
}: {
  label: string;
  value: number;
  accent: string;
  styles: any;
}) {
  return (
    <View style={[styles.securityCell, { borderColor: `${accent}40` }]}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color: accent }]}>{value}</Text>
    </View>
  );
}
