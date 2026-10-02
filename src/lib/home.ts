// The home model shared by the hub (server/hub.ts), the dashboard and the tests.
// One pure reducer: the hub applies actions for real, the dashboard applies the
// same actions optimistically before the hub confirms them (src/lib/sync.ts).

export const TEMP_MIN = 5;
export const TEMP_MAX = 30;
export const TEMP_STEP = 0.5;

export type ModeId = "home" | "away" | "night" | "eco";
export type RoomId = "living" | "kitchen" | "bedroom" | "office" | "bathroom";
export type SceneId = "morning" | "movie" | "bedtime" | "lights-off";

export interface Light {
  id: string;
  name: string;
  on: boolean;
  /** 1 to 100 percent. Kept while the light is off so it comes back at the same level. */
  brightness: number;
}

export interface ScheduleBlock {
  id: string;
  /** Minutes from midnight, multiples of SCHEDULE_SNAP. */
  start: number;
  end: number;
  temp: number;
}

export interface Room {
  id: RoomId;
  name: string;
  /** Measured air temperature. */
  current: number;
  /** Offset from the whole-home target, so a mode change moves every room together. */
  offset: number;
  /** Radiator valves open (the room is allowed to heat). */
  heating: boolean;
  lights: Light[];
  /** Percent open, 0 closed to 100 fully open. null when the room has no motorised blinds. */
  blinds: number | null;
  schedule: ScheduleBlock[];
}

export interface HomeState {
  name: string;
  outdoor: number;
  mode: ModeId;
  /** Whole-home heating target in °C. */
  target: number;
  rooms: Room[];
  /** kWh per day, oldest first; the last entry is today and grows while heating runs. */
  energy: number[];
  /** Day-of-week index (0 = Monday) of the last entry in `energy`. */
  energyEndDay: number;
  /** Demo control: share of commands the simulated devices reject, 0 to 1. */
  failRate: number;
}

export const MODES: { id: ModeId; label: string; target: number; hint: string }[] = [
  { id: "home", label: "Home", target: 21, hint: "Comfortable, everyone in" },
  { id: "away", label: "Away", target: 15, hint: "Frost-safe while you're out" },
  { id: "night", label: "Night", target: 17.5, hint: "Cooler for sleeping" },
  { id: "eco", label: "Eco", target: 19, hint: "A little cooler, lower bills" },
];

export type Action =
  | { type: "setTarget"; value: number }
  | { type: "setMode"; mode: ModeId }
  | { type: "setRoomTarget"; room: RoomId; value: number }
  | { type: "setRoomHeating"; room: RoomId; on: boolean }
  | { type: "setLight"; room: RoomId; light: string; on?: boolean; brightness?: number }
  | { type: "setRoomLights"; room: RoomId; on: boolean }
  | { type: "setBlinds"; room: RoomId; position: number }
  | { type: "setSchedule"; room: RoomId; blocks: ScheduleBlock[] }
  | { type: "applyScene"; scene: SceneId }
  | { type: "setFailRate"; value: number };

export interface Scene {
  id: SceneId;
  label: string;
  summary: string;
  actions: Action[];
}

const ALL_ROOMS: RoomId[] = ["living", "kitchen", "bedroom", "office", "bathroom"];

export const SCENES: Scene[] = [
  {
    id: "morning",
    label: "Morning",
    summary: "Heating to Home, blinds open, kitchen and bathroom lights on",
    actions: [
      { type: "setMode", mode: "home" },
      ...ALL_ROOMS.map((room): Action => ({ type: "setBlinds", room, position: 100 })),
      { type: "setRoomLights", room: "kitchen", on: true },
      { type: "setLight", room: "kitchen", light: "k-ceiling", brightness: 80 },
      { type: "setRoomLights", room: "bathroom", on: true },
    ],
  },
  {
    id: "movie",
    label: "Movie",
    summary: "Living room lamps low, blinds closed, other lights off",
    actions: [
      ...ALL_ROOMS.filter((r) => r !== "living").map((room): Action => ({ type: "setRoomLights", room, on: false })),
      { type: "setLight", room: "living", light: "l-ceiling", on: false },
      { type: "setLight", room: "living", light: "l-lamp", on: true, brightness: 20 },
      { type: "setBlinds", room: "living", position: 0 },
    ],
  },
  {
    id: "bedtime",
    label: "Bedtime",
    summary: "Heating to Night, blinds closed, lights off except a dim bedside lamp",
    actions: [
      { type: "setMode", mode: "night" },
      ...ALL_ROOMS.map((room): Action => ({ type: "setBlinds", room, position: 0 })),
      ...ALL_ROOMS.map((room): Action => ({ type: "setRoomLights", room, on: false })),
      { type: "setLight", room: "bedroom", light: "b-bedside", on: true, brightness: 15 },
    ],
  },
  {
    id: "lights-off",
    label: "Lights off",
    summary: "Every light in the house off",
    actions: ALL_ROOMS.map((room): Action => ({ type: "setRoomLights", room, on: false })),
  },
];

