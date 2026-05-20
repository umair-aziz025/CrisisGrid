import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, AppStateStatus } from "react-native";

const INACTIVITY_MS = 15 * 60 * 1000; // 15 min total
const WARNING_MS = 60 * 1000; // last minute = warning

/**
 * Mobile-friendly session timeout. Mirrors the web hook but uses AppState
 * to reset the inactivity timer when the app foregrounds, plus an explicit
 * `bumpActivity` callback that consumers can call from UI handlers.
 */
export function useSessionTimeout(onExpire: () => void, enabled: boolean = true) {
  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(60);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  const clearCountdown = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  const startCountdown = useCallback(() => {
    setShowWarning(true);
    setSecondsLeft(Math.floor(WARNING_MS / 1000));
    clearCountdown();
    countdownRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearCountdown();
          setShowWarning(false);
          onExpireRef.current();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }, [clearCountdown]);

  const resetTimer = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    clearCountdown();
    setShowWarning(false);
    timeoutRef.current = setTimeout(startCountdown, INACTIVITY_MS - WARNING_MS);
  }, [clearCountdown, startCountdown]);

  const bumpActivity = useCallback(() => {
    if (!showWarning) resetTimer();
  }, [showWarning, resetTimer]);

  const extendSession = useCallback(() => {
    resetTimer();
  }, [resetTimer]);

  useEffect(() => {
    if (!enabled) return;
    resetTimer();

    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active" && !showWarning) resetTimer();
    });

    return () => {
      sub.remove();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      clearCountdown();
    };
  }, [enabled, resetTimer, clearCountdown, showWarning]);

  return { showWarning, secondsLeft, extendSession, bumpActivity };
}
