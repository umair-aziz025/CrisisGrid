import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ArrowLeft,
  Building2,
  HeartPulse,
  Home,
  MapPin,
  Plus,
  Shield,
  Trash2,
  X,
} from "lucide-react-native";

import { Screen } from "@/components/ui/Screen";
import { Card, CardContent } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { CrisisMap } from "@/components/CrisisMap";
import { LocationSearch } from "@/components/LocationSearch";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/hooks/useAuth";
import { getCurrentLocationOnce } from "@/hooks/useVolunteerLocation";
import { api } from "@/api/client";
import { radius, spacing, typography, ColorPalette, darkColors } from "@/theme";
import { useStyles, useTheme } from "@/theme/ThemeProvider";
import { useNavigation } from "@react-navigation/native";

type SafeZone = {
  id: number;
  name: string;
  type: string;
  lat: number;
  lng: number;
  description?: string | null;
};

const TYPES: { id: string; label: string; icon: typeof Shield; color: string }[] = [
  { id: "shelter", label: "Shelter", color: darkColors.crisisRescue, icon: Home },
  { id: "hospital", label: "Hospital", color: darkColors.crisisMedical, icon: HeartPulse },
  { id: "command", label: "Command", color: darkColors.warning, icon: Building2 },
  { id: "general", label: "Safe Area", color: darkColors.statusClaimed, icon: Shield },
];

const TYPE_COLOR = (type: string) => TYPES.find((t) => t.id === type)?.color ?? darkColors.crisisRescue;
const TYPE_ICON = (type: string) => TYPES.find((t) => t.id === type)?.icon ?? Shield;

