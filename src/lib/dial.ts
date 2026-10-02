// Geometry for the temperature dial. Angles are degrees clockwise from 12 o'clock.
// The ring sweeps 270°, leaving a 90° gap at the bottom.

export const SWEEP_START = -135;
export const SWEEP = 270;

export interface Range {
  min: number;
  max: number;
  step: number;
}

export function snap(value: number, { min, max, step }: Range): number {
  const stepped = Math.round((value - min) / step) * step + min;
  // Round away float noise (21.499999 -> 21.5).
  const clean = Math.round(stepped * 1000) / 1000;
  return Math.min(max, Math.max(min, clean));
}

export function valueToAngle(value: number, { min, max }: Range): number {
  const t = (Math.min(max, Math.max(min, value)) - min) / (max - min);
  return SWEEP_START + t * SWEEP;
}

/** Angle of a point relative to the centre, clockwise from 12 o'clock, in (-180, 180]. */
export function pointToAngle(dx: number, dy: number): number {
  return (Math.atan2(dx, -dy) * 180) / Math.PI;
}

/**
 * Map a pointer angle to a value. Inside the bottom gap the value sticks to
 * whichever end the pointer came from, so dragging past 30° never wraps to 5°.
 */
export function angleToValue(angle: number, range: Range, previous: number, dragging = true): number {
  const end = SWEEP_START + SWEEP;
  const mid = (range.min + range.max) / 2;
  if (angle < SWEEP_START || angle > end) {
    // A fresh press in the gap goes to the nearer end (right half is the top of the range).
    if (!dragging) return angle > 0 ? range.max : range.min;
    return previous >= mid ? range.max : range.min;
  }
  const t = (angle - SWEEP_START) / SWEEP;
  const raw = range.min + t * (range.max - range.min);
  // While dragging, one pointer move can't jump more than half the ring; if it
  // would, the pointer crossed the gap and we hold at the nearest end instead.
  const next = snap(raw, range);
  if (dragging && Math.abs(next - previous) > (range.max - range.min) / 2) {
    return previous >= mid ? range.max : range.min;
  }
  return next;
}

/** SVG arc path along a circle between two angles (degrees, clockwise from 12). */
export function arcPath(cx: number, cy: number, r: number, from: number, to: number): string {
  const p = (a: number) => {
    const rad = (a * Math.PI) / 180;
    return [cx + r * Math.sin(rad), cy - r * Math.cos(rad)] as const;
  };
  const [x1, y1] = p(from);
  const [x2, y2] = p(to);
  const large = to - from > 180 ? 1 : 0;
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

/** Keyboard behaviour for the dial (and any 1-D slider): returns the new value or null. */
export function keyToValue(key: string, value: number, range: Range): number | null {
  const big = range.step * 4;
  switch (key) {
    case "ArrowUp":
    case "ArrowRight":
      return snap(value + range.step, range);
    case "ArrowDown":
    case "ArrowLeft":
      return snap(value - range.step, range);
    case "PageUp":
      return snap(value + big, range);
    case "PageDown":
      return snap(value - big, range);
    case "Home":
      return range.min;
    case "End":
      return range.max;
    default:
      return null;
  }
}

export function formatTemp(v: number): string {
  return v.toFixed(1);
}

/** "21.5 degrees" for aria-valuetext. Whole numbers read without ".0". */
export function spokenTemp(v: number): string {
  return `${Number.isInteger(v) ? v.toFixed(0) : v.toFixed(1)} degrees`;
}
