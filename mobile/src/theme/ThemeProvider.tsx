import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { StyleSheet } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  ColorPalette,
  _getActiveMode,
  _setActivePalette,
  darkColors,
  lightColors,
} from "@/theme";

export type ThemeMode = "dark" | "light";

type ThemeContextValue = {
  mode: ThemeMode;
  palette: ColorPalette;
  toggleMode: () => void;
  setMode: (mode: ThemeMode) => void;
  /**
   * The provider increments this every time the mode changes. Wrap your
   * NavigationContainer with `key={themeKey}` so the navigation tree
   * remounts and all components re-evaluate styles against the new palette.
   */
  themeKey: number;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "crisisgrid_theme_mode";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(_getActiveMode());
  const [themeKey, setThemeKey] = useState(0);

  useEffect(() => {
    (async () => {
      const stored = (await AsyncStorage.getItem(STORAGE_KEY)) as ThemeMode | null;
      if (stored === "light" || stored === "dark") {
        if (stored !== mode) {
          _setActivePalette(stored);
          setModeState(stored);
          setThemeKey((k) => k + 1);
        }
      }
    })();
    // run once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    _setActivePalette(next);
    setModeState(next);
    setThemeKey((k) => k + 1);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
  }, []);

  const toggleMode = useCallback(() => {
    setMode(mode === "dark" ? "light" : "dark");
  }, [mode, setMode]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      palette: mode === "light" ? lightColors : darkColors,
      toggleMode,
      setMode,
      themeKey,
    }),
    [mode, toggleMode, setMode, themeKey],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}

/**
 * Compose a StyleSheet that depends on the active palette. The factory is
 * re-run whenever the theme mode changes, returning a fresh frozen
 * StyleSheet for the new colors.
 */
export function useStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (c: ColorPalette) => T,
): T {
  const { palette } = useTheme();
  return useMemo(() => StyleSheet.create(factory(palette)) as T, [palette, factory]);
}
