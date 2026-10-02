// Pure editing operations for the 24-hour schedule timeline (FR-8).
// Every operation keeps blocks sorted, snapped, inside the day and non-overlapping,
// and returns the input unchanged when a move isn't possible.

import { clampTemp, type ScheduleBlock } from "./home";

export const DAY = 24 * 60;
export const SCHEDULE_SNAP = 30;
export const MIN_LENGTH = 30;
export const MAX_BLOCKS = 6;

const snapMin = (m: number) => Math.round(m / SCHEDULE_SNAP) * SCHEDULE_SNAP;

export function sortBlocks(blocks: ScheduleBlock[]): ScheduleBlock[] {
  return [...blocks].sort((a, b) => a.start - b.start);
}

function neighbours(blocks: ScheduleBlock[], id: string) {
  const sorted = sortBlocks(blocks);
  const i = sorted.findIndex((b) => b.id === id);
  return {
    block: sorted[i],
    lower: i > 0 ? sorted[i - 1].end : 0,
    upper: i < sorted.length - 1 ? sorted[i + 1].start : DAY,
  };
}

function replace(blocks: ScheduleBlock[], next: ScheduleBlock): ScheduleBlock[] {
  return sortBlocks(blocks.map((b) => (b.id === next.id ? next : b)));
}

/** Move a whole block by delta minutes, stopping at its neighbours and the day edges. */
export function moveBlock(blocks: ScheduleBlock[], id: string, delta: number): ScheduleBlock[] {
  const { block, lower, upper } = neighbours(blocks, id);
  if (!block) return blocks;
  const len = block.end - block.start;
  const start = Math.min(upper - len, Math.max(lower, snapMin(block.start + delta)));
  if (start === block.start) return blocks;
  return replace(blocks, { ...block, start, end: start + len });
}

/** Move one edge of a block. The block never shrinks below MIN_LENGTH. */
export function resizeBlock(
  blocks: ScheduleBlock[],
  id: string,
  edge: "start" | "end",
  delta: number,
): ScheduleBlock[] {
  const { block, lower, upper } = neighbours(blocks, id);
  if (!block) return blocks;
  if (edge === "start") {
    const start = Math.min(block.end - MIN_LENGTH, Math.max(lower, snapMin(block.start + delta)));
    return start === block.start ? blocks : replace(blocks, { ...block, start });
  }
  const end = Math.max(block.start + MIN_LENGTH, Math.min(upper, snapMin(block.end + delta)));
  return end === block.end ? blocks : replace(blocks, { ...block, end });
}

export function setBlockTemp(blocks: ScheduleBlock[], id: string, temp: number): ScheduleBlock[] {
  return blocks.map((b) => (b.id === id ? { ...b, temp: clampTemp(temp) } : b));
}

export function removeBlock(blocks: ScheduleBlock[], id: string): ScheduleBlock[] {
  return blocks.filter((b) => b.id !== id);
}

/**
 * Add a two-hour block in the first free gap at or after `preferred` (wrapping to
 * the start of the day). Returns null when the day has no room for another block.
 */
export function addBlock(
  blocks: ScheduleBlock[],
  temp: number,
  preferred = 12 * 60,
  makeId: () => string = () => `b${Math.random().toString(36).slice(2, 8)}`,
): { blocks: ScheduleBlock[]; id: string } | null {
  if (blocks.length >= MAX_BLOCKS) return null;
  const sorted = sortBlocks(blocks);
  const gaps: [number, number][] = [];
  let prev = 0;
  for (const b of sorted) {
    if (b.start > prev) gaps.push([prev, b.start]);
    prev = b.end;
  }
  if (prev < DAY) gaps.push([prev, DAY]);
  const usable = gaps.filter(([a, b]) => b - a >= MIN_LENGTH);
  if (!usable.length) return null;
  const ordered = [...usable.filter(([, b]) => b > preferred), ...usable.filter(([, b]) => b <= preferred)];
  const [gs, ge] = ordered[0];
  // In a gap after the preferred time, start as close to it as fits; in a gap we wrapped round to, start at its beginning.
  const start = ge <= preferred ? gs : Math.max(gs, Math.min(snapMin(preferred), ge - MIN_LENGTH));
  const end = Math.min(ge, start + 120);
  const id = makeId();
  return { blocks: sortBlocks([...blocks, { id, start, end, temp: clampTemp(temp) }]), id };
}

export function formatTime(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(min === DAY ? 24 : h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function spokenTime(min: number): string {
  if (min === DAY) return "midnight";
  const h = Math.floor(min / 60);
  const m = min % 60;
  const suffix = h < 12 ? "am" : "pm";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m ? `${h12}:${String(m).padStart(2, "0")} ${suffix}` : `${h12} ${suffix}`;
}

/** The block covering a time of day, if any. */
export function blockAt(blocks: ScheduleBlock[], minute: number): ScheduleBlock | undefined {
  return blocks.find((b) => minute >= b.start && minute < b.end);
}
