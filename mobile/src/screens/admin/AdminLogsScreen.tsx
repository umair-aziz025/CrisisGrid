import React, { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { ArrowLeft, ChevronLeft, ChevronRight, FileText, Search } from "lucide-react-native";

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

type LogRecord = {
  id: number;
  action: string;
  details: string | null;
  createdAt: string;
  performedBy: { name: string; email: string } | null;
  targetUser: { name: string; email: string } | null;
};

const ACTION_COLORS: Record<string, string> = {
  ACCOUNT_LOCKED: darkColors.destructive,
  LOGIN_FAILED: darkColors.destructive,
  USER_LOGIN: darkColors.mutedForeground,
  HELP_REQUEST_SUBMITTED: darkColors.crisisMedical,
  TASK_CLAIMED: darkColors.statusClaimed,
  TASK_RESOLVED: darkColors.statusClaimed,
  REQUEST_CANCELLED: darkColors.mutedForeground,
  ADMIN_VIEWED_USERS: darkColors.crisisRescue,
  ROLE_CHANGE: darkColors.crisisRescue,
  ROLE_CHANGE_BLOCKED: darkColors.warning,
  BAN_USER: darkColors.destructive,
  UNBAN_USER: darkColors.statusClaimed,
  REPORT_FRAUD: darkColors.crisisMedical,
  USER_REGISTER: darkColors.mutedForeground,
  PASSWORD_RESET: darkColors.crisisFoodWater,
  TWO_FACTOR_ENABLED: darkColors.statusClaimed,
};

const PAGE_SIZE = 30;

export default function AdminLogsScreen() {
  const { palette } = useTheme();
  const styles = useStyles((c) => makeStyles(c));
  const toast = useToast();
  const navigation = useNavigation<any>();
  const [logs, setLogs] = useState<LogRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await api.adminGetLogs({
        search: search || undefined,
        page,
        limit: PAGE_SIZE,
      });
      setLogs(data.logs || []);
      setTotal(data.total || 0);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load logs");
    }
  }, [search, page, toast]);

  useEffect(() => {
    (async () => {
      await load();
      setLoading(false);
    })();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

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

      <Text style={styles.title}>Activity Logs</Text>
      <Text style={styles.muted}>
        Audit trail across the platform — {total.toLocaleString()} entries
      </Text>

      <Input
        placeholder="Search action or details"
        value={search}
        onChangeText={setSearch}
        leftIcon={<Search size={16} color={palette.mutedForeground} />}
        inputSize="lg"
        containerStyle={{ marginTop: spacing.md }}
      />

      <View style={{ gap: spacing.md, marginTop: spacing.md }}>
        {logs.length === 0 ? (
          <Card>
            <CardContent>
              <View style={{ alignItems: "center", padding: spacing.lg, gap: spacing.sm }}>
                <FileText size={28} color={palette.mutedForeground} />
                <Text style={[styles.muted, { textAlign: "center" }]}>No log entries found.</Text>
              </View>
            </CardContent>
          </Card>
        ) : (
          logs.map((log) => {
            const accent = ACTION_COLORS[log.action] || palette.mutedForeground;
            return (
              <View key={log.id} style={[styles.logRow, { borderColor: `${accent}40` }]}>
                <View style={styles.logHeader}>
                  <Badge label={log.action.replace(/_/g, " ")} color={accent} variant="soft" />
                  <Text style={styles.time}>
                    {new Date(log.createdAt).toLocaleString()}
                  </Text>
                </View>
                {log.details ? (
                  <Text style={styles.details}>{log.details}</Text>
                ) : null}
                <View style={styles.meta}>
                  {log.performedBy ? (
                    <Text style={styles.metaText}>
                      by {log.performedBy.name} ({log.performedBy.email})
                    </Text>
                  ) : null}
                  {log.targetUser ? (
                    <Text style={styles.metaText}>
                      → {log.targetUser.name} ({log.targetUser.email})
                    </Text>
                  ) : null}
                </View>
              </View>
            );
          })
        )}
      </View>

      <View style={styles.paginationRow}>
        <Button
          title="Prev"
          variant="outline"
          fullWidth={false}
          disabled={page <= 1}
          onPress={() => setPage((p) => Math.max(1, p - 1))}
          leftIcon={<ChevronLeft size={14} color={palette.foreground} />}
        />
        <Text style={styles.muted}>
          Page {page} of {totalPages}
        </Text>
        <Button
          title="Next"
          variant="outline"
          fullWidth={false}
          disabled={page >= totalPages}
          onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
          rightIcon={<ChevronRight size={14} color={palette.foreground} />}
        />
      </View>
    </Screen>
  );
}

const makeStyles = (c: ColorPalette) =>
  StyleSheet.create({
  backBtn: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginBottom: spacing.md },
  title: { ...typography.h1, color: c.foreground },
  muted: { ...typography.small, color: c.mutedForeground, marginTop: 2 },

  logRow: {
    backgroundColor: c.surfaceGlass,
    borderRadius: radius.lg, borderWidth: 1,
    padding: spacing.md, gap: spacing.xs,
  },
  logHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  time: { ...typography.caption, color: c.mutedForeground, textTransform: "none" },
  details: { ...typography.small, color: c.foreground },
  meta: { gap: 2, marginTop: spacing.xs },
  metaText: { ...typography.caption, color: c.mutedForeground, textTransform: "none" },

  paginationRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.lg,
  },
});
