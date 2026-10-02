import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { MinusIcon as Minus, PlusIcon as Plus } from "@phosphor-icons/react/ssr";
import {
  angleToValue,
  arcPath,
  formatTemp,
  keyToValue,
  pointToAngle,
  snap,
  spokenTemp,
  SWEEP,
  SWEEP_START,
  valueToAngle,
  type Range,
} from "~/lib/dial";
import { haptic } from "~/lib/prefs";
import { Button } from "./Button";
import { useCountTo } from "./useCountTo";
import styles from "./Dial.module.css";

export interface DialProps {
  /** Accessible name, e.g. "Whole-home heating target". */
  label: string;
  value: number;
  /** Called once per gesture: pointer release, a pause in key presses, or a button tap. */
  onCommit: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Small line above the readout, e.g. "Heating to". */
  caption?: string;
  /** Measured temperature, shown under the readout. */
  current?: number;
  /** warm while heating, cool for Eco, off when the valves are closed. */
  tone?: "warm" | "cool" | "off";
  isDisabled?: boolean;
  size?: "main" | "room" | "demo";
  /** Label the +/- buttons (defaults "Cooler" / "Warmer"). */
  buttonLabels?: [string, string];
}

// SVG geometry, in viewBox units.
const VB = 240;
const C = VB / 2;
const R = 96;
const COMMIT_DELAY = 400;

/**
 * The thermostat dial (FR-1). Operable four ways:
 * drag around the ring, the Cooler/Warmer buttons, arrow keys (0.5°C, PageUp/Down
 * 2°C, Home/End), and as an ARIA slider for screen readers.
 */
export function Dial({
  label,
  value,
  onCommit,
  min = 5,
  max = 30,
  step = 0.5,
  caption = "Target",
  current,
  tone = "warm",
  isDisabled,
  size = "main",
  buttonLabels = ["Cooler", "Warmer"],
}: DialProps) {
  const range: Range = { min, max, step };
  const [local, setLocal] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [announce, setAnnounce] = useState("");
  const shown = local ?? value;
  const filterId = `knob-shadow-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const svgRef = useRef<SVGSVGElement>(null);
  const faceRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(shown);
  latest.current = shown;

  const readout = useCountTo(shown, !dragging);

  const commit = useCallback(
    (v: number) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      setLocal(null);
      if (v !== value) onCommit(v);
    },
    [value, onCommit],
  );

  const commitSoon = (v: number) => {
    setLocal(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => commit(v), COMMIT_DELAY);
  };

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const angleFromEvent = (e: PointerEvent) => {
    const rect = svgRef.current!.getBoundingClientRect();
    const scale = rect.width / VB;
    const dx = (e.clientX - rect.left) / scale - C;
    const dy = (e.clientY - rect.top) / scale - C;
    return { angle: pointToAngle(dx, dy), dist: Math.hypot(dx, dy) };
  };

  const onPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    if (isDisabled || e.button !== 0) return;
    const { angle, dist } = angleFromEvent(e);
    // Only the ring (and a generous margin for fingers) starts a drag.
    if (dist < R - 34 || dist > R + 26) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    faceRef.current?.focus({ preventScroll: true });
    setDragging(true);
    const v = angleToValue(angle, range, latest.current, false);
    if (v !== latest.current) haptic(5);
    setLocal(v);
  };

  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    if (!dragging) return;
    const v = angleToValue(angleFromEvent(e).angle, range, latest.current, true);
    if (v !== latest.current) {
      // A light tick per half degree, like a detent on a real dial.
      haptic(3);
      setLocal(v);
    }
  };

  const endDrag = () => {
    if (!dragging) return;
    setDragging(false);
    commit(latest.current);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (isDisabled) return;
    const v = keyToValue(e.key, latest.current, range);
    if (v === null) return;
    e.preventDefault();
    commitSoon(v);
  };

  const nudge = (delta: number) => {
    const v = snap(latest.current + delta, range);
    commitSoon(v);
    setAnnounce(`${caption} ${spokenTemp(v)}`);
  };

  const angle = valueToAngle(shown, range);
  const t = (shown - min) / (max - min);
  const track = arcPath(C, C, R, SWEEP_START, SWEEP_START + SWEEP);
  const [minX, minY] = polar(SWEEP_START - 16, R - 2);
  const [maxX, maxY] = polar(SWEEP_START + SWEEP + 16, R - 2);

  return (
    <div className={styles.dial} data-size={size} data-tone={tone} data-disabled={isDisabled || undefined}>
      <div
        ref={faceRef}
        className={styles.face}
        role="slider"
        tabIndex={isDisabled ? -1 : 0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={shown}
        aria-valuetext={spokenTemp(shown)}
        aria-disabled={isDisabled || undefined}
        aria-orientation="horizontal"
        onKeyDown={onKeyDown}
        onBlur={() => local !== null && !dragging && commit(local)}
      >
        <svg
          ref={svgRef}
          className={styles.svg}
          viewBox={`0 0 ${VB} ${VB}`}
          aria-hidden="true"
          data-dragging={dragging || undefined}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onLostPointerCapture={endDrag}
        >
          <defs>
            <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="3" dy="3" stdDeviation="3" floodColor="var(--shadow-dark)" />
              <feDropShadow dx="-2" dy="-2" stdDeviation="2" floodColor="var(--shadow-light)" />
            </filter>
          </defs>
          {/* Inset track with a 3:1 edge */}
          <path d={track} className={styles.trackEdge} />
          <path d={track} className={styles.track} />
          {/* Coloured arc to the target; its ink outline carries the 3:1 contrast */}
          <path d={track} pathLength={100} className={styles.arcEdge} style={{ strokeDashoffset: 100 - t * 100 }} />
          <path d={track} pathLength={100} className={styles.arc} style={{ strokeDashoffset: 100 - t * 100 }} />
          <text x={minX} y={minY} className={styles.endLabel} textAnchor="middle">
            {min}°
          </text>
          <text x={maxX} y={maxY} className={styles.endLabel} textAnchor="middle">
            {max}°
          </text>
          <g className={styles.knob} style={{ transform: `rotate(${angle}deg)` }}>
            <circle cx={C} cy={C - R} r={15} className={styles.knobBody} filter={`url(#${filterId})`} />
            <circle cx={C} cy={C - R} r={4} className={styles.knobDot} />
          </g>
        </svg>
        <div className={styles.center}>
          <span className={styles.caption}>{caption}</span>
          <span className={`${styles.readout} tabular`}>
            {formatTemp(Math.round(readout * 10) / 10)}
            <span className={styles.unit}>°C</span>
          </span>
          {current !== undefined && <span className={`${styles.now} tabular`}>Now {formatTemp(current)}°</span>}
        </div>
      </div>
      <div className={styles.buttons}>
        <Button icon={<Minus weight="bold" />} onPress={() => nudge(-step)} isDisabled={isDisabled || shown <= min}>
          {buttonLabels[0]}
        </Button>
        <Button icon={<Plus weight="bold" />} onPress={() => nudge(step)} isDisabled={isDisabled || shown >= max}>
          {buttonLabels[1]}
        </Button>
      </div>
      <span className="visually-hidden" aria-live="polite">
        {announce}
      </span>
    </div>
  );
}

function polar(angle: number, r: number): [number, number] {
  const rad = (angle * Math.PI) / 180;
  return [C + r * Math.sin(rad), C - r * Math.cos(rad) + 5];
}
