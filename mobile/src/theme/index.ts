/**
 * Design tokens ported from the web app's CSS variables (src/index.css).
 * Values are converted from `hsl()` to hex / rgba equivalents so they can be
 * used directly in React Native StyleSheet.
 *
 * Two palettes are exported (light + dark). The active palette is selected
 * by the ThemeProvider in `@/theme/ThemeProvider`. The legacy `colors` const
 * still exists and tracks the active palette via a Proxy — when the theme
 * mode changes, the provider remounts the navigation tree (via a `key`) so
 * every component re-renders with the new values picked up through that
 * Proxy.
 */

export type ColorPalette = {
  background: string;
  surface: string;
  surfaceElevated: string;
  surfaceGlass: string;
  surfaceGlassBorder: string;
  card: string;
  cardForeground: string;

  foreground: string;
  mutedForeground: string;

  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  accent: string;

  destructive: string;
  destructiveForeground: string;
  success: string;
  warning: string;

  crisisMedical: string;
  crisisFoodWater: string;
  crisisRescue: string;
  statusClaimed: string;

  border: string;
  borderStrong: string;
  input: string;
  ring: string;

  overlay: string;
  transparent: string;

  /** Used by the BackgroundGradient blobs to tint the page in either mode. */
  gradientPrimary: string;
  gradientRescue: string;
  gradientMedical: string;
};

export const darkColors: ColorPalette = {
  background: "#0A0F1A",
  surface: "#111726",
  surfaceElevated: "#1A2235",
  surfaceGlass: "rgba(26, 34, 53, 0.85)",
  surfaceGlassBorder: "rgba(76, 96, 130, 0.45)",
  card: "#121A2C",
  cardForeground: "#F1F5F9",

  foreground: "#F1F5F9",
  mutedForeground: "#8A93A6",

  primary: "#F1F5F9",
  primaryForeground: "#0F172A",
  secondary: "#1E293B",
  secondaryForeground: "#F1F5F9",
  accent: "#1E293B",

  destructive: "#F23B3B",
  destructiveForeground: "#F8FAFC",
  success: "#2FB965",
  warning: "#F59E0B",

  crisisMedical: "#F23B3B",
  crisisFoodWater: "#F2A325",
  crisisRescue: "#2BB3F2",
  statusClaimed: "#31A865",

  border: "rgba(148, 163, 184, 0.15)",
  borderStrong: "rgba(148, 163, 184, 0.30)",
  input: "rgba(148, 163, 184, 0.20)",
  ring: "#2BB3F2",

  overlay: "rgba(5, 9, 18, 0.75)",
  transparent: "transparent",

  gradientPrimary: "#F1F5F9",
  gradientRescue: "#2BB3F2",
  gradientMedical: "#F23B3B",
};

export const lightColors: ColorPalette = {
  background: "#F4F6FB",
  surface: "#FFFFFF",
  surfaceElevated: "#FFFFFF",
  surfaceGlass: "rgba(255, 255, 255, 0.85)",
  surfaceGlassBorder: "rgba(15, 23, 42, 0.10)",
  card: "#FFFFFF",
  cardForeground: "#0F172A",

  foreground: "#0F172A",
  mutedForeground: "#64748B",

  primary: "#0F172A",
  primaryForeground: "#F8FAFC",
  secondary: "#E2E8F0",
  secondaryForeground: "#0F172A",
  accent: "#E2E8F0",

  destructive: "#DC2626",
  destructiveForeground: "#FFFFFF",
  success: "#16A34A",
  warning: "#D97706",

  crisisMedical: "#DC2626",
  crisisFoodWater: "#EA580C",
  crisisRescue: "#0284C7",
  statusClaimed: "#15803D",

  border: "rgba(15, 23, 42, 0.10)",
  borderStrong: "rgba(15, 23, 42, 0.18)",
  input: "rgba(15, 23, 42, 0.14)",
  ring: "#0284C7",

  overlay: "rgba(15, 23, 42, 0.45)",
  transparent: "transparent",

  gradientPrimary: "#0284C7",
  gradientRescue: "#0EA5E9",
  gradientMedical: "#DC2626",
};

/**
 * Live mutable target backing the `colors` Proxy. The ThemeProvider swaps
 * this in place and forces a navigator-tree remount so all consumers
 * (including module-level StyleSheet.create) pick up the new values on
 * their next evaluation.
 */
const _active: { palette: ColorPalette; mode: "dark" | "light" } = {
  palette: { ...lightColors },
  mode: "light",
};

/**
 * Public Proxy that always reads from the active palette. Existing imports
 * `import { colors } from "@/theme"` keep working; values stay reactive
 * once the navigator key remounts the tree.
 */
export const colors: ColorPalette = new Proxy(_active.palette, {
  get(_target, prop: string) {
    return (_active.palette as unknown as Record<string, string>)[prop];
  },
}) as ColorPalette;

export function _setActivePalette(mode: "dark" | "light") {
  _active.mode = mode;
  _active.palette = mode === "light" ? { ...lightColors } : { ...darkColors };
}

export function _getActiveMode(): "dark" | "light" {
  return _active.mode;
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  "2xl": 32,
  "3xl": 48,
};

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  pill: 999,
};

export const typography = {
  display: { fontSize: 32, fontWeight: "800" as const, letterSpacing: -0.5, lineHeight: 38 },
  h1: { fontSize: 26, fontWeight: "700" as const, letterSpacing: -0.3, lineHeight: 32 },
  h2: { fontSize: 20, fontWeight: "700" as const, lineHeight: 26 },
  h3: { fontSize: 17, fontWeight: "600" as const, lineHeight: 22 },
  body: { fontSize: 15, fontWeight: "400" as const, lineHeight: 22 },
  bodyStrong: { fontSize: 15, fontWeight: "600" as const, lineHeight: 22 },
  small: { fontSize: 13, fontWeight: "400" as const, lineHeight: 18 },
  caption: { fontSize: 11, fontWeight: "500" as const, lineHeight: 14, letterSpacing: 0.4 },
  mono: { fontSize: 22, fontWeight: "600" as const, letterSpacing: 6 },
};

export const shadows = {
  sm: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 4,
  },
  lg: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.30,
    shadowRadius: 24,
    elevation: 8,
  },
};

export const theme = { colors, spacing, radius, typography, shadows };
export type Theme = typeof theme;
