"use client";

import { useEffect, useRef } from "react";

const ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "keydown",
  "touchstart",
  "scroll",
] as const;

interface UseIdleLogoutOptions {
  enabled: boolean;
  timeoutMs: number;
  onIdle: () => void;
  /** Fired warnBeforeMs before onIdle, so the user gets a heads-up. Omit to skip the warning. */
  onWarn?: () => void;
  warnBeforeMs?: number;
}

/**
 * Fires onIdle after timeoutMs of no mouse/keyboard/touch/scroll activity.
 * Any activity resets the clock. Applies everywhere the app is mounted,
 * including POS — an unattended, still-logged-in retail terminal is exactly
 * the case this exists to close.
 */
export function useIdleLogout({
  enabled,
  timeoutMs,
  onIdle,
  onWarn,
  warnBeforeMs = 60_000,
}: UseIdleLogoutOptions) {
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const clearTimers = () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      if (warnTimer.current) clearTimeout(warnTimer.current);
    };

    const resetTimers = () => {
      clearTimers();
      idleTimer.current = setTimeout(onIdle, timeoutMs);
      if (onWarn && timeoutMs > warnBeforeMs) {
        warnTimer.current = setTimeout(onWarn, timeoutMs - warnBeforeMs);
      }
    };

    ACTIVITY_EVENTS.forEach((event) =>
      window.addEventListener(event, resetTimers, { passive: true })
    );
    resetTimers();

    return () => {
      clearTimers();
      ACTIVITY_EVENTS.forEach((event) =>
        window.removeEventListener(event, resetTimers)
      );
    };
  }, [enabled, timeoutMs, onIdle, onWarn, warnBeforeMs]);
}
