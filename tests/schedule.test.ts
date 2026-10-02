import { describe, expect, it } from "vitest";
import { validSchedule, type ScheduleBlock } from "~/lib/home";
import { addBlock, blockAt, formatTime, moveBlock, removeBlock, resizeBlock, setBlockTemp, spokenTime } from "~/lib/schedule";

const day: ScheduleBlock[] = [
  { id: "a", start: 6 * 60, end: 8 * 60, temp: 21 },
  { id: "b", start: 17 * 60, end: 22 * 60, temp: 21.5 },
];

describe("schedule editor (FR-8)", () => {
  it("moves a block in 30 minute steps", () => {
    const next = moveBlock(day, "a", 44);
    expect(next.find((b) => b.id === "a")).toMatchObject({ start: 390, end: 510 });
    expect(validSchedule(next)).toBe(true);
  });

  it("stops at the neighbouring block instead of overlapping", () => {
    const next = moveBlock(day, "a", 20 * 60);
    expect(next.find((b) => b.id === "a")).toMatchObject({ start: 15 * 60, end: 17 * 60 });
    expect(validSchedule(next)).toBe(true);
  });

  it("stops at the edges of the day", () => {
    expect(moveBlock(day, "a", -24 * 60).find((b) => b.id === "a")!.start).toBe(0);
    expect(moveBlock(day, "b", 24 * 60).find((b) => b.id === "b")!.end).toBe(24 * 60);
  });

  it("returns the same array when nothing can move (so no command is sent)", () => {
    const atStart = [{ id: "x", start: 0, end: 60, temp: 20 }];
    expect(moveBlock(atStart, "x", -30)).toBe(atStart);
  });

  it("resizes either end but never below 30 minutes", () => {
    expect(resizeBlock(day, "a", "end", 60).find((b) => b.id === "a")!.end).toBe(9 * 60);
    expect(resizeBlock(day, "a", "start", -90).find((b) => b.id === "a")!.start).toBe(4.5 * 60);
    const squashed = resizeBlock(day, "a", "end", -600).find((b) => b.id === "a")!;
    expect(squashed.end - squashed.start).toBe(30);
  });

  it("resizing into a neighbour stops at it", () => {
    const next = resizeBlock(day, "a", "end", 20 * 60);
    expect(next.find((b) => b.id === "a")!.end).toBe(17 * 60);
    expect(validSchedule(next)).toBe(true);
  });

  it("adds a two-hour block in the first free gap after the preferred time", () => {
    const res = addBlock(day, 20, 12 * 60, () => "new")!;
    expect(res.blocks.find((b) => b.id === "new")).toMatchObject({ start: 720, end: 840, temp: 20 });
    expect(validSchedule(res.blocks)).toBe(true);
  });

  it("wraps to the morning if the evening is full, and refuses when the day is full", () => {
    const busy: ScheduleBlock[] = [{ id: "z", start: 60, end: 24 * 60, temp: 20 }];
    expect(addBlock(busy, 20, 23 * 60, () => "n")!.blocks[0]).toMatchObject({ start: 0, end: 60 });
    expect(addBlock([{ id: "all", start: 0, end: 24 * 60, temp: 20 }], 20)).toBeNull();
  });

  it("clamps temperatures and removes blocks", () => {
    expect(setBlockTemp(day, "a", 40)[0].temp).toBe(30);
    expect(removeBlock(day, "a").map((b) => b.id)).toEqual(["b"]);
  });

  it("formats and speaks times", () => {
    expect(formatTime(390)).toBe("06:30");
    expect(formatTime(24 * 60)).toBe("24:00");
    expect(spokenTime(390)).toBe("6:30 am");
    expect(spokenTime(17 * 60)).toBe("5 pm");
    expect(spokenTime(0)).toBe("12 am");
    expect(blockAt(day, 7 * 60)?.id).toBe("a");
    expect(blockAt(day, 12 * 60)).toBeUndefined();
  });
});
