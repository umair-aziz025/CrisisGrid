import React, { useCallback, useEffect, useState } from "react";
import { Modal, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import {
  ArrowLeft,
  Lock,
  LockOpen,
  RotateCcw,
  Search,
  Shield,
  UserCheck,
  UserX,
} from "lucide-react-native";

import { Screen } from "@/components/ui/Screen";
import { Card, CardContent } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/Toast";
import { api } from "@/api/client";
import { radius, spacing, typography, ColorPalette, darkColors } from "@/theme";
import { useStyles, useTheme } from "@/theme/ThemeProvider";
import { useNavigation } from "@react-navigation/native";

type UserRecord = {
  id: number;
  email: string;
  name: string;
  role: string;
  publicId: string | null;
  banned: boolean;
  lockedUntil: string | null;
  createdAt: string;
  cancelCount?: number;
};

type Tab = "all" | "VICTIM" | "VOLUNTEER" | "STAFF" | "ADMIN" | "banned" | "locked";

const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "VICTIM", label: "Civilian" },
  { key: "VOLUNTEER", label: "Volunteer" },
  { key: "STAFF", label: "Staff" },
  { key: "ADMIN", label: "Admin" },
  { key: "banned", label: "Banned" },
  { key: "locked", label: "Locked" },
];

const ROLE_OPTIONS = ["VICTIM", "VOLUNTEER", "STAFF", "ADMIN"];

const ROLE_COLOR: Record<string, string> = {
  VICTIM: darkColors.mutedForeground,
  VOLUNTEER: darkColors.crisisRescue,
  STAFF: darkColors.warning,
  ADMIN: darkColors.destructive,
  SUPERADMIN: "#a855f7",
};

