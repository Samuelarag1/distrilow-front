"use client";

import { useEffect, useRef } from "react";

const ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "keydown",
  "touchstart",
  "scroll",
] as const;

// Shared by every tab of the browser, because the session is shared too (one
// refresh cookie): "idle" means no activity in ANY tab, so a forgotten
// background tab can't log out the one being used (H1, invariant I4).
const LAST_ACTIVITY_KEY = "distrilow:lastActivityAt";
const ACTIVITY_WRITE_THROTTLE_MS = 5_000;
const CHECK_INTERVAL_MS = 15_000;

export const IDLE_LOGOUT_DEFAULT_MS = 20 * 60 * 1000;
// Decision of 2026-10-19: never log out for inactivity before 10 minutes,
// whatever the environment says. A 2-minute test value left in .env.local
// was closing sessions in the middle of normal work.
export const IDLE_LOGOUT_MIN_MS = 10 * 60 * 1000;

/** Idle timeout from NEXT_PUBLIC_IDLE_TIMEOUT_MS: 20 min if unset or invalid, never under 10 min. */
export function resolveIdleLogoutTimeoutMs(configured: string | undefined): number {
  const parsed = Number(configured);
  const timeoutMs = Number.isFinite(parsed) && parsed > 0 ? parsed : IDLE_LOGOUT_DEFAULT_MS;
  return Math.max(timeoutMs, IDLE_LOGOUT_MIN_MS);
}

function readSharedLastActivity(): number {
  try {
    const value = Number(window.localStorage.getItem(LAST_ACTIVITY_KEY));
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

function writeSharedLastActivity(at: number) {
  try {
    window.localStorage.setItem(LAST_ACTIVITY_KEY, String(at));
  } catch {
    // Storage unavailable: this tab still counts its own activity.
  }
}

interface UseIdleLogoutOptions {
  enabled: boolean;
  /**
   * This tab never logs out for inactivity and, while open, keeps the session
   * alive for every tab — used by the POS (decision D6): closing a management
   * tab for inactivity would end the POS session too, since it is the same one.
   */
  keepAlive?: boolean;
  timeoutMs: number;
  onIdle: () => void;
  /** Fired warnBeforeMs before onIdle, so the user gets a heads-up. Omit to skip the warning. */
  onWarn?: () => void;
  warnBeforeMs?: number;
}

/**
 * Fires onIdle after timeoutMs with no mouse/keyboard/touch/scroll activity in
 * any tab of this browser. Opening or reloading a tab counts as activity.
 */
export function useIdleLogout({
  enabled,
  keepAlive = false,
  timeoutMs,
  onIdle,
  onWarn,
  warnBeforeMs = 60_000,
}: UseIdleLogoutOptions) {
  // Latest callbacks live in refs: callers pass inline functions, and having
  // them as effect dependencies restarted the clock on every render (H9).
  const onIdleRef = useRef(onIdle);
  const onWarnRef = useRef(onWarn);
  useEffect(() => {
    onIdleRef.current = onIdle;
    onWarnRef.current = onWarn;
  });

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    let ownLastActivity = 0;
    let lastWriteAt = 0;
    let warned = false;
    let fired = false;

    const recordActivity = () => {
      const now = Date.now();
      ownLastActivity = now;
      if (now - lastWriteAt < ACTIVITY_WRITE_THROTTLE_MS) return;
      lastWriteAt = now;
      writeSharedLastActivity(now);
    };

    const check = () => {
      if (keepAlive) {
        recordActivity();
        return;
      }

      const idleForMs =
        Date.now() - Math.max(ownLastActivity, readSharedLastActivity());

      if (idleForMs >= timeoutMs) {
        if (!fired) {
          fired = true;
          onIdleRef.current();
        }
        return;
      }

      const warnAtMs = timeoutMs - warnBeforeMs;
      if (warnAtMs > 0 && idleForMs >= warnAtMs) {
        if (!warned && onWarnRef.current) {
          warned = true;
          onWarnRef.current();
        }
      } else {
        warned = false;
      }
    };

    // Without this, a timestamp left over from an old session could log the
    // user out right after signing in.
    recordActivity();

    ACTIVITY_EVENTS.forEach((event) =>
      window.addEventListener(event, recordActivity, { passive: true })
    );
    const intervalId = window.setInterval(check, CHECK_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
      ACTIVITY_EVENTS.forEach((event) =>
        window.removeEventListener(event, recordActivity)
      );
    };
  }, [enabled, keepAlive, timeoutMs, warnBeforeMs]);
}
