import { useEffect, useRef } from "react";
import { CloudSunIcon as CloudSun, CornersOutIcon as CornersOut, GearIcon as Gear, WifiSlashIcon as WifiSlash } from "@phosphor-icons/react/ssr";
import type { HomeState } from "~/lib/home";
import { formatTemp } from "~/lib/dial";
import { applyPrefs, contrastActive, readPrefs, track, watchSystemContrast } from "~/lib/prefs";
import { Button } from "~/ui/Button";
import { ToastProvider } from "~/ui/Toast";
import { Dashboard, ModeControl, Scenes } from "./Dashboard";
import { HubProvider, useHub } from "./hub";
import { enterFullscreen, Kiosk } from "./Kiosk";
import { RoomDetail } from "./RoomDetail";
import { Link, navigate, useRoute, type Route } from "./router";
import { Settings, usePrefs } from "./Settings";
import { useLayout } from "./useMedia";
import styles from "./App.module.css";

export default function App() {
  return (
    <ToastProvider>
      <HubProvider>
        <Shell />
      </HubProvider>
    </ToastProvider>
  );
}

function Shell() {
  const { home, status, lastSync, reconnect } = useHub();
  const route = useRoute();
  const layout = useLayout();
  const prefs = usePrefs();

  useEffect(() => {
    applyPrefs(readPrefs());
    track("dashboard_view");
    try {
      if (contrastActive(readPrefs().contrast) && !sessionStorage.getItem("thermo:hc-tracked")) {
        sessionStorage.setItem("thermo:hc-tracked", "1");
        track("high_contrast_on");
      }
    } catch {
      // Session storage blocked: skip the metric.
    }
    return watchSystemContrast();
  }, []);

  // Page title follows the view, so screen reader users hear where they are.
  const roomName = route.name === "room" ? home?.rooms.find((r) => r.id === route.id)?.name : null;
  useEffect(() => {
    document.title = route.name === "room" && roomName ? `${roomName} · Thermo` : route.name === "settings" ? "Settings · Thermo" : "Thermo";
  }, [route.name, roomName]);

  // Move focus to the opened view (the tablet <dialog> does this itself).
  const routeKey = route.name === "room" ? `room:${route.id}` : route.name;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (routeKey !== "dashboard" && layout !== "tablet") document.getElementById("panel-title")?.focus();
  }, [routeKey]);

  const close = () => navigate("/app");
  const panelOpen = route.name !== "dashboard";
  // Phones: the room or settings view replaces the dashboard (a full page).
  const fullPage = layout === "phone" && panelOpen;

  return (
    <div className={styles.shell} data-layout={layout}>
      <a href="#main" className="skip-link">
        Skip to controls
      </a>
      {status !== "online" && <OfflineBanner status={status} lastSync={lastSync} hasData={!!home} onRetry={reconnect} />}

      {!fullPage && <TopBar home={home} layout={layout} kiosk={prefs.kiosk} />}

      <main id="main" className={styles.main} data-panel={panelOpen && layout === "desktop" ? "open" : undefined}>
        {!home ? (
          <Skeleton />
        ) : fullPage ? (
          <Panel route={route} home={home} closeStyle="back" onClose={close} />
        ) : (
          <>
            <h1 className="visually-hidden">{home.name} controls</h1>
            <Dashboard home={home} openRoom={route.name === "room" ? route.id : null} sceneInHeader={layout === "desktop"} />
            {panelOpen && layout === "desktop" && (
              <aside className={styles.sidePanel} aria-labelledby="panel-title">
                <Panel route={route} home={home} closeStyle="close" onClose={close} />
              </aside>
            )}
          </>
        )}
      </main>

      {home && panelOpen && layout === "tablet" && (
        <SideSheet onClose={close}>
          <Panel route={route} home={home} closeStyle="close" onClose={close} />
        </SideSheet>
      )}

      {prefs.kiosk && <Kiosk home={home} />}
    </div>
  );
}

function Panel({ route, home, closeStyle, onClose }: { route: Route; home: HomeState; closeStyle: "back" | "close"; onClose: () => void }) {
  if (route.name === "settings") return <Settings onClose={onClose} closeStyle={closeStyle} headingId="panel-title" />;
  if (route.name === "room") {
    const room = home.rooms.find((r) => r.id === route.id);
    if (room) return <RoomDetail key={room.id} home={home} room={room} onClose={onClose} closeStyle={closeStyle} headingId="panel-title" />;
  }
  return null;
}

function TopBar({ home, layout, kiosk }: { home: HomeState | null; layout: string; kiosk: boolean }) {
  return (
    <header className={styles.topBar}>
      <div className={styles.homeLine}>
        <p className={styles.homeName}>{home?.name ?? "Thermo"}</p>
        {home && (
          <p className={styles.outdoor}>
            <CloudSun weight="bold" aria-hidden="true" />
            <span className="tabular">{formatTemp(home.outdoor)}°C</span> outside
          </p>
        )}
        <div className={styles.topActions}>
          {kiosk && layout !== "phone" && (
            <Button icon={<CornersOut weight="bold" />} onPress={enterFullscreen}>
              Full screen
            </Button>
          )}
          <Link to="/app/settings" className={styles.settingsLink}>
            <Gear weight="bold" aria-hidden="true" />
            <span>Settings</span>
          </Link>
        </div>
      </div>
      {home && (
        <div className={styles.modeRow}>
          <ModeControl home={home} />
          {layout === "desktop" && <Scenes />}
        </div>
      )}
    </header>
  );
}

function OfflineBanner({
  status,
  lastSync,
  hasData,
  onRetry,
}: {
  status: "connecting" | "offline" | "online";
  lastSync: number | null;
  hasData: boolean;
  onRetry: () => void;
}) {
  const when = lastSync ? new Date(lastSync).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : null;
  return (
    <div className={styles.banner} role="status" data-status={status}>
      {status === "offline" && <WifiSlash weight="bold" aria-hidden="true" className={styles.bannerIcon} />}
      <p>
        {status === "connecting" ? (
          <strong>Connecting to your hub…</strong>
        ) : (
          <>
            <strong>Offline.</strong>{" "}
            {hasData && when ? `Showing what Thermo knew at ${when}. ` : ""}
            Controls come back when the hub reconnects.
          </>
        )}
      </p>
      {status === "offline" && <Button onPress={onRetry}>Try again</Button>}
    </div>
  );
}

/** Tablet side sheet: a modal <dialog> (focus trap, Esc, inert page) sliding in from the right. */
function SideSheet({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<Element | null>(null);
  useEffect(() => {
    const d = ref.current!;
    opener.current = document.activeElement;
    if (!d.open) d.showModal();
    d.querySelector<HTMLElement>("#panel-title")?.focus();
    return () => {
      d.close();
      (opener.current as HTMLElement | null)?.focus?.();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={styles.sheet}
      aria-labelledby="panel-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => e.target === ref.current && onClose()}
    >
      <div className={styles.sheetInner}>{children}</div>
    </dialog>
  );
}

function Skeleton() {
  return (
    <div className={styles.skeleton} aria-hidden="true">
      <div className={styles.skelDial} />
      <div className={styles.skelGrid}>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className={styles.skelCard} />
        ))}
      </div>
    </div>
  );
}
