import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { ArrowLeft, Search } from "lucide-react-native";

import { Screen } from "@/components/ui/Screen";
import { Card, CardContent } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { Input } from "@/components/ui/Input";
import { RequestCard } from "@/components/RequestCard";
import { useToast } from "@/components/Toast";
import { api } from "@/api/client";
import { CrisisRequest, normalizeRequestList } from "@/utils/crisis";
import { radius, spacing, typography, ColorPalette } from "@/theme";
import { useStyles, useTheme } from "@/theme/ThemeProvider";
import { useNavigation } from "@react-navigation/native";

type Filter = "all" | "active" | "claimed" | "resolved";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "claimed", label: "Claimed" },
  { id: "resolved", label: "Resolved" },
];

export default function AdminRequestsScreen() {
  const { palette } = useTheme();
  const styles = useStyles((c) => makeStyles(c));
  const toast = useToast();
  const navigation = useNavigation<any>();
  const [requests, setRequests] = useState<CrisisRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await api.adminGetRequests();
      setRequests(normalizeRequestList(data));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load requests");
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

  const filtered = useMemo(() => {
    return requests.filter((r) => {
      if (filter !== "all" && r.status.toLowerCase() !== filter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return r.description.toLowerCase().includes(q) || r.id.includes(q);
      }
      return true;
    });
  }, [requests, filter, search]);

  if (loading) return <Spinner fullscreen />;

  return (
    <Screen
      scrollProps={{
        refreshControl: (
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.crisisRescue} />
        ),
      }}
    >
      <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={10}>
        <ArrowLeft size={16} color={palette.mutedForeground} />
        <Text style={styles.muted}>Back</Text>
      </Pressable>

      <Text style={styles.title}>Crisis Requests</Text>

      <Input
        placeholder="Search description or ID"
        value={search}
        onChangeText={setSearch}
        leftIcon={<Search size={16} color={palette.mutedForeground} />}
        inputSize="lg"
      />

      <View style={styles.filterRow}>
        {FILTERS.map((f) => {
          const active = f.id === filter;
          const count =
            f.id === "all"
              ? requests.length
              : requests.filter((r) => r.status.toLowerCase() === f.id).length;
          return (
            <Pressable
              key={f.id}
              onPress={() => setFilter(f.id)}
              style={[styles.filterChip, active && styles.filterChipActive]}
            >
              <Text style={[styles.filterText, active && styles.filterTextActive]}>
                {f.label} ({count})
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ gap: spacing.md, marginTop: spacing.md }}>
        {filtered.length === 0 ? (
          <Card>
            <CardContent>
              <Text style={[styles.muted, { textAlign: "center" }]}>No requests match.</Text>
            </CardContent>
          </Card>
        ) : (
          filtered.map((r) => <RequestCard key={r.id} request={r} />)
        )}
      </View>
    </Screen>
  );
}

const makeStyles = (c: ColorPalette) =>
  StyleSheet.create({
  backBtn: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginBottom: spacing.md },
  title: { ...typography.h1, color: c.foreground, marginBottom: spacing.md },
  muted: { ...typography.small, color: c.mutedForeground },

  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md },
  filterChip: {
    paddingHorizontal: spacing.md, paddingVertical: 6,
    borderRadius: radius.pill, borderWidth: 1, borderColor: c.border,
    backgroundColor: c.surface,
  },
  filterChipActive: { borderColor: c.crisisRescue, backgroundColor: "rgba(43, 179, 242, 0.18)" },
  filterText: { ...typography.small, color: c.mutedForeground },
  filterTextActive: { color: c.crisisRescue, fontWeight: "700" },
});
