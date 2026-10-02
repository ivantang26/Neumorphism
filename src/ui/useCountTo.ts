import { useEffect, useRef, useState } from "react";

const reduceMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Tween a displayed number to its new value (PRD §7: "the displayed temperature
 * counts to its new value"). Jumps straight there when `animate` is false or the
 * user prefers reduced motion.
 */
export function useCountTo(target: number, animate: boolean, duration = 320): number {
  const [shown, setShown] = useState(target);
  const from = useRef(target);
  const shownRef = useRef(target);
  shownRef.current = shown;

  useEffect(() => {
    if (!animate || reduceMotion() || typeof requestAnimationFrame !== "function") {
      setShown(target);
      return;
    }
    from.current = shownRef.current;
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      setShown(from.current + (target - from.current) * eased);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, animate, duration]);

  return shown;
}
