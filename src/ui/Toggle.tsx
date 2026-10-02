import { useRef } from "react";
import { useSwitch, VisuallyHidden } from "react-aria";
import { useToggleState } from "react-stately";
import { haptic } from "~/lib/prefs";
import styles from "./Toggle.module.css";

export interface ToggleProps {
  /** Visible text label. */
  label: string;
  isOn: boolean;
  onChange: (on: boolean) => void;
  isDisabled?: boolean;
  /** Fuller name for screen readers, e.g. "Kitchen lights" when the visible label is just "Lights". */
  "aria-label"?: string;
  /** Label above the switch instead of beside it (compact room cards). */
  stacked?: boolean;
}

/** Pill switch. State shows three ways: colour, thumb position and the words On/Off (FR-2). */
export function Toggle({ label, isOn, onChange, isDisabled, stacked, ...rest }: ToggleProps) {
  const ref = useRef<HTMLInputElement>(null);
  const state = useToggleState({
    isSelected: isOn,
    onChange: (v) => {
      haptic();
      onChange(v);
    },
  });
  const { inputProps } = useSwitch({ isDisabled, "aria-label": rest["aria-label"], children: label }, state, ref);
  return (
    <label
      className={styles.toggle}
      data-on={isOn || undefined}
      data-disabled={isDisabled || undefined}
      data-stacked={stacked || undefined}
    >
      <VisuallyHidden>
        <input {...inputProps} ref={ref} />
      </VisuallyHidden>
      <span className={styles.label} aria-hidden={rest["aria-label"] ? true : undefined}>
        {label}
      </span>
      <span className={styles.control}>
        <span className={styles.track} aria-hidden="true">
          <span className={styles.thumb} />
        </span>
        <span className={styles.state} aria-hidden="true">
          {isOn ? "On" : "Off"}
        </span>
      </span>
    </label>
  );
}
