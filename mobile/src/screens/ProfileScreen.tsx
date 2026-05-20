import React, { useCallback, useEffect, useState } from "react";
import { Pressable, Switch, Text, View } from "react-native";
import * as Location from "expo-location";
import {
  ChevronRight,
  KeyRound,
  LogOut,
  Mail,
  MapPin,
  MessageSquare,
  Moon,
  ShieldCheck,
  Sun,
} from "lucide-react-native";

import { Screen } from "@/components/ui/Screen";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/Toast";
import { useVolunteerLocation } from "@/hooks/useVolunteerLocation";
import { api } from "@/api/client";
import { radius, spacing, typography } from "@/theme";
import { useStyles, useTheme } from "@/theme/ThemeProvider";
import { useNavigation } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const ON_DUTY_KEY = "crisisgrid_on_duty";

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const toast = useToast();
  const navigation = useNavigation<any>();
  const { palette, mode, toggleMode } = useTheme();

  const styles = useStyles((c) => ({
    title: { ...typography.h1, color: c.foreground, marginBottom: spacing.lg },
    stack: { gap: spacing.lg },
    profileRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: spacing.md,
    },
    avatar: {
      width: 56,
      height: 56,
      borderRadius: radius.pill,
      backgroundColor: "rgba(43, 179, 242, 0.18)",
      alignItems: "center" as const,
      justifyContent: "center" as const,
      borderWidth: 1,
      borderColor: "rgba(43, 179, 242, 0.4)",
    },
    avatarText: { ...typography.h2, color: c.crisisRescue },
    name: { ...typography.h3, color: c.foreground },
    profileMeta: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: spacing.xs,
      marginTop: 2,
    },
    metaText: { ...typography.small, color: c.mutedForeground },
    toggleRow: { flexDirection: "row" as const, alignItems: "center" as const },
    iconBubble: {
      width: 36,
      height: 36,
      borderRadius: radius.md,
      backgroundColor: "rgba(43, 179, 242, 0.15)",
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    h3: { ...typography.h3, color: c.foreground },
    muted: { ...typography.small, color: c.mutedForeground, marginTop: 2 },
    linkRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: spacing.md,
      paddingVertical: spacing.sm,
    },
    locationPill: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radius.pill,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      alignSelf: "flex-start" as const,
      marginTop: spacing.md,
    },
  }));

  const [available, setAvailable] = useState(false);
  const [updatingAvailability, setUpdatingAvailability] = useState(false);
  const [dutyLoaded, setDutyLoaded] = useState(false);

  const { coords, status, error: locationError } = useVolunteerLocation({
    enabled: available,
  });

  useEffect(() => {
    if (locationError && available) toast.error(locationError);
  }, [locationError, available, toast]);

  const role = (user?.role || "civilian").toUpperCase();
  const isVolunteer = role === "VOLUNTEER";
  const canToggleDuty = isVolunteer || role === "STAFF" || role === "ADMIN" || role === "SUPERADMIN";
  const initials = (user?.fullName || user?.name || user?.email || "?")
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  // Load persisted on-duty state on mount
  useEffect(() => {
    (async () => {
      if (!canToggleDuty) {
        setDutyLoaded(true);
        return;
      }
      try {
        const stored = await AsyncStorage.getItem(ON_DUTY_KEY);
        if (stored !== null) {
          const parsed = JSON.parse(stored);
          setAvailable(parsed === true);
          // Sync with backend silently
          api.setVolunteerAvailability(parsed === true).catch(() => undefined);
        } else {
          // Default to ON for volunteers on first login
          setAvailable(true);
          api.setVolunteerAvailability(true).catch(() => undefined);
          await AsyncStorage.setItem(ON_DUTY_KEY, JSON.stringify(true));
        }
      } catch {
        setAvailable(true);
      } finally {
        setDutyLoaded(true);
      }
    })();
  }, [canToggleDuty]);

  const toggleAvailability = useCallback(
    async (next: boolean) => {
      setUpdatingAvailability(true);
      try {
        if (next) {
          // Request foreground + background location permissions before going on duty
          const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
          if (fgStatus !== "granted") {
            toast.error("Location permission required to go on duty");
            setUpdatingAvailability(false);
            return;
          }
          const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
          if (bgStatus !== "granted") {
            toast.info("Background location not granted — tracking will pause when app is minimized");
            // Still allow on-duty but warn user
          }
        }
        await api.setVolunteerAvailability(next);
        setAvailable(next);
        await AsyncStorage.setItem(ON_DUTY_KEY, JSON.stringify(next));
        toast.success(
          next ? "You're now on duty — sharing live location" : "Marked unavailable",
        );
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to update availability");
      } finally {
        setUpdatingAvailability(false);
      }
    },
    [toast],
  );

  const handleSignOut = async () => {
    await signOut();
    toast.info("Signed out");
  };

  const trackingLabel =
    status === "tracking"
      ? coords
        ? `Live: ${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`
        : "Acquiring GPS…"
      : status === "permission_denied"
      ? "Location permission denied"
      : status === "unavailable"
      ? "Location services disabled"
      : "Off duty";

  return (
    <Screen>
      <Text style={styles.title}>Profile</Text>

      <View style={styles.stack}>
        <Card>
          <CardContent>
            <View style={styles.profileRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials || "U"}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{user?.fullName || user?.name || "Responder"}</Text>
                <View style={styles.profileMeta}>
                  <Mail size={12} color={palette.mutedForeground} />
                  <Text style={styles.metaText}>{user?.email}</Text>
                </View>
                {user?.publicId ? (
                  <Text style={styles.metaText}>ID: {user.publicId}</Text>
                ) : null}
              </View>
              <Badge label={role} color={palette.crisisRescue} variant="soft" />
            </View>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <View style={styles.toggleRow}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, flex: 1 }}
              >
                <View style={styles.iconBubble}>
                  {mode === "light" ? (
                    <Sun size={18} color={palette.crisisFoodWater} />
                  ) : (
                    <Moon size={18} color={palette.crisisRescue} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.h3}>Appearance</Text>
                  <Text style={styles.muted}>
                    {mode === "light" ? "Light theme" : "Dark theme"} — tap to switch.
                  </Text>
                </View>
              </View>
              <Switch
                value={mode === "light"}
                onValueChange={toggleMode}
                trackColor={{ false: palette.border, true: palette.crisisRescue }}
                thumbColor="#fff"
              />
            </View>
          </CardContent>
        </Card>

        {canToggleDuty && dutyLoaded ? (
          <Card>
            <CardContent>
              <View style={styles.toggleRow}>
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, flex: 1 }}
                >
                  <View style={styles.iconBubble}>
                    <ShieldCheck size={18} color={palette.statusClaimed} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.h3}>On Duty</Text>
                    <Text style={styles.muted}>
                      Share your live location so dispatch can route you to nearby crises.
                    </Text>
                  </View>
                </View>
                <Switch
                  value={available}
                  onValueChange={toggleAvailability}
                  disabled={updatingAvailability}
                  trackColor={{ false: palette.border, true: palette.statusClaimed }}
                  thumbColor="#fff"
                />
              </View>
              <View style={styles.locationPill}>
                <MapPin
                  size={12}
                  color={available ? palette.statusClaimed : palette.mutedForeground}
                />
                <Text style={[styles.muted, { marginTop: 0 }]}>{trackingLabel}</Text>
              </View>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardContent>
            <Text style={styles.h3}>Account & Security</Text>
            <ProfileLink
              icon={<ShieldCheck size={18} color={palette.statusClaimed} />}
              label="Two-Factor Authentication"
              styles={styles}
              palette={palette}
              onPress={() => navigation.navigate("TwoFactorSettings")}
            />
            <ProfileLink
              icon={<KeyRound size={18} color={palette.crisisRescue} />}
              label="Change Password"
              styles={styles}
              palette={palette}
              onPress={() => navigation.navigate("ChangePassword")}
            />
            <ProfileLink
              icon={<MapPin size={18} color={palette.crisisFoodWater} />}
              label="Safe Zones"
              styles={styles}
              palette={palette}
              onPress={() => navigation.navigate("SafeZones")}
            />
            <ProfileLink
              icon={<MessageSquare size={18} color={palette.crisisRescue} />}
              label="Contact CrisisGrid"
              styles={styles}
              palette={palette}
              onPress={() => navigation.navigate("Contact")}
            />
          </CardContent>
        </Card>

        <View style={{ marginTop: spacing.md }}>
          <Button
            title="Sign Out"
            variant="outline"
            size="lg"
            onPress={handleSignOut}
            leftIcon={<LogOut size={16} color={palette.foreground} />}
          />
        </View>
      </View>
    </Screen>
  );
}

function ProfileLink({
  icon,
  label,
  onPress,
  styles,
  palette,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  styles: any;
  palette: any;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.linkRow, pressed && { opacity: 0.7 }]}
    >
      <View style={styles.iconBubble}>{icon}</View>
      <Text style={[styles.h3, { flex: 1, fontSize: 15 }]}>{label}</Text>
      <ChevronRight size={18} color={palette.mutedForeground} />
    </Pressable>
  );
}