export function clampTemp(v: number): number {
  const stepped = Math.round(v / TEMP_STEP) * TEMP_STEP;
  return Math.min(TEMP_MAX, Math.max(TEMP_MIN, stepped));
}

export function roomTarget(state: HomeState, room: Room): number {
  return clampTemp(state.target + room.offset);
}

/** A room is calling for heat when its valves are open and it is below target. */
export function isHeating(state: HomeState, room: Room): boolean {
  return room.heating && room.current < roomTarget(state, room) - 0.2;
}

export function averageTemp(state: HomeState): number {
  const sum = state.rooms.reduce((s, r) => s + r.current, 0);
  return Math.round((sum / state.rooms.length) * 10) / 10;
}

export function lightsOn(room: Room): number {
  return room.lights.filter((l) => l.on).length;
}

export class ActionError extends Error {}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new ActionError(msg);
}

function isNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function mapRoom(state: HomeState, id: RoomId, fn: (r: Room) => Room): HomeState {
  const found = state.rooms.some((r) => r.id === id);
  assert(found, `Unknown room ${id}`);
  return { ...state, rooms: state.rooms.map((r) => (r.id === id ? fn(r) : r)) };
}

/** Apply one action. Pure; throws ActionError on anything invalid so the hub can reject it. */
export function applyAction(state: HomeState, action: Action): HomeState {
  switch (action.type) {
    case "setTarget":
      assert(isNum(action.value), "Target must be a number");
      return { ...state, target: clampTemp(action.value) };

    case "setMode": {
      const mode = MODES.find((m) => m.id === action.mode);
      assert(mode, `Unknown mode ${action.mode}`);
      return { ...state, mode: mode.id, target: mode.target };
    }

    case "setRoomTarget":
      assert(isNum(action.value), "Target must be a number");
      return mapRoom(state, action.room, (r) => ({ ...r, offset: clampTemp(action.value) - state.target }));

    case "setRoomHeating":
      return mapRoom(state, action.room, (r) => ({ ...r, heating: !!action.on }));

    case "setLight":
      return mapRoom(state, action.room, (r) => {
        assert(r.lights.some((l) => l.id === action.light), `Unknown light ${action.light}`);
        return {
          ...r,
          lights: r.lights.map((l) => {
            if (l.id !== action.light) return l;
            const next = { ...l };
            if (action.on !== undefined) next.on = !!action.on;
            if (action.brightness !== undefined) {
              assert(isNum(action.brightness), "Brightness must be a number");
              next.brightness = Math.round(Math.min(100, Math.max(1, action.brightness)));
            }
            return next;
          }),
        };
      });

    case "setRoomLights":
      return mapRoom(state, action.room, (r) => ({ ...r, lights: r.lights.map((l) => ({ ...l, on: !!action.on })) }));

    case "setBlinds":
      assert(isNum(action.position), "Position must be a number");
      return mapRoom(state, action.room, (r) =>
        r.blinds === null ? r : { ...r, blinds: Math.round(Math.min(100, Math.max(0, action.position))) },
      );

    case "setSchedule":
      assert(validSchedule(action.blocks), "Schedule blocks overlap or are out of range");
      return mapRoom(state, action.room, (r) => ({ ...r, schedule: action.blocks.map((b) => ({ ...b })) }));

    case "applyScene": {
      const scene = SCENES.find((s) => s.id === action.scene);
      assert(scene, `Unknown scene ${action.scene}`);
      return scene.actions.reduce(applyAction, state);
    }

    case "setFailRate":
      assert(isNum(action.value), "Fail rate must be a number");
      return { ...state, failRate: Math.min(1, Math.max(0, action.value)) };

    default:
      throw new ActionError(`Unknown action ${(action as { type?: string }).type}`);
  }
}

