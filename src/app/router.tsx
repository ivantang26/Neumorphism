import { useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent } from "react";
import { ROOM_IDS, type RoomId } from "~/lib/home";

export type Route = { name: "dashboard" } | { name: "room"; id: RoomId } | { name: "settings" };

export function parseRoute(pathname: string): Route {
  const parts = pathname.replace(/^\/app\/?/, "").split("/").filter(Boolean);
  if (parts[0] === "room" && ROOM_IDS.includes(parts[1] as RoomId)) return { name: "room", id: parts[1] as RoomId };
  if (parts[0] === "settings") return { name: "settings" };
  return { name: "dashboard" };
}

export function routePath(r: Route): string {
  if (r.name === "room") return `/app/room/${r.id}`;
  if (r.name === "settings") return "/app/settings";
  return "/app";
}

const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  addEventListener("popstate", fn);
  return () => {
    listeners.delete(fn);
    removeEventListener("popstate", fn);
  };
};
const getPath = () => location.pathname;

export function navigate(path: string, { replace = false } = {}) {
  if (path === location.pathname) return;
  if (replace) history.replaceState(null, "", path);
  else history.pushState(null, "", path);
  for (const fn of listeners) fn();
}

export function useRoute(): Route {
  const path = useSyncExternalStore(subscribe, getPath, () => "/app");
  return parseRoute(path);
}

/** In-app link: a real <a href> (works in a new tab), handled client-side on a plain click. */
export function Link({ to, onClick, ...rest }: { to: string } & AnchorHTMLAttributes<HTMLAnchorElement>) {
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(to);
  };
  return <a href={to} onClick={handle} {...rest} />;
}
