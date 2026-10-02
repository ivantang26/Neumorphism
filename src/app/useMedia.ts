import { useSyncExternalStore } from "react";

export function useMedia(query: string, serverValue = false): boolean {
  return useSyncExternalStore(
    (fn) => {
      const mq = matchMedia(query);
      mq.addEventListener("change", fn);
      return () => mq.removeEventListener("change", fn);
    },
    () => matchMedia(query).matches,
    () => serverValue,
  );
}

/** PRD §6 device classes. */
export function useLayout(): "phone" | "tablet" | "desktop" {
  const tablet = useMedia("(min-width: 700px)");
  const desktop = useMedia("(min-width: 1200px)");
  return desktop ? "desktop" : tablet ? "tablet" : "phone";
}
