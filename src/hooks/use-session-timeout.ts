import { useCallback, useEffect, useRef, useState } from "react";

const INACTIVITY_MS = 15 * 60 * 1000;
const WARNING_MS = 60 * 1000;

const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  "mousemove",
  "mousedown",
  "keydown",
  "touchstart",
  "scroll",
  "click",
];

export function useSessionTimeout(onExpire: () => void) {
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
    setSecondsLeft(60);
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

  const extendSession = useCallback(() => {
    resetTimer();
  }, [resetTimer]);

  useEffect(() => {
    resetTimer();

    const handleActivity = () => {
      if (!showWarning) resetTimer();
    };

    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, handleActivity, { passive: true }));

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      clearCountdown();
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, handleActivity));
    };
  }, [resetTimer, clearCountdown, showWarning]);

  return { showWarning, secondsLeft, extendSession };
}