export function validSchedule(blocks: unknown): blocks is ScheduleBlock[] {
  if (!Array.isArray(blocks) || blocks.length > 12) return false;
  const sorted = [...blocks].sort((a, b) => a.start - b.start);
  let prevEnd = 0;
  for (const b of sorted) {
    if (typeof b?.id !== "string" || !isNum(b.start) || !isNum(b.end) || !isNum(b.temp)) return false;
    if (b.start < prevEnd || b.end <= b.start || b.start < 0 || b.end > 24 * 60) return false;
    if (b.temp < TEMP_MIN || b.temp > TEMP_MAX) return false;
    prevEnd = b.end;
  }
  return true;
}

/** Plain-English description of what an action touched, used in rollback messages. */
export function describeAction(state: HomeState, action: Action): string {
  const room = "room" in action ? state.rooms.find((r) => r.id === action.room)?.name ?? "That room" : null;
  switch (action.type) {
    case "setTarget":
      return "the heating target";
    case "setMode":
      return `${MODES.find((m) => m.id === action.mode)?.label ?? "the"} mode`;
    case "applyScene":
      return `the ${SCENES.find((s) => s.id === action.scene)?.label ?? ""} scene`;
    case "setRoomTarget":
    case "setRoomHeating":
      return `${room} heating`;
    case "setLight":
    case "setRoomLights":
      return `${room} lights`;
    case "setBlinds":
      return `${room} blinds`;
    case "setSchedule":
      return `${room} schedule`;
    default:
      return "that change";
  }
}

const hm = (h: number, m = 0) => h * 60 + m;

export function initialHome(): HomeState {
  return {
    name: "Alder House",
    outdoor: 9.5,
    mode: "home",
    target: 21,
    energy: [11.8, 13.2, 10.4, 12.9, 14.6, 9.7, 6.3],
    energyEndDay: 6,
    failRate: 0,
    rooms: [
      {
        id: "living",
        name: "Living room",
        current: 20.4,
        offset: 0,
        heating: true,
        blinds: 70,
        lights: [
          { id: "l-ceiling", name: "Ceiling", on: true, brightness: 70 },
          { id: "l-lamp", name: "Floor lamp", on: false, brightness: 40 },
        ],
        schedule: [
          { id: "lv1", start: hm(6, 30), end: hm(8, 30), temp: 21 },
          { id: "lv2", start: hm(17), end: hm(22, 30), temp: 21.5 },
        ],
      },
      {
        id: "kitchen",
        name: "Kitchen",
        current: 19.6,
        offset: -1,
        heating: true,
        blinds: 100,
        lights: [
          { id: "k-ceiling", name: "Ceiling", on: false, brightness: 90 },
          { id: "k-counter", name: "Under-cabinet", on: true, brightness: 60 },
        ],
        schedule: [
          { id: "kt1", start: hm(6, 30), end: hm(9), temp: 20 },
          { id: "kt2", start: hm(17), end: hm(21), temp: 20 },
        ],
      },
      {
        id: "bedroom",
        name: "Bedroom",
        current: 18.1,
        offset: -2.5,
        heating: true,
        blinds: 0,
        lights: [
          { id: "b-ceiling", name: "Ceiling", on: false, brightness: 60 },
          { id: "b-bedside", name: "Bedside lamp", on: false, brightness: 30 },
        ],
        schedule: [
          { id: "bd1", start: hm(6), end: hm(7, 30), temp: 19 },
          { id: "bd2", start: hm(21, 30), end: hm(23), temp: 18.5 },
        ],
      },
      {
        id: "office",
        name: "Office",
        current: 20.9,
        offset: 0,
        heating: false,
        blinds: 50,
        lights: [{ id: "o-desk", name: "Desk lamp", on: true, brightness: 85 }],
        schedule: [{ id: "of1", start: hm(8, 30), end: hm(17, 30), temp: 20.5 }],
      },
      {
        id: "bathroom",
        name: "Bathroom",
        current: 21.2,
        offset: 1,
        heating: true,
        blinds: null,
        lights: [{ id: "ba-ceiling", name: "Ceiling", on: false, brightness: 100 }],
        schedule: [
          { id: "ba1", start: hm(6), end: hm(8), temp: 22 },
          { id: "ba2", start: hm(20), end: hm(22), temp: 22 },
        ],
      },
    ],
  };
}

export const ROOM_IDS = ALL_ROOMS;
