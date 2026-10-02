import { useEffect, useState } from "react";
import { ArrowLeftIcon as ArrowLeft, CornersOutIcon as CornersOut, XIcon as X } from "@phosphor-icons/react/ssr";
import { contrastActive, onPrefs, readPrefs, writePrefs, type ContrastPref, type Prefs } from "~/lib/prefs";
import { Button } from "~/ui/Button";
import { Card } from "~/ui/Card";
import { SegmentedControl } from "~/ui/SegmentedControl";
import { Toggle } from "~/ui/Toggle";
import { useHub } from "./hub";
import { useMedia } from "./useMedia";
import { enterFullscreen } from "./Kiosk";
import styles from "./Settings.module.css";

export function usePrefs(): Prefs {
  const [prefs, setPrefs] = useState<Prefs>(readPrefs);
  useEffect(() => onPrefs(setPrefs), []);
  return prefs;
}

export function Settings({ onClose, closeStyle, headingId }: { onClose: () => void; closeStyle: "back" | "close"; headingId: string }) {
  const prefs = usePrefs();
  const { home, send, locked, status, lastSync } = useHub();
  const systemMore = useMedia("(prefers-contrast: more)");
  const canVibrate = typeof navigator !== "undefined" && "vibrate" in navigator;

  return (
    <div className={styles.settings}>
      <header className={styles.header}>
        {closeStyle === "back" && (
          <Button icon={<ArrowLeft weight="bold" />} onPress={onClose}>
            Home
          </Button>
        )}
        <h2 id={headingId} className={styles.title} tabIndex={-1}>
          Settings
        </h2>
        {closeStyle === "close" && (
          <Button icon={<X weight="bold" />} onPress={onClose}>
            Close
          </Button>
        )}
      </header>

      <Card as="section" aria-labelledby="set-display" className={styles.section}>
        <h3 id="set-display" className={styles.sectionTitle}>
          Display on this device
        </h3>
        <SegmentedControl<ContrastPref>
          label="High contrast"
          fill
          value={prefs.contrast}
          onChange={(contrast) => writePrefs({ contrast })}
          options={[
            { value: "auto", label: "Auto" },
            { value: "on", label: "On" },
            { value: "off", label: "Off" },
          ]}
        />
        <p className={styles.help}>
          High contrast swaps soft shadows for solid borders and darker colours. Auto follows your device's
          "increase contrast" setting, which is <strong>{systemMore ? "on" : "off"}</strong> right now, so high
          contrast is <strong>{contrastActive(prefs.contrast) ? "on" : "off"}</strong>.
        </p>

        <div className={styles.divider} />

        <Toggle label="Wall tablet mode" isOn={prefs.kiosk} onChange={(kiosk) => writePrefs({ kiosk })} />
        <p className={styles.help}>
          Controls 20% larger, the screen dims after 2 minutes without a touch, and a tap wakes it. Best with the
          app installed to the home screen, which opens full screen.
        </p>
        {prefs.kiosk && (
          <Button icon={<CornersOut weight="bold" />} onPress={enterFullscreen}>
            Go full screen
          </Button>
        )}

        {canVibrate && (
          <>
            <div className={styles.divider} />
            <Toggle label="Vibrate on tap" isOn={prefs.haptics} onChange={(haptics) => writePrefs({ haptics })} />
          </>
        )}
      </Card>

      <Card as="section" aria-labelledby="set-hub" className={styles.section}>
        <h3 id="set-hub" className={styles.sectionTitle}>
          Hub
        </h3>
        <dl className={styles.facts}>
          <div>
            <dt>Connection</dt>
            <dd>{status === "online" ? "Connected" : status === "connecting" ? "Connecting" : "Offline"}</dd>
          </div>
          <div>
            <dt>Last update</dt>
            <dd className="tabular">{lastSync ? new Date(lastSync).toLocaleTimeString("en-GB") : "Never"}</dd>
          </div>
          <div>
            <dt>Home</dt>
            <dd>{home?.name ?? "Unknown"}</dd>
          </div>
        </dl>
        <p className={styles.help}>New devices are paired in the Thermo mobile app.</p>
      </Card>

      <Card as="section" aria-labelledby="set-demo" className={styles.section}>
        <h3 id="set-demo" className={styles.sectionTitle}>
          Demo
        </h3>
        <Toggle
          label="Simulate an unreliable hub"
          isOn={(home?.failRate ?? 0) > 0}
          isDisabled={locked}
          onChange={(on) => send({ type: "setFailRate", value: on ? 0.35 : 0 })}
        />
        <p className={styles.help}>
          About a third of changes will fail, so you can watch them roll back with a message. This affects every
          screen connected to the demo hub.
        </p>
      </Card>
    </div>
  );
}
