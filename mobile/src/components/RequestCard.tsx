import React from "react";
import { Pressable, Text, View } from "react-native";
import { MapPin, Clock } from "lucide-react-native";
import { radius, spacing, typography } from "@/theme";
import { useStyles, useTheme } from "@/theme/ThemeProvider";
import { Badge } from "@/components/ui/Badge";
import { CRISIS_META, CrisisRequest, STATUS_META, formatRelative } from "@/utils/crisis";

type Props = {
  request: CrisisRequest;
  onPress?: () => void;
  rightSlot?: React.ReactNode;
};

export function RequestCard({ request, onPress, rightSlot }: Props) {
  const { palette } = useTheme();
  const styles = useStyles((c) => ({
    card: {
      backgroundColor: c.surfaceGlass,
      borderColor: c.surfaceGlassBorder,
      borderWidth: 1,
      borderRadius: radius.lg,
      padding: spacing.lg,
      gap: spacing.md,
    },
    row: { flexDirection: "row" as const, gap: spacing.md, alignItems: "flex-start" as const },
    icon: {
      width: 40,
      height: 40,
      borderRadius: radius.md,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    headerRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "space-between" as const,
      gap: spacing.sm,
    },
    title: { ...typography.h3, color: c.foreground },
    desc: { ...typography.body, color: c.mutedForeground },
    metaRow: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: spacing.md },
    metaItem: { flexDirection: "row" as const, alignItems: "center" as const, gap: spacing.xs },
    metaText: { ...typography.caption, color: c.mutedForeground, textTransform: "none" as const },
    rightSlot: { flexDirection: "row" as const, gap: spacing.sm, justifyContent: "flex-end" as const },
  }));

  const meta = CRISIS_META[request.type] || CRISIS_META.rescue;
  const statusMeta = STATUS_META[request.status] || STATUS_META.ACTIVE;
  const Icon = meta.icon;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && onPress && { opacity: 0.85 }]}
      disabled={!onPress}
    >
      <View style={styles.row}>
        <View style={[styles.icon, { backgroundColor: `${meta.color}26` }]}>
          <Icon size={20} color={meta.color} />
        </View>
        <View style={{ flex: 1, gap: spacing.xs }}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>{meta.label}</Text>
            <Badge label={statusMeta.label} color={statusMeta.color} variant="soft" />
          </View>
          <Text style={styles.desc} numberOfLines={3}>
            {request.description}
          </Text>
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <MapPin size={12} color={palette.mutedForeground} />
              <Text style={styles.metaText}>
                {request.lat.toFixed(3)}, {request.lng.toFixed(3)}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Clock size={12} color={palette.mutedForeground} />
              <Text style={styles.metaText}>{formatRelative(request.createdAt)}</Text>
            </View>
          </View>
        </View>
      </View>
      {rightSlot ? <View style={styles.rightSlot}>{rightSlot}</View> : null}
    </Pressable>
  );
}
