import { useEffect, useRef, useState } from "react";
import { averageTemp, type HomeState } from "~/lib/home";
import { formatTemp } from "~/lib/dial";
import styles from "./Kiosk.module.css";

export const DIM_AFTER = 2 * 60 * 1000;

export function enterFullscreen() {
  document.documentElement.requestFullscreen?.({ navigationUI: "hide" }).catch(() => {
    // Refused (iOS Safari, or not from a tap): the installed PWA opens full screen anyway.
  });
}

/**
 * Wall-tablet behaviour (FR-6): keep the screen awake, dim after 2 minutes idle,
 * and wake on a tap. The waking tap is swallowed by the overlay so it can't
 * change a setting by accident.
 */
export function Kiosk({ home }: { home: HomeState | null }) {
  const [dimmed, setDimmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const reset = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setDimmed(true), DIM_AFTER);
    };
    const events = ["pointerdown", "keydown", "wheel"] as const;
    for (const e of events) addEventListener(e, reset, { passive: true, capture: true });
    reset();

    // Screen Wake Lock: our own dimming replaces the OS turning the screen off.
    let lock: WakeLockSentinel | null = null;
    const acquire = async () => {
      try {
        if (document.visibilityState === "visible") lock = (await navigator.wakeLock?.request("screen")) ?? null;
      } catch {
        // Not supported or refused: the tablet's own sleep setting applies.
      }
    };
    acquire();
    document.addEventListener("visibilitychange", acquire);

    return () => {
      for (const e of events) removeEventListener(e, reset, { capture: true });
      if (timer.current) clearTimeout(timer.current);
      document.removeEventListener("visibilitychange", acquire);
      lock?.release().catch(() => {});
    };
  }, []);

  // Keep the dimmed clock current.
  const [, setTick] = useState(0);
  useEffect(() => {
    document.documentElement.toggleAttribute("data-dimmed", dimmed);
    if (!dimmed) return;
    const t = setInterval(() => setTick((n) => n + 1), 20_000);
    return () => clearInterval(t);
  }, [dimmed]);

  if (!dimmed) return null;
  const time = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return (
    <div
      className={styles.dim}
      role="button"
      tabIndex={0}
      aria-label="Screen dimmed. Tap to wake."
      onPointerDown={(e) => e.preventDefault()}
      onClick={(e) => {
        e.stopPropagation();
        setDimmed(false);
      }}
      onKeyDown={() => setDimmed(false)}
      ref={(el) => el?.focus()}
    >
      <p className={`${styles.time} tabular`}>{time}</p>
      {home && <p className={`${styles.temp} tabular`}>{formatTemp(averageTemp(home))}°C inside</p>}
      <p className={styles.hint}>Tap to wake</p>
    </div>
  );
}
