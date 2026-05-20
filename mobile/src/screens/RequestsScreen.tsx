import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Lock, Search, ShieldAlert } from "lucide-react-native";

import { Screen } from "@/components/ui/Screen";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { RequestCard } from "@/components/RequestCard";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/api/client";
import { CrisisRequest, normalizeRequestList } from "@/utils/crisis";
import { ColorPalette, radius, spacing, typography } from "@/theme";
import { useStyles, useTheme } from "@/theme/ThemeProvider";

type Filter = "all" | "queued" | "active" | "claimed" | "resolved";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "queued", label: "Queued" },
  { id: "active", label: "Active" },
  { id: "claimed", label: "Claimed" },
  { id: "resolved", label: "Resolved" },
];

const STATUS_RANK: Record<string, number> = {
  QUEUED: 0,
  ACTIVE: 1,
  CLAIMED: 2,
  RESOLVED: 3,
  CANCELLED: 4,
};

/**
 * Sort feed for volunteers / admins:
 *  - Active first, then Claimed, then Resolved at the bottom (per request).
 *  - Within the same status, newest first.
 */
function sortForFeed(list: CrisisRequest[]): CrisisRequest[] {
  return [...list].sort((a, b) => {
    const sa = STATUS_RANK[a.status] ?? 9;
    const sb = STATUS_RANK[b.status] ?? 9;
    if (sa !== sb) return sa - sb;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

export default function RequestsScreen() {
  const { palette } = useTheme();
  const styles = useStyles((c) => makeStyles(c));
  const toast = useToast();
  const { user } = useAuth();
  const role = (user?.role || "").toUpperCase();
  const isVolunteer = role === "VOLUNTEER";
  const isAdminLike = role === "ADMIN" || role === "STAFF" || role === "SUPERADMIN";
  const isResponder = isVolunteer || isAdminLike;
  const isCivilian = role === "VICTIM" || role === "" || !isResponder;

  const [requests, setRequests] = useState<CrisisRequest[]>([]);
  const [myTasks, setMyTasks] = useState<CrisisRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      // Civilians only see their own requests; responders see the global feed
      const [reqs, myTasksRaw] = await Promise.all([
        isCivilian ? api.getMyRequests().catch(() => []) : api.getRequests().catch(() => []),
        isResponder ? api.getMyTasks().catch(() => []) : Promise.resolve([]),
      ]);

      setRequests(normalizeRequestList(reqs));
      const tasksList = Array.isArray(myTasksRaw) ? myTasksRaw : (myTasksRaw as any)?.tasks ?? [];
      setMyTasks(
        normalizeRequestList(
          tasksList.map((t: any) => ({ ...t, status: t.status ?? "CLAIMED" })),
        ),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load requests");
    }
  }, [toast, isResponder, isCivilian]);

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

  const activeTask = useMemo(
    () => myTasks.find((t) => t.status === "ACTIVE" || t.status === "CLAIMED") ?? null,
    [myTasks],
  );
  const claimLocked = isResponder && !!activeTask;

  const claim = async (id: string) => {
    if (claimLocked) {
      toast.error("Resolve your current task before claiming a new one.");
      return;
    }
    setBusyId(id);
    try {
      await api.claimRequest(id);
      toast.success("Task claimed — head out and respond.");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to claim task");
    } finally {
      setBusyId(null);
    }
  };



  const filtered = useMemo(() => {
    const sorted = sortForFeed(requests);
    return sorted.filter((r) => {
      if (filter !== "all" && r.status.toLowerCase() !== filter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          r.description.toLowerCase().includes(q) ||
          r.id.toLowerCase().includes(q) ||
          (r.createdBy || "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [requests, filter, search]);

  if (loading) return <Spinner fullscreen />;

  const heading = "Crisis Requests";
  const sub = isResponder
    ? "Tap an unclaimed request to respond — you can only have one active task at a time."
    : "Your submitted requests.";

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
      <Text style={styles.title}>{heading}</Text>
      <Text style={styles.subtitle}>{sub}</Text>

      {claimLocked && activeTask ? (
        <View style={styles.lockBanner}>
          <Lock size={16} color={palette.warning} />
          <View style={{ flex: 1 }}>
            <Text style={styles.lockTitle}>You're already on an active task</Text>
            <Text style={styles.lockBody} numberOfLines={2}>
              Resolve "{activeTask.description}" before claiming a new one.
            </Text>
          </View>
        </View>
      ) : null}

      <View style={{ marginBottom: spacing.md }}>
        <Input
          placeholder="Search by name, email, ID, or description"
          value={search}
          onChangeText={setSearch}
          leftIcon={<Search size={16} color={palette.mutedForeground} />}
          inputSize="lg"
          autoCapitalize="none"
        />
      </View>

      <View style={styles.filterRow}>
        {FILTERS.map((f) => {
          const active = f.id === filter;
          return (
            <Pressable
              key={f.id}
              onPress={() => setFilter(f.id)}
              style={[styles.filterChip, active && styles.filterChipActive]}
            >
              <Text style={[styles.filterText, active && styles.filterTextActive]}>{f.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ gap: spacing.md, marginTop: spacing.md }}>
        {filtered.length === 0 ? (
          <Card>
            <CardContent>
              <View style={{ alignItems: "center", padding: spacing.lg, gap: spacing.sm }}>
                <ShieldAlert size={26} color={palette.mutedForeground} />
                <Text style={[styles.subtitle, { textAlign: "center", marginBottom: 0 }]}>
                  No requests match this filter.
                </Text>
              </View>
            </CardContent>
          </Card>
        ) : (
          filtered.map((r) => (
            <RequestCard
              key={r.id}
              request={r}
              rightSlot={
                isResponder && (r.status === "ACTIVE" || r.status === "QUEUED") ? (
                  <Button
                    title={claimLocked ? "Locked" : "Claim Task"}
                    size="sm"
                    variant={claimLocked ? "outline" : "primary"}
                    fullWidth={false}
                    loading={busyId === r.id}
                    disabled={claimLocked}
                    onPress={() => claim(r.id)}
                    leftIcon={
                      claimLocked ? <Lock size={12} color={palette.mutedForeground} /> : undefined
                    }
                  />
                ) : null
              }
            />
          ))
        )}
      </View>
    </Screen>
  );
}

const makeStyles = (c: ColorPalette) =>
  StyleSheet.create({
    title: { ...typography.h1, color: c.foreground },
    subtitle: { ...typography.small, color: c.mutedForeground, marginBottom: spacing.md },
    filterRow: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
    filterChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    filterChipActive: {
      borderColor: c.crisisRescue,
      backgroundColor: "rgba(43, 179, 242, 0.18)",
    },
    filterText: { ...typography.small, color: c.mutedForeground },
    filterTextActive: { color: c.crisisRescue, fontWeight: "700" },

    lockBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      backgroundColor: "rgba(245, 158, 11, 0.12)",
      borderColor: "rgba(245, 158, 11, 0.40)",
      borderWidth: 1,
      borderRadius: radius.md,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    lockTitle: { ...typography.small, color: c.warning, fontWeight: "700" },
    lockBody: { ...typography.small, color: c.mutedForeground, marginTop: 2 },
  });
