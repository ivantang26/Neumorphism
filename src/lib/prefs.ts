// Per-device preferences. They live on the device (a wall tablet and a phone in
// the same home can differ), so localStorage is the right home, not the hub.

export type ContrastPref = "auto" | "on" | "off";

export interface Prefs {
  contrast: ContrastPref;
  kiosk: boolean;
  haptics: boolean;
}

const KEY = "thermo:prefs";
export const DEFAULT_PREFS: Prefs = { contrast: "auto", kiosk: false, haptics: true };

export function readPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : { ...DEFAULT_PREFS };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

const listeners = new Set<(p: Prefs) => void>();

export function writePrefs(patch: Partial<Prefs>): Prefs {
  const next = { ...readPrefs(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Private mode: the change still applies for this visit.
  }
  applyPrefs(next);
  for (const fn of listeners) fn(next);
  return next;
}

export function onPrefs(fn: (p: Prefs) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function contrastActive(pref: ContrastPref): boolean {
  if (pref === "on") return true;
  if (pref === "off") return false;
  return typeof matchMedia === "function" && matchMedia("(prefers-contrast: more)").matches;
}

/** Reflect prefs on <html>. The same logic runs inline in <head> before first paint. */
export function applyPrefs(p: Prefs, kioskAllowed = document.documentElement.hasAttribute("data-app")) {
  const root = document.documentElement;
  root.dataset.contrast = contrastActive(p.contrast) ? "more" : "normal";
  if (p.kiosk && kioskAllowed) root.dataset.kiosk = "";
  else delete root.dataset.kiosk;
}

/** Inline <head> script: sets data-contrast / data-kiosk before the page paints. */
export const PREFS_HEAD_SCRIPT = `(function(){try{var p=JSON.parse(localStorage.getItem("${KEY}")||"{}");var c=p.contrast||"auto";var r=document.documentElement;var m=c==="on"||(c==="auto"&&matchMedia("(prefers-contrast: more)").matches);r.dataset.contrast=m?"more":"normal";if(p.kiosk&&r.hasAttribute("data-app"))r.dataset.kiosk="";if(/[?&]kiosk=1/.test(location.search)&&r.hasAttribute("data-app")){r.dataset.kiosk="";p.kiosk=true;localStorage.setItem("${KEY}",JSON.stringify(p));}}catch(e){}})();`;

/** Keep "auto" in step with the OS setting while the page is open. */
export function watchSystemContrast(): () => void {
  if (typeof matchMedia !== "function") return () => {};
  const mq = matchMedia("(prefers-contrast: more)");
  const fn = () => applyPrefs(readPrefs());
  mq.addEventListener("change", fn);
  return () => mq.removeEventListener("change", fn);
}

export function haptic(ms = 8) {
  try {
    if (readPrefs().haptics && "vibrate" in navigator) navigator.vibrate(ms);
  } catch {
    // Not supported: silent.
  }
}

/** Anonymous metric counter (see server/api.ts). Fire-and-forget. */
export function track(name: string) {
  try {
    const body = JSON.stringify({ name });
    if (!navigator.sendBeacon?.("/api/event", new Blob([body], { type: "application/json" })))
      fetch("/api/event", { method: "POST", body, keepalive: true, headers: { "content-type": "application/json" } });
  } catch {
    // Metrics never break the page.
  }
}
