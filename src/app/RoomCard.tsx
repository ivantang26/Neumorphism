import { CaretRightIcon as CaretRight, FlameIcon as Flame } from "@phosphor-icons/react/ssr";
import { isHeating, lightsOn, roomTarget, type HomeState, type Room } from "~/lib/home";
import { formatTemp } from "~/lib/dial";
import { Card } from "~/ui/Card";
import { Toggle } from "~/ui/Toggle";
import { useHub } from "./hub";
import { Link } from "./router";
import { RoomIcon } from "./RoomIcon";
import styles from "./RoomCard.module.css";

export function heatingStatus(home: HomeState, room: Room): string {
  if (!room.heating) return "Heating off";
  return isHeating(home, room) ? `Heating to ${formatTemp(roomTarget(home, room))}°` : `Holding ${formatTemp(roomTarget(home, room))}°`;
}

export function RoomCard({ home, room, active }: { home: HomeState; room: Room; active: boolean }) {
  const { send, locked } = useHub();
  const heating = isHeating(home, room);
  const on = lightsOn(room);
  const headingId = `room-${room.id}-name`;
  return (
    <Card as="article" aria-labelledby={headingId} className={styles.card} active={active} padding="sm">
      <h3 id={headingId} className={styles.name}>
        <Link to={`/app/room/${room.id}`} className={styles.link} aria-current={active ? "true" : undefined}>
          <span className={styles.icon} aria-hidden="true">
            <RoomIcon id={room.id} />
          </span>
          <span className={styles.nameText}>{room.name}</span>
          <CaretRight weight="bold" aria-hidden="true" className={styles.caret} />
          <span className="visually-hidden">, open controls</span>
        </Link>
      </h3>

      <div className={styles.reading}>
        <p className={`${styles.temp} tabular`}>
          {formatTemp(room.current)}
          <span className={styles.deg}>°C</span>
        </p>
        <p className={styles.status} data-heating={heating || undefined}>
          {heating && <Flame weight="fill" aria-hidden="true" />}
          {heatingStatus(home, room)}
        </p>
      </div>

      <div className={styles.toggles}>
        <Toggle
          label="Heating"
          aria-label={`${room.name} heating`}
          isOn={room.heating}
          isDisabled={locked}
          stacked
          onChange={(v) => send({ type: "setRoomHeating", room: room.id, on: v })}
        />
        <Toggle
          label={room.lights.length > 1 ? "Lights" : "Light"}
          aria-label={room.lights.length > 1 ? `${room.name} lights, ${on} of ${room.lights.length} on` : `${room.name} light`}
          isOn={on > 0}
          isDisabled={locked}
          stacked
          onChange={(v) => send({ type: "setRoomLights", room: room.id, on: v })}
        />
      </div>
    </Card>
  );
}
