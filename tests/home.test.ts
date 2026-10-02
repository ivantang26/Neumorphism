import { describe, expect, it } from "vitest";
import {
  ActionError,
  applyAction,
  initialHome,
  isHeating,
  lightsOn,
  MODES,
  roomTarget,
  SCENES,
  validSchedule,
  type HomeState,
} from "~/lib/home";

const room = (s: HomeState, id: string) => s.rooms.find((r) => r.id === id)!;

describe("home reducer", () => {
  it("clamps and steps the whole-home target", () => {
    const s = initialHome();
    expect(applyAction(s, { type: "setTarget", value: 21.3 }).target).toBe(21.5);
    expect(applyAction(s, { type: "setTarget", value: 99 }).target).toBe(30);
    expect(applyAction(s, { type: "setTarget", value: -4 }).target).toBe(5);
  });

  it("switching mode updates every room's target together (FR-4)", () => {
    const s = initialHome();
    for (const mode of MODES) {
      const next = applyAction(s, { type: "setMode", mode: mode.id });
      expect(next.mode).toBe(mode.id);
      expect(next.target).toBe(mode.target);
      for (const r of next.rooms) expect(roomTarget(next, r)).toBe(Math.max(5, Math.min(30, mode.target + r.offset)));
    }
  });

  it("a room target is stored as an offset, so it survives mode changes", () => {
    let s = applyAction(initialHome(), { type: "setRoomTarget", room: "bedroom", value: 17 });
    expect(roomTarget(s, room(s, "bedroom"))).toBe(17);
    s = applyAction(s, { type: "setMode", mode: "eco" });
    expect(roomTarget(s, room(s, "bedroom"))).toBe(15);
  });

  it("does not report heating when the valves are closed", () => {
    let s = initialHome();
    s = applyAction(s, { type: "setRoomTarget", room: "living", value: 25 });
    expect(isHeating(s, room(s, "living"))).toBe(true);
    s = applyAction(s, { type: "setRoomHeating", room: "living", on: false });
    expect(isHeating(s, room(s, "living"))).toBe(false);
  });

  it("keeps brightness while a light is off, and clamps it", () => {
    let s = applyAction(initialHome(), { type: "setLight", room: "living", light: "l-ceiling", on: false });
    const l = room(s, "living").lights[0];
    expect(l.on).toBe(false);
    expect(l.brightness).toBe(70);
    s = applyAction(s, { type: "setLight", room: "living", light: "l-ceiling", brightness: 250 });
    expect(room(s, "living").lights[0].brightness).toBe(100);
  });

  it("ignores blinds for rooms without them", () => {
    const s = applyAction(initialHome(), { type: "setBlinds", room: "bathroom", position: 50 });
    expect(room(s, "bathroom").blinds).toBeNull();
  });

  it("scenes set several devices in one action (FR-3)", () => {
    const s = applyAction(initialHome(), { type: "applyScene", scene: "bedtime" });
    expect(s.mode).toBe("night");
    expect(s.rooms.every((r) => r.blinds === null || r.blinds === 0)).toBe(true);
    const lit = s.rooms.flatMap((r) => r.lights.filter((l) => l.on).map((l) => l.id));
    expect(lit).toEqual(["b-bedside"]);

    const movie = applyAction(initialHome(), { type: "applyScene", scene: "movie" });
    const living = room(movie, "living");
    expect(living.blinds).toBe(0);
    expect(living.lights.find((l) => l.id === "l-lamp")).toMatchObject({ on: true, brightness: 20 });
    expect(movie.rooms.filter((r) => r.id !== "living").every((r) => lightsOn(r) === 0)).toBe(true);
  });

  it("every scene applies cleanly to the starting home", () => {
    for (const sc of SCENES) expect(() => applyAction(initialHome(), { type: "applyScene", scene: sc.id })).not.toThrow();
  });

  it("rejects unknown rooms, lights, modes and malformed values", () => {
    const s = initialHome();
    expect(() => applyAction(s, { type: "setRoomHeating", room: "attic" as never, on: true })).toThrow(ActionError);
    expect(() => applyAction(s, { type: "setLight", room: "living", light: "nope" })).toThrow(ActionError);
    expect(() => applyAction(s, { type: "setMode", mode: "party" as never })).toThrow(ActionError);
    expect(() => applyAction(s, { type: "setTarget", value: "hot" as never })).toThrow(ActionError);
    expect(() => applyAction(s, { type: "explode" } as never)).toThrow(ActionError);
  });

  it("validates schedules: no overlaps, inside the day, sane temperatures", () => {
    expect(validSchedule([{ id: "a", start: 0, end: 60, temp: 20 }])).toBe(true);
    expect(validSchedule([{ id: "a", start: 0, end: 120, temp: 20 }, { id: "b", start: 60, end: 180, temp: 20 }])).toBe(false);
    expect(validSchedule([{ id: "a", start: 1400, end: 1500, temp: 20 }])).toBe(false);
    expect(validSchedule([{ id: "a", start: 60, end: 60, temp: 20 }])).toBe(false);
    expect(validSchedule([{ id: "a", start: 0, end: 60, temp: 40 }])).toBe(false);
    expect(validSchedule("nope")).toBe(false);
  });
});
