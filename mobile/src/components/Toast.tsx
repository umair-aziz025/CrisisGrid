import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Animated, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CheckCircle2, AlertTriangle, Info } from "lucide-react-native";
import { radius, spacing, shadows, typography } from "@/theme";
import { useStyles, useTheme } from "@/theme/ThemeProvider";

type ToastVariant = "success" | "error" | "info";
type ToastPayload = { id: number; message: string; variant: ToastVariant };

type ToastContextValue = {
  show: (message: string, variant?: ToastVariant) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastPayload | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();
  const idRef = useRef(0);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { palette } = useTheme();

  const show = useCallback(
    (message: string, variant: ToastVariant = "info") => {
      idRef.current += 1;
      setToast({ id: idRef.current, message, variant });
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
      hideTimerRef.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => {
          setToast(null);
        });
      }, 2800);
    },
    [opacity],
  );

  useEffect(
    () => () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    },
    [],
  );

  const value: ToastContextValue = {
    show,
    success: (m) => show(m, "success"),
    error: (m) => show(m, "error"),
    info: (m) => show(m, "info"),
  };

  const Icon = toast?.variant === "success" ? CheckCircle2 : toast?.variant === "error" ? AlertTriangle : Info;
  const accent =
    toast?.variant === "success"
      ? palette.statusClaimed
      : toast?.variant === "error"
      ? palette.destructive
      : palette.crisisRescue;

  const styles = useStyles((c) => ({
    wrapper: {
      position: "absolute" as const,
      left: 0,
      right: 0,
      alignItems: "center" as const,
      paddingHorizontal: spacing.lg,
      zIndex: 9999,
    },
    toast: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: spacing.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      backgroundColor: c.surfaceElevated,
      borderRadius: radius.lg,
      borderWidth: 1,
      maxWidth: 480,
      width: "100%" as const,
      ...shadows.lg,
    },
    message: {
      ...typography.body,
      color: c.foreground,
      flexShrink: 1,
    },
  }));

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast && (
        <Animated.View
          pointerEvents="none"
          style={[styles.wrapper, { bottom: insets.bottom + 80, opacity }]}
        >
          <View style={[styles.toast, { borderColor: accent }]}>
            <Icon size={18} color={accent} />
            <Text style={styles.message} numberOfLines={3}>
              {toast.message}
            </Text>
          </View>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
