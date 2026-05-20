import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { MapPin, Search, X } from "lucide-react-native";

import { radius, spacing, typography } from "@/theme";
import { useStyles, useTheme } from "@/theme/ThemeProvider";

export type LocationHit = {
  name: string;
  lat: number;
  lng: number;
};

type Props = {
  onPick: (hit: LocationHit) => void;
  placeholder?: string;
};

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

/**
 * Free, key-less location search powered by OpenStreetMap's Nominatim
 * service. We keep the rate limit low (1 req/keystroke after a 350ms
 * debounce) and identify ourselves with a User-Agent header per Nominatim's
 * usage policy. For higher-volume use, swap to Google Places by
 * configuring EXPO_PUBLIC_GOOGLE_PLACES_KEY and replacing this component.
 */
export function LocationSearch({ onPick, placeholder = "Search address or place…" }: Props) {
  const { palette } = useTheme();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<LocationHit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const reqIdRef = useRef(0);

  const styles = useStyles((c) => ({
    wrap: { width: "100%" as const, zIndex: 5 },
    input: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: spacing.sm,
      backgroundColor: c.surface,
      borderColor: c.border,
      borderWidth: 1,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      height: 44,
    },
    field: { flex: 1, color: c.foreground, fontSize: 15, paddingVertical: 0 },
    dropdown: {
      backgroundColor: c.surfaceElevated,
      borderColor: c.surfaceGlassBorder,
      borderWidth: 1,
      borderRadius: radius.md,
      marginTop: spacing.xs,
      maxHeight: 240,
      overflow: "hidden" as const,
    },
    item: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderBottomColor: c.border,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    itemText: { ...typography.small, color: c.foreground, flex: 1 },
    empty: { ...typography.small, color: c.mutedForeground, padding: spacing.md, textAlign: "center" as const },
  }));

  useEffect(() => {
    if (!query.trim() || query.trim().length < 3) {
      setHits([]);
      setOpen(false);
      return;
    }
    const id = ++reqIdRef.current;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `${NOMINATIM_URL}?format=json&limit=6&q=${encodeURIComponent(query.trim())}`,
          {
            headers: {
              "User-Agent": "CrisisGrid-Mobile/1.0 (https://github.com/umair-aziz025/aidbridge)",
              "Accept-Language": "en",
            },
          },
        );
        if (id !== reqIdRef.current) return;
        const json = await res.json();
        const list: LocationHit[] = (Array.isArray(json) ? json : []).map((row: any) => ({
          name: row.display_name as string,
          lat: parseFloat(row.lat),
          lng: parseFloat(row.lon),
        }));
        setHits(list);
        setOpen(true);
      } catch {
        if (id !== reqIdRef.current) return;
        setHits([]);
        setOpen(true);
      } finally {
        if (id === reqIdRef.current) setLoading(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [query]);

  const pick = useCallback(
    (h: LocationHit) => {
      onPick(h);
      setOpen(false);
      setQuery(h.name.split(",").slice(0, 2).join(", "));
    },
    [onPick],
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.input}>
        <Search size={16} color={palette.mutedForeground} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={placeholder}
          placeholderTextColor={palette.mutedForeground}
          style={styles.field}
          onFocus={() => hits.length && setOpen(true)}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {loading ? (
          <ActivityIndicator size="small" color={palette.crisisRescue} />
        ) : query ? (
          <Pressable
            onPress={() => {
              setQuery("");
              setHits([]);
              setOpen(false);
            }}
            hitSlop={6}
          >
            <X size={14} color={palette.mutedForeground} />
          </Pressable>
        ) : null}
      </View>

      {open ? (
        <View style={styles.dropdown}>
          {hits.length === 0 ? (
            <Text style={styles.empty}>No matching places. Try a different query.</Text>
          ) : (
            hits.map((h, i) => (
              <Pressable
                key={`${h.lat}-${h.lng}-${i}`}
                onPress={() => pick(h)}
                style={({ pressed }) => [styles.item, pressed && { opacity: 0.6 }]}
              >
                <MapPin size={14} color={palette.crisisRescue} />
                <Text style={styles.itemText} numberOfLines={2}>
                  {h.name}
                </Text>
              </Pressable>
            ))
          )}
        </View>
      ) : null}
    </View>
  );
}