export default function SafeZonesScreen() {
  const { palette } = useTheme();
  const styles = useStyles((c) => makeStyles(c));
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { user } = useAuth();
  const navigation = useNavigation<any>();

  const role = (user?.role || "").toUpperCase();
  const isAdmin = role === "ADMIN" || role === "SUPERADMIN" || role === "STAFF";

  const [zones, setZones] = useState<SafeZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<string>("shelter");
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.getSafeZones();
      setZones(Array.isArray(data) ? data : data?.zones ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load safe zones");
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

  const useMyLocation = async () => {
    const c = await getCurrentLocationOnce();
    if (!c) {
      toast.error("Location permission denied");
      return;
    }
    setPin({ lat: c.latitude, lng: c.longitude });
  };

  const submit = async () => {
    if (!name.trim()) return toast.error("Name is required");
    if (!pin) return toast.error("Drop a pin to set location");
    setSubmitting(true);
    try {
      await api.adminCreateSafeZone({
        name: name.trim(),
        type,
        lat: pin.lat,
        lng: pin.lng,
        description: description.trim() || undefined,
      });
      toast.success("Safe zone added");
      setModalOpen(false);
      setName("");
      setDescription("");
      setPin(null);
      setType("shelter");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create safe zone");
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (id: number) => {
    try {
      await api.adminDeleteSafeZone(id);
      toast.success("Safe zone removed");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete");
    }
  };

  const mapRequests = useMemo(
    () =>
      zones.map((z) => ({
        id: `sz-${z.id}`,
        type: "rescue" as const,
        description: z.name,
        lat: z.lat,
        lng: z.lng,
        status: "ACTIVE" as const,
        createdAt: new Date().toISOString(),
      })),
    [zones],
  );

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

        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Safe Zones</Text>
            <Text style={styles.muted}>Shelters, hospitals, and command centers nearby</Text>
          </View>
          {isAdmin ? (
            <Button
              title="Add"
              size="sm"
              fullWidth={false}
              onPress={() => setModalOpen(true)}
              leftIcon={<Plus size={16} color="#03121C" />}
            />
          ) : null}
        </View>

        <CrisisMap requests={mapRequests} height={220} />

        <View style={{ height: spacing.lg }} />

        <View style={{ gap: spacing.md }}>
          {zones.length === 0 ? (
            <Card>
              <CardContent>
                <View style={{ alignItems: "center", padding: spacing.lg, gap: spacing.sm }}>
                  <Shield size={28} color={palette.mutedForeground} />
                  <Text style={styles.muted}>No safe zones registered yet.</Text>
                </View>
              </CardContent>
            </Card>
          ) : (
            zones.map((z) => {
              const Icon = TYPE_ICON(z.type);
              const color = TYPE_COLOR(z.type);
              return (
                <View key={z.id} style={[styles.zoneRow, { borderColor: `${color}55` }]}>
                  <View style={[styles.zoneIcon, { backgroundColor: `${color}26` }]}>
                    <Icon size={20} color={color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.zoneHeader}>
                      <Text style={styles.zoneName}>{z.name}</Text>
                      <Badge label={z.type} color={color} variant="soft" />
                    </View>
                    {z.description ? (
                      <Text style={styles.muted} numberOfLines={2}>
                        {z.description}
                      </Text>
                    ) : null}
                    <View style={styles.coordsRow}>
                      <MapPin size={12} color={palette.mutedForeground} />
                      <Text style={styles.coords}>
                        {z.lat.toFixed(4)}, {z.lng.toFixed(4)}
                      </Text>
                    </View>
                  </View>
                  {isAdmin ? (
                    <Pressable onPress={() => remove(z.id)} hitSlop={6} style={styles.deleteBtn}>
                      <Trash2 size={14} color={palette.destructive} />
                    </Pressable>
                  ) : null}
                </View>
              );
            })
          )}
        </View>
      </Screen>

      <Modal
        visible={modalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setModalOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setModalOpen(false)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.title}>Add Safe Zone</Text>
              <Pressable onPress={() => setModalOpen(false)} hitSlop={12}>
                <X size={22} color={palette.mutedForeground} />
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={{
                paddingBottom: spacing.lg + insets.bottom,
                gap: spacing.md,
              }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Input
                label="Name"
                value={name}
                onChangeText={setName}
                placeholder="Central Shelter"
                inputSize="lg"
              />

              <Text style={styles.label}>Type</Text>
              <View style={styles.typeRow}>
                {TYPES.map((t) => {
                  const Icon = t.icon;
                  const active = type === t.id;
                  return (
                    <Pressable
                      key={t.id}
                      onPress={() => setType(t.id)}
                      style={[
                        styles.typeChip,
                        active && {
                          borderColor: t.color,
                          backgroundColor: `${t.color}22`,
                        },
                      ]}
                    >
                      <Icon size={14} color={active ? t.color : palette.mutedForeground} />
                      <Text
                        style={[
                          styles.typeChipText,
                          active && { color: t.color, fontWeight: "700" },
                        ]}
                      >
                        {t.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Input
                label="Description"
                value={description}
                onChangeText={setDescription}
                placeholder="Optional notes"
                inputSize="lg"
              />

              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Text style={styles.label}>Location</Text>
                <Button
                  title="Use my location"
                  size="sm"
                  variant="outline"
                  fullWidth={false}
                  onPress={useMyLocation}
                />
              </View>

              <LocationSearch
                placeholder="Search address…"
                onPick={(hit) => setPin({ lat: hit.lat, lng: hit.lng })}
              />

              <CrisisMap
                requests={mapRequests}
                pin={pin}
                onMapPress={(lat, lng) => setPin({ lat, lng })}
                height={180}
              />

              {pin ? (
                <Text style={styles.muted}>
                  {pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}
                </Text>
              ) : null}

              <Button title="Save Safe Zone" size="lg" loading={submitting} onPress={submit} />
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const makeStyles = (c: ColorPalette) =>
  StyleSheet.create({
  backBtn: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginBottom: spacing.md },
  headerRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.lg },
  title: { ...typography.h1, color: c.foreground },
  muted: { ...typography.small, color: c.mutedForeground, marginTop: 2 },

  zoneRow: {
    flexDirection: "row", gap: spacing.md, padding: spacing.lg,
    borderRadius: radius.lg, borderWidth: 1,
    backgroundColor: c.surfaceGlass, alignItems: "flex-start",
  },
  zoneIcon: { width: 40, height: 40, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  zoneHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm },
  zoneName: { ...typography.h3, color: c.foreground, flex: 1 },
  coordsRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.xs },
  coords: { ...typography.caption, color: c.mutedForeground, textTransform: "none" },
  deleteBtn: {
    width: 32, height: 32, borderRadius: radius.md,
    backgroundColor: "rgba(242, 59, 59, 0.15)",
    alignItems: "center", justifyContent: "center",
  },

  modalBackdrop: { flex: 1, backgroundColor: c.overlay, justifyContent: "flex-end" },
  modalSheet: {
    backgroundColor: c.surfaceElevated,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: 0,
    maxHeight: "90%",
    borderTopWidth: 1,
    borderTopColor: c.surfaceGlassBorder,
  },
  modalHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: c.border, alignSelf: "center", marginBottom: spacing.sm,
  },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },

  label: { ...typography.small, color: c.foreground, fontWeight: "600" },
  typeRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  typeChip: {
    flexDirection: "row", alignItems: "center", gap: spacing.xs,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radius.pill, borderWidth: 1, borderColor: c.border,
    backgroundColor: c.surface,
  },
  typeChipText: { ...typography.small, color: c.mutedForeground },
});
