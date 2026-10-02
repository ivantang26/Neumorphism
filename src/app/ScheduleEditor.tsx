import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { PlusIcon as Plus, TrashIcon as Trash } from "@phosphor-icons/react/ssr";
import { TEMP_STEP, type ScheduleBlock } from "~/lib/home";
import { formatTemp } from "~/lib/dial";
import {
  addBlock,
  DAY,
  formatTime,
  moveBlock,
  removeBlock,
  resizeBlock,
  SCHEDULE_SNAP,
  setBlockTemp,
  sortBlocks,
  spokenTime,
} from "~/lib/schedule";
import { Button } from "~/ui/Button";
import styles from "./ScheduleEditor.module.css";

interface Props {
  roomName: string;
  blocks: ScheduleBlock[];
  defaultTemp: number;
  isDisabled?: boolean;
  onCommit: (blocks: ScheduleBlock[]) => void;
}

type DragMode = "move" | "start" | "end";
interface Drag {
  id: string;
  mode: DragMode;
  x: number;
  width: number;
  origin: ScheduleBlock[];
  pointerId: number;
}

const HOUR_LABELS = [0, 3, 6, 9, 12, 15, 18, 21, 24];

/**
 * 24-hour timeline of comfort blocks (FR-8). Drag a block to move it, drag its
 * ends to resize. Dragging is never the only way (WCAG 2.5.7): the selected
 * block also has Earlier/Later buttons, and arrow keys work on a focused block.
 */
export function ScheduleEditor({ roomName, blocks, defaultTemp, isDisabled, onCommit }: Props) {
  const [draft, setDraft] = useState<ScheduleBlock[] | null>(null);
  const [selected, setSelected] = useState<string | null>(blocks[0]?.id ?? null);
  const drag = useRef<Drag | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const shown = sortBlocks(draft ?? blocks);
  const sel = shown.find((b) => b.id === selected) ?? null;
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setNow(d.getHours() * 60 + d.getMinutes());
    };
    tick();
    const t = setInterval(tick, 60_000);
    return () => clearInterval(t);
  }, []);

  // Keep a selection that still exists after the hub sends a new schedule.
  useEffect(() => {
    if (selected && !blocks.some((b) => b.id === selected)) setSelected(blocks[0]?.id ?? null);
  }, [blocks, selected]);

  const apply = (next: ScheduleBlock[]) => {
    if (next === shown || isDisabled) return;
    setDraft(null);
    onCommit(next);
  };

  const onPointerDown = (e: PointerEvent<HTMLElement>, id: string, mode: DragMode) => {
    if (isDisabled || e.button !== 0 || !trackRef.current) return;
    e.stopPropagation();
    e.preventDefault();
    setSelected(id);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { id, mode, x: e.clientX, width: trackRef.current.clientWidth, origin: shown, pointerId: e.pointerId };
  };

  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const delta = ((e.clientX - d.x) / d.width) * DAY;
    const next = d.mode === "move" ? moveBlock(d.origin, d.id, delta) : resizeBlock(d.origin, d.id, d.mode, delta);
    setDraft(next);
  };

  const onPointerUp = (e: PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    drag.current = null;
    if (draft && JSON.stringify(draft) !== JSON.stringify(d.origin)) apply(draft);
    else setDraft(null);
  };

  const onKeyDown = (e: KeyboardEvent, b: ScheduleBlock) => {
    let next: ScheduleBlock[] | null = null;
    const s = SCHEDULE_SNAP;
    if (e.key === "ArrowLeft") next = e.shiftKey ? resizeBlock(shown, b.id, "end", -s) : moveBlock(shown, b.id, -s);
    if (e.key === "ArrowRight") next = e.shiftKey ? resizeBlock(shown, b.id, "end", s) : moveBlock(shown, b.id, s);
    if (e.key === "ArrowUp") next = setBlockTemp(shown, b.id, b.temp + TEMP_STEP);
    if (e.key === "ArrowDown") next = setBlockTemp(shown, b.id, b.temp - TEMP_STEP);
    if (e.key === "Delete" || e.key === "Backspace") next = removeBlock(shown, b.id);
    if (next) {
      e.preventDefault();
      apply(next);
    }
  };

  const describe = (b: ScheduleBlock) =>
    `${spokenTime(b.start)} to ${spokenTime(b.end)}, ${formatTemp(b.temp)} degrees`;

  return (
    <div className={styles.editor}>
      <p id="schedule-help" className={styles.help}>
        Comfort times, every day. Outside them {roomName.toLowerCase()} follows the home target. Drag a block to move
        it or drag its ends to resize, or choose a block and use the buttons below.
      </p>

      <div className={styles.scroller}>
      <div className={styles.timeline} data-disabled={isDisabled || undefined}>
        <div className={styles.hours} aria-hidden="true">
          {HOUR_LABELS.map((h) => (
            <span key={h} style={{ left: `${(h / 24) * 100}%` }}>
              {String(h).padStart(2, "0")}
            </span>
          ))}
        </div>
        <div ref={trackRef} className={styles.track} role="group" aria-label={`${roomName} schedule`} aria-describedby="schedule-help">
          {Array.from({ length: 23 }, (_, i) => (
            <span key={i} className={styles.tick} data-major={(i + 1) % 6 === 0 || undefined} style={{ left: `${((i + 1) / 24) * 100}%` }} aria-hidden="true" />
          ))}
          {now !== null && (
            <span className={styles.now} style={{ left: `${(now / DAY) * 100}%` }} aria-hidden="true">
              <span>Now</span>
            </span>
          )}
          {shown.map((b) => {
            const wide = b.end - b.start >= 240;
            return (
              <div
                key={b.id}
                className={styles.block}
                data-selected={b.id === selected || undefined}
                style={{ left: `${(b.start / DAY) * 100}%`, width: `${((b.end - b.start) / DAY) * 100}%` }}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
              >
                <span
                  className={styles.handle}
                  data-edge="start"
                  onPointerDown={(e) => onPointerDown(e, b.id, "start")}
                  aria-hidden="true"
                />
                <button
                  type="button"
                  className={styles.body}
                  aria-pressed={b.id === selected}
                  aria-label={`Comfort block, ${describe(b)}`}
                  aria-describedby="schedule-keys"
                  disabled={isDisabled}
                  onPointerDown={(e) => onPointerDown(e, b.id, "move")}
                  onClick={() => setSelected(b.id)}
                  onKeyDown={(e) => onKeyDown(e, b)}
                >
                  <span className={`${styles.blockTemp} tabular`}>{formatTemp(b.temp)}°</span>
                  {wide && <span className={`${styles.blockTime} tabular`}>{formatTime(b.start)}-{formatTime(b.end)}</span>}
                </button>
                <span
                  className={styles.handle}
                  data-edge="end"
                  onPointerDown={(e) => onPointerDown(e, b.id, "end")}
                  aria-hidden="true"
                />
              </div>
            );
          })}
        </div>
      </div>
      </div>
      <p id="schedule-keys" className="visually-hidden">
        Left and right arrows move the block by 30 minutes. Shift with left or right changes when it ends. Up and down
        change the temperature. Delete removes it.
      </p>

      {sel ? (
        <fieldset className={styles.controls} disabled={isDisabled}>
          <legend className={styles.legend}>
            Selected: <span className="tabular">{formatTime(sel.start)} to {formatTime(sel.end)}</span>
          </legend>
          <Stepper
            label="Starts"
            value={formatTime(sel.start)}
            spoken={spokenTime(sel.start)}
            down={() => apply(resizeBlock(shown, sel.id, "start", -SCHEDULE_SNAP))}
            up={() => apply(resizeBlock(shown, sel.id, "start", SCHEDULE_SNAP))}
            labels={["Earlier", "Later"]}
            isDisabled={isDisabled}
          />
          <Stepper
            label="Ends"
            value={formatTime(sel.end)}
            spoken={spokenTime(sel.end)}
            down={() => apply(resizeBlock(shown, sel.id, "end", -SCHEDULE_SNAP))}
            up={() => apply(resizeBlock(shown, sel.id, "end", SCHEDULE_SNAP))}
            labels={["Earlier", "Later"]}
            isDisabled={isDisabled}
          />
          <Stepper
            label="Temperature"
            value={`${formatTemp(sel.temp)}°C`}
            spoken={`${formatTemp(sel.temp)} degrees`}
            down={() => apply(setBlockTemp(shown, sel.id, sel.temp - TEMP_STEP))}
            up={() => apply(setBlockTemp(shown, sel.id, sel.temp + TEMP_STEP))}
            labels={["Cooler", "Warmer"]}
            isDisabled={isDisabled}
          />
          <div className={styles.actions}>
            <Button icon={<Trash weight="bold" />} isDisabled={isDisabled} onPress={() => apply(removeBlock(shown, sel.id))}>
              Remove block
            </Button>
            <AddButton shown={shown} defaultTemp={defaultTemp} isDisabled={isDisabled} onAdd={(next, id) => {
              setSelected(id);
              apply(next);
            }} />
          </div>
        </fieldset>
      ) : (
        <div className={styles.empty}>
          <p>No comfort times yet, so {roomName.toLowerCase()} follows the home target all day.</p>
          <AddButton shown={shown} defaultTemp={defaultTemp} isDisabled={isDisabled} onAdd={(next, id) => {
            setSelected(id);
            apply(next);
          }} />
        </div>
      )}
    </div>
  );
}

