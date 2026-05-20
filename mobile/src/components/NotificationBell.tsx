import React, { useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Bell, Droplets, HeartPulse, LifeBuoy, MapPin, X } from "lucide-react-native";

import { Button } from "@/components/ui/Button";
import { radius, spacing, typography, ColorPalette, darkColors } from "@/theme";
import { useStyles, useTheme } from "@/theme/ThemeProvider";
import type { VolunteerAlert } from "@/hooks/useSocket";

export type Notification = VolunteerAlert & { read: boolean };

const TYPE_META = {
  medical: { label: "Medical", icon: HeartPulse, color: darkColors.crisisMedical },
  food_water: { label: "Food / Water", icon: Droplets, color: darkColors.crisisFoodWater },
  rescue: { label: "Rescue", icon: LifeBuoy, color: darkColors.crisisRescue },
} as const;

const formatTime = (iso: string) => {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 1) return "just now";
  if (diff < 60) return `${diff}m ago`;
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

type Props = {
  notifications: Notification[];
  onMarkAllRead: () => void;
  onDismiss: (id: string) => void;
  onFlyTo?: (lat: number, lng: number) => void;
};

export default function NotificationBell({
  notifications,
  onMarkAllRead,
  onDismiss,
  onFlyTo,
}: Props) {
  const { palette } = useTheme();
  const styles = useStyles((c) => makeStyles(c));
  const [open, setOpen] = useState(false);
  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleOpen = () => {
    setOpen(true);
    if (unreadCount > 0) onMarkAllRead();
  };

  return (
    <>
      <Pressable onPress={handleOpen} style={styles.bellBtn} hitSlop={6}>
        <Bell size={18} color={palette.foreground} />
        {unreadCount > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
          </View>
        ) : null}
      </Pressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.handle} />
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <Bell size={16} color={palette.crisisRescue} />
                <Text style={styles.title}>Crisis Alerts</Text>
              </View>
              <Pressable onPress={() => setOpen(false)} hitSlop={10}>
                <X size={20} color={palette.mutedForeground} />
              </Pressable>
            </View>

            {notifications.length === 0 ? (
              <View style={styles.empty}>
                <Bell size={28} color={palette.mutedForeground} />
                <Text style={styles.emptyText}>No alerts yet</Text>
                <Text style={styles.emptySub}>
                  When new crises broadcast, they'll appear here.
                </Text>
              </View>
            ) : (
              <View style={{ gap: spacing.sm }}>
                {notifications.map((n) => {
                  const meta = TYPE_META[n.type] ?? TYPE_META.rescue;
                  const Icon = meta.icon;
                  return (
                    <View
                      key={n.id}
                      style={[
                        styles.row,
                        { borderColor: `${meta.color}55` },
                        !n.read && { backgroundColor: `${meta.color}1A` },
                      ]}
                    >
                      <View style={[styles.icon, { backgroundColor: `${meta.color}26` }]}>
                        <Icon size={18} color={meta.color} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={styles.rowHeader}>
                          <Text style={[styles.typeLabel, { color: meta.color }]}>{meta.label}</Text>
                          <Text style={styles.time}>{formatTime(n.createdAt)}</Text>
                        </View>
                        <Text style={styles.desc} numberOfLines={3}>
                          {n.description}
                        </Text>
                        <View style={styles.rowActions}>
                          <Pressable
                            onPress={() => {
                              onFlyTo?.(n.lat, n.lng);
                              setOpen(false);
                            }}
                            style={styles.linkBtn}
                            hitSlop={6}
                          >
                            <MapPin size={12} color={palette.crisisRescue} />
                            <Text style={styles.linkText}>View on map</Text>
                          </Pressable>
                          <Pressable onPress={() => onDismiss(n.id)} hitSlop={6}>
                            <Text style={styles.dismissText}>Dismiss</Text>
                          </Pressable>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            <Button
              title="Close"
              variant="outline"
              onPress={() => setOpen(false)}
              style={{ marginTop: spacing.lg }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const makeStyles = (c: ColorPalette) =>
  StyleSheet.create({
  bellBtn: {
    width: 40, height: 40, borderRadius: radius.md,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: c.border, backgroundColor: c.surface,
  },
  badge: {
    position: "absolute", top: -2, right: -2,
    minWidth: 16, height: 16, borderRadius: 8,
    paddingHorizontal: 4,
    backgroundColor: c.destructive,
    alignItems: "center", justifyContent: "center",
  },
  badgeText: { ...typography.caption, color: "#fff", fontSize: 10, fontWeight: "700" },

  backdrop: { flex: 1, backgroundColor: c.overlay, justifyContent: "flex-end" },
  sheet: {
    backgroundColor: c.surfaceElevated,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    maxHeight: "85%",
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: c.border, alignSelf: "center", marginBottom: spacing.md,
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  title: { ...typography.h3, color: c.foreground },

  empty: { alignItems: "center", paddingVertical: spacing["2xl"], gap: spacing.sm },
  emptyText: { ...typography.h3, color: c.foreground },
  emptySub: { ...typography.small, color: c.mutedForeground, textAlign: "center" },

  row: {
    flexDirection: "row", gap: spacing.md, padding: spacing.md,
    borderRadius: radius.md, borderWidth: 1, alignItems: "flex-start",
    backgroundColor: c.surface,
  },
  icon: { width: 36, height: 36, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  rowHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.xs },
  typeLabel: { ...typography.small, fontWeight: "700" },
  time: { ...typography.caption, color: c.mutedForeground, textTransform: "none" },
  desc: { ...typography.small, color: c.foreground },
  rowActions: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.sm, alignItems: "center" },
  linkBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  linkText: { ...typography.small, color: c.crisisRescue, fontWeight: "600" },
  dismissText: { ...typography.small, color: c.mutedForeground },
});