export default function AdminUsersScreen() {
  const { palette } = useTheme();
  const styles = useStyles((c) => makeStyles(c));
  const toast = useToast();
  const navigation = useNavigation<any>();

  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [busyId, setBusyId] = useState<number | null>(null);

  const [editing, setEditing] = useState<UserRecord | null>(null);

  const load = useCallback(async () => {
    try {
      const params: any = { search: search || undefined, limit: 50 };
      if (tab === "banned") params.banned = true;
      else if (tab === "locked") params.locked = true;
      else if (tab !== "all") params.role = tab;
      const data = await api.adminGetUsers(params);
      setUsers(data.users || []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load users");
    }
  }, [search, tab, toast]);

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

  const toggleBan = async (u: UserRecord) => {
    setBusyId(u.id);
    try {
      await api.adminToggleBan(u.id, !u.banned);
      toast.success(u.banned ? "User unbanned" : "User banned");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusyId(null);
    }
  };

  const unlock = async (u: UserRecord) => {
    setBusyId(u.id);
    try {
      await api.adminUnlockUser(u.id);
      toast.success("Account unlocked");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusyId(null);
    }
  };

  const resetCancelCount = async (u: UserRecord) => {
    setBusyId(u.id);
    try {
      await api.adminResetCancelCount(u.id);
      toast.success("Cancel count reset");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusyId(null);
    }
  };

  const changeRole = async (u: UserRecord, newRole: string) => {
    setBusyId(u.id);
    try {
      await api.adminChangeRole(u.id, newRole);
      toast.success(`Role updated to ${newRole}`);
      setEditing(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <Spinner fullscreen />;

  return (
    <>
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
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={10}>
          <ArrowLeft size={16} color={palette.mutedForeground} />
          <Text style={styles.muted}>Back</Text>
        </Pressable>

        <Text style={styles.title}>User Management</Text>

        <Input
          placeholder="Search by name, email, or ID"
          value={search}
          onChangeText={setSearch}
          leftIcon={<Search size={16} color={palette.mutedForeground} />}
          inputSize="lg"
        />

        <View style={styles.tabsRow}>
          {TABS.map((t) => {
            const active = t.key === tab;
            return (
              <Pressable
                key={t.key}
                onPress={() => setTab(t.key)}
                style={[styles.tabChip, active && styles.tabChipActive]}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ gap: spacing.md, marginTop: spacing.md }}>
          {users.length === 0 ? (
            <Card>
              <CardContent>
                <Text style={[styles.muted, { textAlign: "center" }]}>No users match.</Text>
              </CardContent>
            </Card>
          ) : (
            users.map((u) => {
              const locked = !!u.lockedUntil && new Date(u.lockedUntil) > new Date();
              const roleColor = ROLE_COLOR[u.role] || palette.mutedForeground;
              return (
                <View key={u.id} style={styles.userRow}>
                  <View style={[styles.avatar, { backgroundColor: `${roleColor}26` }]}>
                    <Text style={[styles.avatarText, { color: roleColor }]}>
                      {(u.name || u.email)[0]?.toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.userHeader}>
                      <Text style={styles.userName} numberOfLines={1}>{u.name}</Text>
                      <Badge label={u.role} color={roleColor} variant="soft" />
                    </View>
                    <Text style={styles.userEmail} numberOfLines={1}>{u.email}</Text>
                    {u.publicId ? <Text style={styles.userId}>{u.publicId}</Text> : null}
                    <View style={styles.statusFlags}>
                      {u.banned ? <Badge label="Banned" color={palette.destructive} /> : null}
                      {locked ? <Badge label="Locked" color={palette.warning} /> : null}
                      {(u.cancelCount ?? 0) > 0 ? <Badge label={`${u.cancelCount} cancels`} color={palette.crisisFoodWater} /> : null}
                    </View>
                    <View style={styles.actionsRow}>
                      <Pressable
                        onPress={() => setEditing(u)}
                        style={styles.smallBtn}
                        disabled={busyId === u.id}
                      >
                        <Shield size={12} color={palette.foreground} />
                        <Text style={styles.smallBtnText}>Role</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => toggleBan(u)}
                        style={[styles.smallBtn, { borderColor: palette.destructive }]}
                        disabled={busyId === u.id}
                      >
                        {u.banned ? (
                          <UserCheck size={12} color={palette.statusClaimed} />
                        ) : (
                          <UserX size={12} color={palette.destructive} />
                        )}
                        <Text style={styles.smallBtnText}>{u.banned ? "Unban" : "Ban"}</Text>
                      </Pressable>
                      {locked ? (
                        <Pressable
                          onPress={() => unlock(u)}
                          style={styles.smallBtn}
                          disabled={busyId === u.id}
                        >
                          <LockOpen size={12} color={palette.statusClaimed} />
                          <Text style={styles.smallBtnText}>Unlock</Text>
                        </Pressable>
                      ) : null}
                      {(u.cancelCount ?? 0) >= 3 ? (
                        <Pressable
                          onPress={() => resetCancelCount(u)}
                          style={[styles.smallBtn, { borderColor: palette.crisisFoodWater }]}
                          disabled={busyId === u.id}
                        >
                          <RotateCcw size={12} color={palette.crisisFoodWater} />
                          <Text style={styles.smallBtnText}>Reset Cancels</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </Screen>

      <Modal
        visible={!!editing}
        transparent
        animationType="fade"
        onRequestClose={() => setEditing(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.title}>Change Role</Text>
            <Text style={styles.muted}>{editing?.name} ({editing?.email})</Text>
            <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
              {ROLE_OPTIONS.map((r) => (
                <Button
                  key={r}
                  title={r}
                  variant={editing?.role === r ? "primary" : "outline"}
                  onPress={() => editing && changeRole(editing, r)}
                />
              ))}
            </View>
            <Button title="Cancel" variant="ghost" onPress={() => setEditing(null)} />
          </View>
        </View>
      </Modal>
    </>
  );
}

const makeStyles = (c: ColorPalette) =>
  StyleSheet.create({
  backBtn: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginBottom: spacing.md },
  title: { ...typography.h1, color: c.foreground, marginBottom: spacing.md },
  muted: { ...typography.small, color: c.mutedForeground },

  tabsRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md },
  tabChip: {
    paddingHorizontal: spacing.md, paddingVertical: 6,
    borderRadius: radius.pill, borderWidth: 1, borderColor: c.border,
    backgroundColor: c.surface,
  },
  tabChipActive: { borderColor: c.crisisRescue, backgroundColor: "rgba(43, 179, 242, 0.18)" },
  tabText: { ...typography.small, color: c.mutedForeground },
  tabTextActive: { color: c.crisisRescue, fontWeight: "700" },

  userRow: {
    flexDirection: "row", gap: spacing.md, padding: spacing.lg,
    borderRadius: radius.lg, borderWidth: 1, borderColor: c.surfaceGlassBorder,
    backgroundColor: c.surfaceGlass, alignItems: "flex-start",
  },
  avatar: { width: 40, height: 40, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  avatarText: { ...typography.h3, fontWeight: "700" },
  userHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm },
  userName: { ...typography.h3, color: c.foreground, flex: 1 },
  userEmail: { ...typography.small, color: c.mutedForeground, marginTop: 2 },
  userId: { ...typography.caption, color: c.mutedForeground, textTransform: "none", marginTop: 2 },
  statusFlags: { flexDirection: "row", gap: spacing.xs, marginTop: spacing.xs, flexWrap: "wrap" },
  actionsRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm, flexWrap: "wrap" },
  smallBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: spacing.sm, paddingVertical: 4,
    borderRadius: radius.md, borderWidth: 1, borderColor: c.border,
    backgroundColor: c.surface,
  },
  smallBtnText: { ...typography.caption, color: c.foreground, textTransform: "none", fontWeight: "600" },

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
});