function AddButton({
  shown,
  defaultTemp,
  isDisabled,
  onAdd,
}: {
  shown: ScheduleBlock[];
  defaultTemp: number;
  isDisabled?: boolean;
  onAdd: (blocks: ScheduleBlock[], id: string) => void;
}) {
  const now = new Date();
  const result = addBlock(shown, defaultTemp, Math.ceil((now.getHours() * 60 + now.getMinutes()) / 30) * 30);
  return (
    <Button icon={<Plus weight="bold" />} isDisabled={isDisabled || !result} onPress={() => result && onAdd(result.blocks, result.id)}>
      Add block
    </Button>
  );
}

function Stepper({
  label,
  value,
  spoken,
  down,
  up,
  labels,
  isDisabled,
}: {
  label: string;
  value: string;
  spoken: string;
  down: () => void;
  up: () => void;
  labels: [string, string];
  isDisabled?: boolean;
}) {
  return (
    <div className={styles.stepper} role="group" aria-label={`${label}, ${spoken}`}>
      <span className={styles.stepLabel} aria-hidden="true">
        {label}
      </span>
      <span className={`${styles.stepValue} tabular`} aria-hidden="true">
        {value}
      </span>
      <div className={styles.stepButtons}>
        <Button isDisabled={isDisabled} onPress={down}>
          {labels[0]}
        </Button>
        <Button isDisabled={isDisabled} onPress={up}>
          {labels[1]}
        </Button>
      </div>
    </div>
  );
}
