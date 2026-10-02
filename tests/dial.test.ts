import { describe, expect, it } from "vitest";
import { angleToValue, keyToValue, pointToAngle, snap, spokenTemp, valueToAngle } from "~/lib/dial";

const range = { min: 5, max: 30, step: 0.5 };

describe("dial geometry (FR-1)", () => {
  it("snaps to 0.5°C steps inside 5 to 30", () => {
    expect(snap(21.26, range)).toBe(21.5);
    expect(snap(21.24, range)).toBe(21);
    expect(snap(2, range)).toBe(5);
    expect(snap(35, range)).toBe(30);
  });

  it("maps the range onto a 270° sweep with the gap at the bottom", () => {
    expect(valueToAngle(5, range)).toBe(-135);
    expect(valueToAngle(30, range)).toBe(135);
    expect(valueToAngle(17.5, range)).toBe(0);
  });

  it("round-trips value -> angle -> value", () => {
    for (let v = 5; v <= 30; v += 0.5) {
      expect(angleToValue(valueToAngle(v, range), range, v, false)).toBe(v);
    }
  });

  it("measures angles clockwise from 12 o'clock", () => {
    expect(pointToAngle(0, -10)).toBeCloseTo(0);
    expect(pointToAngle(10, 0)).toBeCloseTo(90);
    expect(pointToAngle(-10, 0)).toBeCloseTo(-90);
  });

  it("holds at the nearest end when a drag crosses the bottom gap", () => {
    // Dragging up past 30°C into the gap stays at 30, never wraps to 5.
    expect(angleToValue(170, range, 29.5)).toBe(30);
    expect(angleToValue(-170, range, 29.5)).toBe(30);
    // A jump across the gap while dragging from the top end is refused.
    expect(angleToValue(-130, range, 30)).toBe(30);
    expect(angleToValue(130, range, 5)).toBe(5);
  });

  it("lets a fresh press anywhere on the ring jump straight there", () => {
    expect(angleToValue(-130, range, 30, false)).toBe(5.5);
    expect(angleToValue(170, range, 5, false)).toBe(30);
    expect(angleToValue(-170, range, 30, false)).toBe(5);
  });

  it("changes 0.5°C per arrow key, 2°C per page key, and jumps with Home/End", () => {
    expect(keyToValue("ArrowUp", 21, range)).toBe(21.5);
    expect(keyToValue("ArrowRight", 21, range)).toBe(21.5);
    expect(keyToValue("ArrowDown", 21, range)).toBe(20.5);
    expect(keyToValue("ArrowLeft", 21, range)).toBe(20.5);
    expect(keyToValue("PageUp", 21, range)).toBe(23);
    expect(keyToValue("PageDown", 21, range)).toBe(19);
    expect(keyToValue("Home", 21, range)).toBe(5);
    expect(keyToValue("End", 21, range)).toBe(30);
    expect(keyToValue("ArrowUp", 30, range)).toBe(30);
    expect(keyToValue("a", 21, range)).toBeNull();
  });

  it("speaks temperatures the way the PRD asks", () => {
    expect(spokenTemp(21.5)).toBe("21.5 degrees");
    expect(spokenTemp(21)).toBe("21 degrees");
  });
});
