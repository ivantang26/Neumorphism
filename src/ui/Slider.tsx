import { useRef, useState, type ReactNode } from "react";
import { mergeProps, useFocusRing, useNumberFormatter, useSlider, useSliderThumb, VisuallyHidden } from "react-aria";
import { useSliderState } from "react-stately";
import styles from "./Slider.module.css";

export interface SliderProps {
  label: string;
  value: number;
  /** Fires continuously while dragging (drives the live readout). */
  onChange?: (v: number) => void;
  /** Fires once when the user lets go or finishes a key press: send to the hub here. */
  onChangeEnd: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  isDisabled?: boolean;
  /** Visible value, e.g. "70%". */
  formatValue?: (v: number) => string;
  /** Spoken value if it should differ from the visible one, e.g. "70 percent open". */
  valueText?: (v: number) => string;
  tone?: "warm" | "cool" | "on" | "light";
  icon?: ReactNode;
  /** Fuller name for screen readers when the visible label is short. */
  "aria-label"?: string;
}

/** Inset track, coloured fill, raised thumb. Built on React Aria's slider hooks (PRD §9). */
export function Slider({
  label,
  value,
  onChange,
  onChangeEnd,
  min = 0,
  max = 100,
  step = 1,
  isDisabled,
  formatValue = (v) => `${v}%`,
  valueText,
  tone = "cool",
  icon,
  ...rest
}: SliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Local value while the user is mid-gesture; the prop takes over once they let go.
  const [local, setLocal] = useState<number | null>(null);
  const numberFormatter = useNumberFormatter({ maximumFractionDigits: 1 });
  const state = useSliderState({
    value: [local ?? value],
    minValue: min,
    maxValue: max,
    step,
    isDisabled,
    numberFormatter,
    onChange: (v) => {
      setLocal(v[0]);
      onChange?.(v[0]);
    },
    onChangeEnd: (v) => {
      setLocal(null);
      if (v[0] !== value) onChangeEnd(v[0]);
    },
  });
  const { groupProps, trackProps, labelProps, outputProps } = useSlider(
    { label, minValue: min, maxValue: max, step, isDisabled, "aria-label": rest["aria-label"] },
    state,
    trackRef,
  );
  const current = state.values[0];
  const { thumbProps, inputProps } = useSliderThumb({ index: 0, trackRef, inputRef, isDisabled }, state);
  const { focusProps, isFocusVisible } = useFocusRing();
  const t = (current - min) / (max - min);

  return (
    <div {...groupProps} className={styles.slider} data-tone={tone} data-disabled={isDisabled || undefined}>
      <div className={styles.head}>
        <label {...labelProps} className={styles.label}>
          {icon && (
            <span className={styles.icon} aria-hidden="true">
              {icon}
            </span>
          )}
          {label}
        </label>
        <output {...outputProps} className={`${styles.value} tabular`}>
          {formatValue(current)}
        </output>
      </div>
      <div {...trackProps} ref={trackRef} className={styles.track}>
        <div className={styles.rail} aria-hidden="true">
          <div className={styles.fill} style={{ ["--t" as string]: t }} />
        </div>
        <div
          {...thumbProps}
          className={styles.thumb}
          data-focus={isFocusVisible || undefined}
          data-dragging={state.isThumbDragging(0) || undefined}
          style={{ left: `${t * 100}%` }}
        >
          <VisuallyHidden>
            <input
              ref={inputRef}
              {...mergeProps(inputProps, focusProps)}
              aria-valuetext={(valueText ?? formatValue)(current)}
              // A fuller name replaces the visible label rather than being read before it.
              // It still contains the visible word, so label-in-name holds (WCAG 2.5.3).
              {...(rest["aria-label"] ? { "aria-label": rest["aria-label"], "aria-labelledby": undefined } : {})}
            />
          </VisuallyHidden>
        </div>
      </div>
    </div>
  );
}
