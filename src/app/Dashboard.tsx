import { BedIcon as Bed, CoffeeIcon as Coffee, FlameIcon as Flame, LeafIcon as Leaf, LightbulbFilamentIcon as LightbulbFilament, MoonIcon as Moon, PopcornIcon as Popcorn, SignOutIcon as SignOut, HouseIcon as House } from "@phosphor-icons/react/ssr";
import type { ReactNode } from "react";
import { averageTemp, isHeating, MODES, SCENES, type HomeState, type ModeId, type RoomId, type SceneId } from "~/lib/home";
import { track } from "~/lib/prefs";
import { Button } from "~/ui/Button";
import { Card } from "~/ui/Card";
import { Dial } from "~/ui/Dial";
import { SegmentedControl } from "~/ui/SegmentedControl";
import { useToast } from "~/ui/Toast";
import { EnergyCard } from "./EnergyCard";
import { useHub } from "./hub";
import { RoomCard } from "./RoomCard";
import styles from "./Dashboard.module.css";

const MODE_ICONS: Record<ModeId, ReactNode> = {
  home: <House weight="bold" />,
  away: <SignOut weight="bold" />,
  night: <Moon weight="bold" />,
  eco: <Leaf weight="bold" />,
};

const SCENE_ICONS: Record<SceneId, ReactNode> = {
  morning: <Coffee weight="bold" />,
  movie: <Popcorn weight="bold" />,
  bedtime: <Bed weight="bold" />,
  "lights-off": <LightbulbFilament weight="bold" />,
};

export function ModeControl({ home }: { home: HomeState }) {
  const { send, locked } = useHub();
  const toast = useToast();
  return (
    <SegmentedControl
      label="Mode"
      hideLabel
      fill
      value={home.mode}
      isDisabled={locked}
      options={MODES.map((m) => ({ value: m.id, label: m.label, icon: MODE_ICONS[m.id] }))}
      onChange={(mode) => {
        const m = MODES.find((x) => x.id === mode)!;
        if (send({ type: "setMode", mode })) toast(`${m.label} mode. Home heating set to ${m.target}°C. ${m.hint}.`);
      }}
    />
  );
}

export function Scenes() {
  const { send, locked } = useHub();
  const toast = useToast();
  return (
    <section aria-labelledby="scenes-title" className={styles.scenes}>
      <h2 id="scenes-title" className={styles.sectionTitle}>
        Scenes
      </h2>
      <ul className={styles.sceneRow} role="list">
        {SCENES.map((s) => (
          <li key={s.id}>
            <Button
              icon={SCENE_ICONS[s.id]}
              size="lg"
              isDisabled={locked}
              className={styles.sceneButton}
              onPress={() => {
                if (send({ type: "applyScene", scene: s.id })) {
                  track("scene_used");
                  toast(`${s.label} scene on. ${s.summary}.`);
                }
              }}
            >
              {s.label}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Dashboard({ home, openRoom, sceneInHeader }: { home: HomeState; openRoom: RoomId | null; sceneInHeader: boolean }) {
  const { send, locked } = useHub();
  const heatingRooms = home.rooms.filter((r) => isHeating(home, r));
  const mode = MODES.find((m) => m.id === home.mode)!;
  return (
    <div className={styles.dashboard} data-panel={openRoom ? "open" : undefined}>
      <Card as="section" aria-labelledby="whole-home-title" className={styles.dialCard} padding="lg">
        <h2 id="whole-home-title" className={styles.sectionTitle}>
          Whole home
        </h2>
        <Dial
          label="Whole-home heating target"
          value={home.target}
          caption={heatingRooms.length ? "Heating to" : "Target"}
          current={averageTemp(home)}
          tone={home.mode === "eco" ? "cool" : "warm"}
          isDisabled={locked}
          onCommit={(v) => {
            if (send({ type: "setTarget", value: v })) track("temp_changed");
          }}
        />
        <p className={styles.dialStatus} aria-live="polite">
          {heatingRooms.length > 0 && <Flame weight="fill" aria-hidden="true" className={styles.flame} />}
          {heatingRooms.length === 0
            ? "Every room is at temperature."
            : heatingRooms.length === 1
              ? `${heatingRooms[0].name} is heating.`
              : `${heatingRooms.length} rooms are heating.`}
        </p>
        <p className={styles.modeHint}>
          {mode.label} mode: {mode.target}°C. Each room keeps its own offset from this.
        </p>
      </Card>

      {!sceneInHeader && <Scenes />}

      <section aria-labelledby="rooms-title" className={styles.roomsSection}>
        <h2 id="rooms-title" className={styles.sectionTitle}>
          Rooms
        </h2>
        <div className={styles.rooms}>
          {home.rooms.map((r) => (
            <RoomCard key={r.id} home={home} room={r} active={openRoom === r.id} />
          ))}
          <EnergyCard home={home} />
        </div>
      </section>
    </div>
  );
}
