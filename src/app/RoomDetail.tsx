import { ArrowLeftIcon as ArrowLeft, LightbulbIcon as Lightbulb, RowsIcon as Rows, XIcon as X } from "@phosphor-icons/react/ssr";
import { isHeating, roomTarget, type HomeState, type Room } from "~/lib/home";
import { track } from "~/lib/prefs";
import { Button } from "~/ui/Button";
import { Card } from "~/ui/Card";
import { Dial } from "~/ui/Dial";
import { Slider } from "~/ui/Slider";
import { Toggle } from "~/ui/Toggle";
import { blindsSpoken, blindsText } from "~/lib/format";
import { useHub } from "./hub";
import { heatingStatus } from "./RoomCard";
import { RoomIcon } from "./RoomIcon";
import { ScheduleEditor } from "./ScheduleEditor";
import styles from "./RoomDetail.module.css";

/**
 * Everything for one room. The same component is a full page on phones, a side
 * sheet on tablets and a docked side panel on desktop (PRD §6); App decides.
 */
export function RoomDetail({
  home,
  room,
  onClose,
  closeStyle,
  headingId,
}: {
  home: HomeState;
  room: Room;
  onClose: () => void;
  closeStyle: "back" | "close";
  headingId: string;
}) {
  const { send, locked } = useHub();
  const target = roomTarget(home, room);

  return (
    <div className={styles.detail}>
      <header className={styles.header}>
        {closeStyle === "back" && (
          <Button icon={<ArrowLeft weight="bold" />} onPress={onClose}>
            All rooms
          </Button>
        )}
        <h2 id={headingId} className={styles.title} tabIndex={-1}>
          <span className={styles.icon} aria-hidden="true">
            <RoomIcon id={room.id} />
          </span>
          {room.name}
        </h2>
        {closeStyle === "close" && (
          <Button icon={<X weight="bold" />} onPress={onClose} className={styles.close}>
            Close
          </Button>
        )}
      </header>

      <Card as="section" aria-labelledby={`${headingId}-heat`} className={styles.section}>
        <div className={styles.sectionHead}>
          <h3 id={`${headingId}-heat`} className={styles.sectionTitle}>
            Heating
          </h3>
          <Toggle
            label="Radiators"
            aria-label={`${room.name} heating`}
            isOn={room.heating}
            isDisabled={locked}
            onChange={(on) => send({ type: "setRoomHeating", room: room.id, on })}
          />
        </div>
        <Dial
          label={`${room.name} target temperature`}
          size="room"
          value={target}
          current={room.current}
          caption={!room.heating ? "Off, target" : isHeating(home, room) ? "Heating to" : "Holding"}
          tone={!room.heating ? "off" : home.mode === "eco" ? "cool" : "warm"}
          isDisabled={locked}
          onCommit={(v) => {
            if (send({ type: "setRoomTarget", room: room.id, value: v })) track("temp_changed");
          }}
        />
        <p className={styles.note}>
          {heatingStatus(home, room)}. {offsetText(target - home.target)}
        </p>
      </Card>

      <Card as="section" aria-labelledby={`${headingId}-lights`} className={styles.section}>
        <h3 id={`${headingId}-lights`} className={styles.sectionTitle}>
          Lights
        </h3>
        <ul className={styles.lights} role="list">
          {room.lights.map((l) => (
            <li key={l.id} className={styles.light}>
              <Toggle
                label={l.name}
                aria-label={`${room.name} ${l.name.toLowerCase()}`}
                isOn={l.on}
                isDisabled={locked}
                onChange={(on) => send({ type: "setLight", room: room.id, light: l.id, on })}
              />
              <Slider
                label="Brightness"
                aria-label={`${room.name} ${l.name.toLowerCase()} brightness`}
                icon={<Lightbulb weight="bold" />}
                tone="light"
                min={1}
                max={100}
                value={l.brightness}
                isDisabled={locked}
                formatValue={(v) => `${v}%`}
                valueText={(v) => `${v} percent${l.on ? "" : ", light is off"}`}
                // Moving the slider on a light that's off turns it on, like a real dimmer.
                onChangeEnd={(v) => send({ type: "setLight", room: room.id, light: l.id, brightness: v, on: true })}
              />
            </li>
          ))}
        </ul>
      </Card>

      {room.blinds !== null && (
        <Card as="section" aria-labelledby={`${headingId}-blinds`} className={styles.section}>
          <h3 id={`${headingId}-blinds`} className={styles.sectionTitle}>
            Blinds
          </h3>
          <Slider
            label="Position"
            aria-label={`${room.name} blinds position`}
            icon={<Rows weight="bold" />}
            tone="cool"
            value={room.blinds}
            step={5}
            isDisabled={locked}
            formatValue={blindsText}
            valueText={blindsSpoken}
            onChangeEnd={(v) => send({ type: "setBlinds", room: room.id, position: v })}
          />
          <div className={styles.row}>
            <Button isDisabled={locked || room.blinds === 100} onPress={() => send({ type: "setBlinds", room: room.id, position: 100 })}>
              Open fully
            </Button>
            <Button isDisabled={locked || room.blinds === 0} onPress={() => send({ type: "setBlinds", room: room.id, position: 0 })}>
              Close fully
            </Button>
          </div>
        </Card>
      )}

      <Card as="section" aria-labelledby={`${headingId}-schedule`} className={styles.section}>
        <h3 id={`${headingId}-schedule`} className={styles.sectionTitle}>
          Schedule
        </h3>
        <ScheduleEditor
          roomName={room.name}
          blocks={room.schedule}
          defaultTemp={target}
          isDisabled={locked}
          onCommit={(blocks) => send({ type: "setSchedule", room: room.id, blocks })}
        />
      </Card>
    </div>
  );
}

function offsetText(diff: number): string {
  if (Math.abs(diff) < 0.25) return "Same as the whole-home target.";
  const d = Math.abs(diff).toFixed(1).replace(/\.0$/, "");
  return `${d}° ${diff > 0 ? "warmer" : "cooler"} than the whole-home target.`;
}
