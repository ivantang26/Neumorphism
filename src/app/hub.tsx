import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import type { Action, HomeState } from "~/lib/home";
import { HubClient, type Snapshot } from "~/lib/sync";
import { useToast } from "~/ui/Toast";

interface HubApi {
  home: HomeState | null;
  status: Snapshot["status"];
  lastSync: number | null;
  /** True whenever controls must not be used (offline or still connecting). */
  locked: boolean;
  send: (action: Action) => boolean;
  reconnect: () => void;
}

const Ctx = createContext<HubApi | null>(null);

let client: HubClient | null = null;
function getClient(): HubClient {
  if (!client) {
    const proto = location.protocol === "https:" ? "wss" : "ws";
    client = new HubClient({ url: `${proto}://${location.host}/hub`, storage: localStorage });
  }
  return client;
}

export function HubProvider({ children }: { children: ReactNode }) {
  const hub = getClient();
  const toast = useToast();
  const snap = useSyncExternalStore(hub.subscribe, hub.getSnapshot, hub.getSnapshot);

  useEffect(() => {
    hub.connect();
    const offError = hub.onError((message) => toast(message, "error"));
    const online = () => hub.reconnect();
    const offline = () => hub.goOffline();
    // Coming back to a tab that slept (phones, tablets) should reconnect straight away.
    const visible = () =>
      document.visibilityState === "visible" && hub.getSnapshot().status !== "online" && hub.reconnect();
    addEventListener("online", online);
    addEventListener("offline", offline);
    document.addEventListener("visibilitychange", visible);
    return () => {
      offError();
      removeEventListener("online", online);
      removeEventListener("offline", offline);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [hub, toast]);

  const api = useMemo<HubApi>(
    () => ({
      home: snap.view,
      status: snap.status,
      lastSync: snap.lastSync,
      locked: snap.status !== "online",
      send: (a) => hub.send(a),
      reconnect: () => hub.reconnect(),
    }),
    [snap, hub],
  );

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useHub(): HubApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("useHub outside HubProvider");
  return v;
}
