import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Crosshair,
  MessageSquare,
  Plus,
  Radio,
  ShieldAlert,
  Siren,
  X,
} from "lucide-react-native";

import { Screen } from "@/components/ui/Screen";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { RequestCard } from "@/components/RequestCard";
import { CrisisMap, CrisisMapHandle, RouteSegment } from "@/components/CrisisMap";
import { LocationSearch } from "@/components/LocationSearch";
import NotificationBell, { Notification } from "@/components/NotificationBell";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/hooks/useAuth";
import { useSocket, VolunteerAlert, VolunteerPosition } from "@/hooks/useSocket";
import { getCurrentLocationOnce } from "@/hooks/useVolunteerLocation";
import * as Location from "expo-location";
import { api } from "@/api/client";
import {
  CRISIS_META,
  CRISIS_TYPES,
  CrisisRequest,
  CrisisType,
  normalizeRequest,
  normalizeRequestList,
} from "@/utils/crisis";
import { getDirections } from "@/utils/directions";
import { radius, spacing, typography, ColorPalette } from "@/theme";
import { useStyles, useTheme } from "@/theme/ThemeProvider";
import { useNavigation } from "@react-navigation/native";

export default function DashboardScreen() {
  const { palette } = useTheme();
  const styles = useStyles((c) => makeStyles(c));
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const toast = useToast();
  const navigation = useNavigation<any>();
  const mapRef = useRef<CrisisMapHandle | null>(null);

  const role = (user?.role || "").toUpperCase();
  const isVolunteer = role === "VOLUNTEER";
  const isAdminLike = role === "ADMIN" || role === "STAFF" || role === "SUPERADMIN";
  const isResponder = isVolunteer || isAdminLike;
  const isCivilian = !isResponder;

  /** Active requests across the platform — used only to render map markers. */
  const [allActive, setAllActive] = useState<CrisisRequest[]>([]);
  /** The current user's own requests — drives feed cards and stats. */
  const [myRequests, setMyRequests] = useState<CrisisRequest[]>([]);
  /** Volunteer's currently claimed task (if any) — used for the route + chat link. */
  const [myTasks, setMyTasks] = useState<CrisisRequest[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [myCoords, setMyCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [volunteerPositions, setVolunteerPositions] = useState<Record<string, VolunteerPosition>>({});
  const [routes, setRoutes] = useState<RouteSegment[]>([]);
  const [routeRefreshing, setRouteRefreshing] = useState(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [type, setType] = useState<CrisisType>("medical");
  const [description, setDescription] = useState("");
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  /** The active task that pins the volunteer to a single crisis at a time. */
  const activeTask = useMemo(
    () => myTasks.find((t) => t.status === "ACTIVE" || t.status === "CLAIMED") ?? null,
    [myTasks],
  );

  /** For non-volunteers (civilian/staff/admin/superadmin): the request that has been claimed by a volunteer. */
  const claimedRequest = useMemo(
    () => (!isVolunteer ? myRequests.find((r) => r.status === "CLAIMED") ?? null : null),
    [isVolunteer, myRequests],
  );

  /** Unified route target — works for both volunteers (activeTask) and civilians (claimedRequest). */
  const routeTarget = useMemo(() => activeTask ?? claimedRequest, [activeTask, claimedRequest]);

  const load = useCallback(async () => {
    try {
      const [allRaw, mineRaw, tasksRaw] = await Promise.all([
        api.getRequests().catch(() => []),
        api.getMyRequests().catch(() => []),
        isResponder ? api.getMyTasks().catch(() => []) : Promise.resolve([]),
      ]);
      setAllActive(normalizeRequestList(allRaw));
      setMyRequests(normalizeRequestList(mineRaw));
      const tasksList = Array.isArray(tasksRaw) ? tasksRaw : (tasksRaw as any)?.tasks ?? [];
      setMyTasks(tasksList.map((t: any) => normalizeRequest({ ...t, status: t.status ?? "CLAIMED" })));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load");
    }
  }, [toast, isResponder]);

  useEffect(() => {
    (async () => {
      const coords = await getCurrentLocationOnce().catch(() => null);
      if (coords) setMyCoords({ latitude: coords.latitude, longitude: coords.longitude });
      await load();
      setLoading(false);
    })();
  }, [load]);

  /**
   * Continuous location tracking for responders with an active task.
   * This ensures the route updates as the responder moves toward the destination.
   */
  useEffect(() => {
    if (!isResponder || !activeTask) return;
    let cancelled = false;
    let watchSub: Location.LocationSubscription | null = null;

    const track = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted" || cancelled) return;
        watchSub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, timeInterval: 10_000, distanceInterval: 15 },
          (pos) => {
            if (cancelled) return;
            setMyCoords({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
            });
          },
        );
      } catch {
        /* best-effort */
      }
    };

    track();
    return () => {
      cancelled = true;
      watchSub?.remove();
    };
  }, [isVolunteer, activeTask]);

  useSocket({
    onNewCrisis: (data) => {
      const next = normalizeRequest(data);
      setAllActive((prev) => (prev.some((r) => r.id === next.id) ? prev : [next, ...prev]));
      // If it's mine, mirror into myRequests too.
      if (data?.createdBy && data.createdBy === user?.email) {
        setMyRequests((prev) => (prev.some((r) => r.id === next.id) ? prev : [next, ...prev]));
      }
    },
    onCrisisClaimed: (data) => {
      const id = String(data?.requestId ?? "");
      setAllActive((prev) => prev.map((r) => (r.id === id ? { ...r, status: "CLAIMED" } : r)));
      setMyRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status: "CLAIMED" } : r)));
      // If this volunteer was assigned, refresh tasks + route immediately
      if (data?.claimedBy === user?.email || data?.volunteerId === user?.id) {
        load();
      }
    },
    onCrisisResolved: (data) => {
      const id = String(data?.requestId ?? "");
      setAllActive((prev) => prev.filter((r) => r.id !== id));
      setMyRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status: "RESOLVED" } : r)));
      setMyTasks((prev) => prev.filter((r) => r.id !== id));
    },
    onCrisisCancelled: (data) => {
      const id = String(data?.requestId ?? "");
      setAllActive((prev) => prev.filter((r) => r.id !== id));
      setMyRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status: "CANCELLED" } : r)));
      setMyTasks((prev) => prev.filter((r) => r.id !== id));
    },
    onTaskCancelledByRequester: (data) => {
      const id = String(data?.requestId ?? "");
      setMyTasks((prev) => prev.filter((r) => r.id !== id));
      toast.info("A request you accepted was cancelled by the requester.");
    },
    onVolunteerAlert: (alert: VolunteerAlert) => {
      setNotifications((prev) => [{ ...alert, read: false }, ...prev].slice(0, 30));
      toast.info(`New ${alert.type.replace("_", "/")} request nearby`);
    },
    onVolunteerLocation: (pos) => {
      setVolunteerPositions((prev) => ({ ...prev, [pos.email]: pos }));
    },
  });

  /**
   * Resolve the driving route whenever the active task or the user's location changes.
   * The directions helper uses the Google Directions API when configured.
   */
  const resolveRoute = useCallback(async () => {
    if (!routeTarget || !myCoords) {
      setRoutes([]);
      return;
    }
    setRouteRefreshing(true);
    try {
      const dirs = await getDirections(
        myCoords,
        { latitude: routeTarget.lat, longitude: routeTarget.lng },
        { mode: "driving", alternatives: true },
      );
      setRoutes(
        dirs.map((d, i) => ({
          points: d.points,
          distanceM: d.distanceM,
          durationSec: d.durationSec,
          color: i === 0 ? palette.crisisRescue : "rgba(43, 179, 242, 0.55)",
          primary: i === 0,
        })),
      );
    } catch {
      toast.error("Failed to update route");
    } finally {
      setRouteRefreshing(false);
    }
  }, [routeTarget, myCoords, palette.crisisRescue, toast]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!routeTarget || !myCoords) {
        setRoutes([]);
        return;
      }
      await resolveRoute();
    })();
    return () => {
      cancelled = true;
    };
  }, [routeTarget, myCoords, resolveRoute]);

  /**
   * Poll route updates every 15 seconds while a route is active.
   * This gives the volunteer live ETA updates as they drive.
   */
  useEffect(() => {
    if (!routeTarget || !myCoords) return;
    const interval = setInterval(() => {
      resolveRoute();
    }, 15_000);
    return () => clearInterval(interval);
  }, [routeTarget, myCoords, resolveRoute]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const stats = useMemo(() => {
    // For all roles: count their own requests
    const queued = myRequests.filter((r) => r.status === "QUEUED").length;
    const claimed = myRequests.filter((r) => r.status === "CLAIMED").length;
    const resolved = myRequests.filter((r) => r.status === "RESOLVED").length;
    const total = myRequests.filter((r) => r.status !== "CANCELLED").length;
    // For responders: also count tasks they've claimed
    const myActiveTasks = myTasks.filter((t) => t.status === "CLAIMED" || t.status === "ACTIVE").length;
    const myResolvedTasks = myTasks.filter((t) => t.status === "RESOLVED").length;
    return {
      queued, claimed, resolved, total,
      myActiveTasks, myResolvedTasks,
    };
  }, [myRequests, myTasks]);

  /**
   * Civilians can create multiple queued requests. The "Add New Crisis" button
   * is always available. Server handles queue logic (new requests go to QUEUED
   * if an ACTIVE/CLAIMED one already exists).
   */
  const activeRequestCount = useMemo(
    () => myRequests.filter((r) => r.status === "ACTIVE" || r.status === "CLAIMED").length,
    [myRequests],
  );
  const queuedRequestCount = useMemo(
    () => myRequests.filter((r) => r.status === "QUEUED").length,
    [myRequests],
  );

  const cancelMyRequest = useCallback(
    async (id: string) => {
      try {
        const res: any = await api.cancelRequest(id);
        if (res?.banned) {
          toast.error(
            "Your account has been auto-banned for repeated cancellations.",
          );
          // Force the auth context to fall through to the locked state on next reload.
          await load();
          return;
        }
        if (res?.warning) {
          toast.error(res.warning);
        } else {
          toast.info("Request cancelled.");
        }
        await load();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to cancel");
      }
    },
    [toast, load],
  );

  const useMyLocationForPin = useCallback(async () => {
    const coords = await getCurrentLocationOnce();
    if (!coords) {
      toast.error("Location permission denied");
      return;
    }
    setPin({ lat: coords.latitude, lng: coords.longitude });
    setMyCoords({ latitude: coords.latitude, longitude: coords.longitude });
    mapRef.current?.animateTo(coords.latitude, coords.longitude);
  }, [toast]);

  const submit = useCallback(async () => {
    if (!description.trim()) {
      toast.error("Please describe the situation");
      return;
    }
    if (!pin) {
      toast.error("Drop a pin on the map to set the location");
      return;
    }
    setSubmitting(true);
    try {
      const created: any = await api.createRequest({ type, description: description.trim(), lat: pin.lat, lng: pin.lng });
      // Server handles auto-dispatch automatically. Request starts as QUEUED
      // and gets promoted to CLAIMED if a volunteer is available.
      if (created?.status === "QUEUED") {
        toast.info("Request queued — waiting for an available volunteer nearby.");
      } else {
        toast.success("Crisis broadcast to nearby volunteers");
      }

      setModalOpen(false);
      setDescription("");
      setPin(null);
      setType("medical");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to submit request");
    } finally {
      setSubmitting(false);
    }
  }, [type, description, pin, toast, load]);

  if (loading) return <Spinner fullscreen />;

  const greetingName = user?.fullName || user?.name || "Responder";
  const volunteerMarkers = Object.values(volunteerPositions).map((v) => ({
    id: v.email,
    lat: v.lat,
    lng: v.lng,
    name: v.email,
  }));

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
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>Hi, {greetingName.split(" ")[0]}</Text>
            <Text style={styles.subtitle}>Live emergency coordination</Text>
          </View>
          <NotificationBell
            notifications={notifications}
            onMarkAllRead={() =>
              setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
            }
            onDismiss={(id) =>
              setNotifications((prev) => prev.filter((n) => n.id !== id))
            }
            onFlyTo={(lat, lng) => mapRef.current?.animateTo(lat, lng)}
          />
        </View>

        <View style={styles.statsRow}>
          {isResponder ? (
            <>
              <StatCard label="My Requests" value={stats.total} color={palette.foreground} icon={<AlertTriangle size={16} color={palette.foreground} />} />
              <StatCard label="My Tasks" value={stats.myActiveTasks} color={palette.crisisRescue} icon={<Activity size={16} color={palette.crisisRescue} />} />
              <StatCard label="Resolved" value={stats.myResolvedTasks + stats.resolved} color={palette.statusClaimed} icon={<CheckCircle2 size={16} color={palette.statusClaimed} />} />
              <StatCard label="Queued" value={stats.queued} color={palette.warning} icon={<Clock size={16} color={palette.warning} />} />
            </>
          ) : (
            <>
              <StatCard label="Queued" value={stats.queued} color={palette.warning} icon={<Clock size={16} color={palette.warning} />} />
              <StatCard label="Claimed" value={stats.claimed} color={palette.crisisRescue} icon={<Activity size={16} color={palette.crisisRescue} />} />
              <StatCard label="Resolved" value={stats.resolved} color={palette.statusClaimed} icon={<CheckCircle2 size={16} color={palette.statusClaimed} />} />
              <StatCard label="Total" value={stats.total} color={palette.foreground} icon={<AlertTriangle size={16} color={palette.foreground} />} />
            </>
          )}
        </View>

        {activeTask ? (
          <View style={styles.activePanel}>
            <View style={{ flex: 1 }}>
              <Text style={styles.activeKicker}>YOUR ACTIVE TASK</Text>
              <Text style={styles.activeTitle}>
                {(CRISIS_META[activeTask.type] || CRISIS_META.rescue).label} response
              </Text>
              <Text style={styles.activeDesc} numberOfLines={2}>
                {activeTask.description}
              </Text>
              {routeRefreshing ? (
                <Text style={[styles.activeDesc, { color: palette.crisisRescue }]}>
                  Updating route…
                </Text>
              ) : routes[0]?.durationSec ? (
                <Text style={[styles.activeDesc, { color: palette.crisisRescue, fontWeight: "700" }]}>
                  ETA: {formatRouteDuration(routes[0].durationSec)}
                </Text>
              ) : null}
            </View>
            <Button
              title="Chat"
              size="sm"
              fullWidth={false}
              onPress={() => navigation.navigate("Chat", { requestId: activeTask.id })}
              leftIcon={<MessageSquare size={14} color="#03121C" />}
            />
          </View>
        ) : null}

        <View style={styles.mapHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.h2}>Live Crisis Map</Text>
            <Text style={styles.muted}>
              All active crises shown here. Your own requests appear in the feed below.
            </Text>
          </View>
          <View style={styles.brandPill}>
            <Radio size={12} color={palette.crisisRescue} />
            <Text style={styles.brandPillText}>LIVE</Text>
          </View>
        </View>

        <View style={{ marginBottom: spacing.sm }}>
          <LocationSearch
            onPick={(hit) => {
              setMyCoords({ latitude: hit.lat, longitude: hit.lng });
              mapRef.current?.animateTo(hit.lat, hit.lng);
            }}
          />
        </View>

        <CrisisMap
          ref={mapRef}
          requests={allActive}
          myCoords={myCoords}
          volunteers={volunteerMarkers}
          routes={routes}
          externalNav={
            routeTarget ? { lat: routeTarget.lat, lng: routeTarget.lng, label: "Crisis location" } : null
          }
          onMarkerPress={(r) => {
            mapRef.current?.animateTo(r.lat, r.lng);
            // If responder taps an unclaimed request, show claim option
            if (isResponder && (r.status === "QUEUED" || r.status === "ACTIVE") && !activeTask) {
              toast.info(`Crisis: ${r.description.slice(0, 40)}...`);
              // Navigate to Requests tab where they can claim
            }
          }}
          onMyLocation={(c) => setMyCoords(c)}
          height={340}
        />

        <View style={{ height: spacing.lg }} />

        <Card>
          <CardContent>
            <View style={styles.cardHeaderInline}>
              <View style={{ flex: 1 }}>
                <Text style={styles.h2}>Need Help?</Text>
                <Text style={styles.muted}>
                  {activeRequestCount > 0
                    ? `You have ${activeRequestCount} active request(s). New requests will be queued.`
                    : "Broadcast a crisis to nearby volunteers."}
                </Text>
              </View>
              <Siren size={22} color={palette.destructive} />
            </View>
            <Button
              title="Report a Crisis"
              size="lg"
              variant="primary"
              onPress={() => setModalOpen(true)}
              leftIcon={<Plus size={18} color="#03121C" />}
            />
          </CardContent>
        </Card>

        <View style={{ gap: spacing.md, marginTop: spacing.md }}>
          <Text style={styles.sectionHeader}>My Requests</Text>
          {myRequests.length === 0 ? (
            <Card>
              <CardContent>
                <View style={{ alignItems: "center", paddingVertical: spacing.lg, gap: spacing.sm }}>
                  <ShieldAlert size={28} color={palette.mutedForeground} />
                  <Text style={styles.muted}>You haven&apos;t reported any crises yet.</Text>
                </View>
              </CardContent>
            </Card>
          ) : (
            myRequests
              .slice(0, 8)
              .map((r) => (
                <RequestCard
                  key={r.id}
                  request={r}
                  onPress={() => mapRef.current?.animateTo(r.lat, r.lng)}
                  rightSlot={
                    r.status === "ACTIVE" || r.status === "CLAIMED" || r.status === "QUEUED" ? (
                      <View style={{ flexDirection: "row", gap: spacing.sm, flexWrap: "wrap", alignItems: "center" }}>
                        {r.status === "CLAIMED" ? (
                          <Button
                            title="Chat"
                            size="sm"
                            fullWidth={false}
                            onPress={() => navigation.navigate("Chat", { requestId: r.id })}
                            leftIcon={<MessageSquare size={14} color="#03121C" />}
                          />
                        ) : null}
                        {r.status === "QUEUED" ? (
                          <Text style={{ fontSize: 12, color: palette.mutedForeground, fontWeight: "600" }}>
                            In Queue
                          </Text>
                        ) : null}
                        <Button
                          title="Cancel"
                          size="sm"
                          variant="outline"
                          fullWidth={false}
                          onPress={() => cancelMyRequest(r.id)}
                          leftIcon={<X size={14} color={palette.foreground} />}
                        />
                      </View>
                    ) : null
                  }
                />
              ))
          )}
        </View>
      </Screen>

      <Modal
        visible={modalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setModalOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setModalOpen(false)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.h2}>Report a Crisis</Text>
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
              <Text style={styles.label}>Type</Text>
              <View style={styles.typeRow}>
                {CRISIS_TYPES.map((t) => {
                  const meta = CRISIS_META[t];
                  const Icon = meta.icon;
                  const active = t === type;
                  return (
                    <Pressable
                      key={t}
                      onPress={() => setType(t)}
                      style={[
                        styles.typeChip,
                        active && {
                          borderColor: meta.color,
                          backgroundColor: `${meta.color}22`,
                        },
                      ]}
                    >
                      <Icon size={16} color={active ? meta.color : palette.mutedForeground} />
                      <Text
                        style={[
                          styles.typeChipText,
                          active && { color: meta.color, fontWeight: "700" },
                        ]}
                      >
                        {meta.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.label}>Description</Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Describe the situation in detail..."
                placeholderTextColor={palette.mutedForeground}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                style={styles.textarea}
              />

              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Text style={styles.label}>Location</Text>
                <Pressable onPress={useMyLocationForPin} style={styles.useLoc} hitSlop={6}>
                  <Crosshair size={12} color={palette.crisisRescue} />
                  <Text style={styles.useLocText}>Use my location</Text>
                </Pressable>
              </View>

              <LocationSearch
                placeholder="Search address to drop pin…"
                onPick={(hit) => setPin({ lat: hit.lat, lng: hit.lng })}
              />

              <CrisisMap
                requests={allActive}
                myCoords={myCoords}
                pin={pin}
                onMapPress={(lat, lng) => setPin({ lat, lng })}
                onMyLocation={(c) => setMyCoords(c)}
                height={240}
                controls={true}
              />

              {pin ? (
                <Text style={[styles.muted, { marginTop: spacing.xs }]}>
                  Pin: {pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}
                </Text>
              ) : (
                <Text style={[styles.muted, { marginTop: spacing.xs }]}>
                  Tap the map to drop a pin
                </Text>
              )}

              <Button
                title="Broadcast Crisis"
                size="lg"
                variant="destructive"
                loading={submitting}
                onPress={submit}
                leftIcon={<Siren size={18} color="#fff" />}
                style={{ marginTop: spacing.md }}
              />
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function StatCard({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: number;
  color: string;
  icon: React.ReactNode;
}) {
  const styles = useStyles((c) => makeStyles(c));
  return (
    <View style={[styles.statCard, { borderColor: `${color}40` }]}>
      {icon}
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function formatRouteDuration(sec: number): string {
  const mins = Math.round(sec / 60);
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  const rem = mins - hrs * 60;
  return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`;
}

const makeStyles = (c: ColorPalette) =>
  StyleSheet.create({
    headerRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.lg },
    greeting: { ...typography.h1, color: c.foreground },
    subtitle: { ...typography.small, color: c.mutedForeground },
    brandPill: {
      flexDirection: "row", alignItems: "center", gap: spacing.xs,
      paddingHorizontal: spacing.md, paddingVertical: 4,
      borderRadius: radius.pill,
      backgroundColor: "rgba(43, 179, 242, 0.15)",
      borderWidth: 1, borderColor: "rgba(43, 179, 242, 0.35)",
    },
    brandPillText: { ...typography.caption, color: c.crisisRescue, fontWeight: "700" },

    statsRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginBottom: spacing.lg },
    statCard: {
      flex: 1, minWidth: 72, backgroundColor: c.surfaceGlass, borderWidth: 1,
      borderRadius: radius.md, padding: spacing.sm, gap: spacing.xs,
      alignItems: "center",
    },
    statLabel: { ...typography.caption, color: c.mutedForeground, textTransform: "none", fontSize: 10, textAlign: "center" },
    statValue: { ...typography.h1, fontSize: 20 },

    activePanel: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      backgroundColor: "rgba(43, 179, 242, 0.10)",
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: "rgba(43, 179, 242, 0.40)",
      padding: spacing.lg,
      marginBottom: spacing.lg,
    },
    activeKicker: { ...typography.caption, color: c.crisisRescue, fontWeight: "700" },
    activeTitle: { ...typography.h3, color: c.foreground, marginTop: 2 },
    activeDesc: { ...typography.small, color: c.mutedForeground, marginTop: 2 },

    mapHeader: { flexDirection: "row", alignItems: "center", marginBottom: spacing.md },
    sectionHeader: { ...typography.h2, color: c.foreground },
    cardHeaderInline: {
      flexDirection: "row", justifyContent: "space-between",
      alignItems: "center", marginBottom: spacing.md, gap: spacing.md,
    },
    h2: { ...typography.h2, color: c.foreground },
    muted: { ...typography.small, color: c.mutedForeground, marginTop: 2 },

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
    textarea: {
      minHeight: 90, borderWidth: 1, borderColor: c.input,
      backgroundColor: c.surface, borderRadius: radius.md,
      padding: spacing.md, color: c.foreground, fontSize: 15,
      marginTop: spacing.xs,
    },
    typeRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.xs },
    typeChip: {
      flexDirection: "row", alignItems: "center", gap: spacing.xs,
      paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
      borderRadius: radius.pill, borderWidth: 1, borderColor: c.border,
      backgroundColor: c.surface,
    },
    typeChipText: { ...typography.small, color: c.mutedForeground },

    useLoc: {
      flexDirection: "row", alignItems: "center", gap: 4,
      paddingHorizontal: spacing.sm, paddingVertical: 4,
      borderRadius: radius.pill,
      backgroundColor: "rgba(43, 179, 242, 0.15)",
      borderWidth: 1, borderColor: "rgba(43, 179, 242, 0.35)",
    },
    useLocText: { ...typography.caption, color: c.crisisRescue, textTransform: "none", fontWeight: "700" },
  });
