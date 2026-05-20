import React, { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { CheckCircle2, History, ListChecks, MessageSquare, X } from "lucide-react-native";

import { Screen } from "@/components/ui/Screen";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { RequestCard } from "@/components/RequestCard";
import { useToast } from "@/components/Toast";
import { api } from "@/api/client";
import { CrisisRequest, normalizeRequestList } from "@/utils/crisis";
import { radius, spacing, typography, ColorPalette } from "@/theme";
import { useStyles, useTheme } from "@/theme/ThemeProvider";
import { useNavigation } from "@react-navigation/native";

type Tab = "active" | "history";

export default function TasksScreen() {
  const { palette } = useTheme();
  const styles = useStyles((c) => makeStyles(c));
  const toast = useToast();
  const navigation = useNavigation<any>();
  const [tasks, setTasks] = useState<CrisisRequest[]>([]);
  const [historyTasks, setHistoryTasks] = useState<CrisisRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyResolveId, setBusyResolveId] = useState<string | null>(null);
  const [busyCancelId, setBusyCancelId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("active");

  const load = useCallback(async () => {
    try {
      const [activeData, historyData] = await Promise.all([
        api.getMyTasks(),
        api.getTaskHistory().catch(() => []),
      ]);
      const activeList = Array.isArray(activeData) ? activeData : activeData?.tasks ?? [];
      // The /api/tasks/mine endpoint omits a top-level `status` (it's always
      // claimed by the current volunteer). Stamp it explicitly so RequestCard
      // shows the correct badge.
      const normalized = normalizeRequestList(
        activeList.map((t: any) => ({ ...t, status: t.status ?? "CLAIMED" })),
      );
      setTasks(normalized);

      const histList = Array.isArray(historyData) ? historyData : [];
      setHistoryTasks(normalizeRequestList(histList));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load tasks");
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

  const resolve = async (id: string) => {
    setBusyResolveId(id);
    try {
      await api.resolveRequest(id);
      toast.success("Crisis resolved. Great work.");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to resolve");
    } finally {
      setBusyResolveId(null);
    }
  };

  const cancel = async (id: string) => {
    setBusyCancelId(id);
    try {
      await api.cancelRequest(id);
      toast.info("Request cancelled.");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to cancel");
    } finally {
      setBusyCancelId(null);
    }
  };

  if (loading) return <Spinner fullscreen />;

  const displayList = tab === "active" ? tasks : historyTasks;

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
      <Text style={styles.title}>My Tasks</Text>
      <Text style={styles.subtitle}>
        {tab === "active"
          ? "Active commitments you're responding to"
          : "Previously completed tasks"}
      </Text>

      <View style={styles.tabRow}>
        <Pressable
          onPress={() => setTab("active")}
          style={[styles.tabChip, tab === "active" && styles.tabChipActive]}
        >
          <ListChecks size={14} color={tab === "active" ? palette.crisisRescue : palette.mutedForeground} />
          <Text style={[styles.tabText, tab === "active" && styles.tabTextActive]}>
            Active ({tasks.length})
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setTab("history")}
          style={[styles.tabChip, tab === "history" && styles.tabChipActive]}
        >
          <History size={14} color={tab === "history" ? palette.crisisRescue : palette.mutedForeground} />
          <Text style={[styles.tabText, tab === "history" && styles.tabTextActive]}>
            Resolved ({historyTasks.length})
          </Text>
        </Pressable>
      </View>

      <View style={{ gap: spacing.md, marginTop: spacing.md }}>
        {displayList.length === 0 ? (
          <Card>
            <CardContent>
              <Text style={[styles.subtitle, { textAlign: "center" }]}>
                {tab === "active"
                  ? "You haven't claimed any tasks yet."
                  : "No resolved tasks yet."}
              </Text>
            </CardContent>
          </Card>
        ) : (
          displayList.map((t) => (
            <RequestCard
              key={t.id}
              request={t}
              rightSlot={
                tab === "active" && t.status === "CLAIMED" ? (
                  <View style={{ flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" }}>
                    <Button
                      title="Chat"
                      size="sm"
                      variant="outline"
                      fullWidth={false}
                      onPress={() => navigation.navigate("Chat", { requestId: t.id })}
                      leftIcon={<MessageSquare size={14} color={palette.foreground} />}
                    />
                    <Button
                      title="Cancel"
                      size="sm"
                      variant="outline"
                      fullWidth={false}
                      loading={busyCancelId === t.id}
                      onPress={() => cancel(t.id)}
                      leftIcon={<X size={14} color={palette.foreground} />}
                    />
                    <Button
                      title="Resolve"
                      size="sm"
                      fullWidth={false}
                      loading={busyResolveId === t.id}
                      onPress={() => resolve(t.id)}
                      leftIcon={<CheckCircle2 size={14} color="#03121C" />}
                    />
                  </View>
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
  tabRow: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  tabChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  tabChipActive: {
    borderColor: c.crisisRescue,
    backgroundColor: "rgba(43, 179, 242, 0.18)",
  },
  tabText: { ...typography.small, color: c.mutedForeground },
  tabTextActive: { color: c.crisisRescue, fontWeight: "700" },
});
