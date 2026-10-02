import { createContext, useContext, useRef, type ReactNode } from "react";
import { useFocusRing, useRadio, useRadioGroup, VisuallyHidden } from "react-aria";
import { useRadioGroupState, type RadioGroupState } from "react-stately";
import { CheckIcon as Check } from "@phosphor-icons/react/ssr";
import { haptic } from "~/lib/prefs";
import styles from "./SegmentedControl.module.css";

export interface Segment<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

export interface SegmentedControlProps<T extends string> {
  label: string;
  /** Hide the group label visually (it is still announced). */
  hideLabel?: boolean;
  options: Segment<T>[];
  value: T;
  onChange: (v: T) => void;
  isDisabled?: boolean;
  /** Stretch to fill the row, equal widths. */
  fill?: boolean;
}

const Ctx = createContext<RadioGroupState | null>(null);

/**
 * Radio group styled as a row of soft keys. The chosen key is pressed in, and
 * because a shadow alone is not a 3:1 indicator it also gets a tick and ink text.
 */
export function SegmentedControl<T extends string>({
  label,
  hideLabel,
  options,
  value,
  onChange,
  isDisabled,
  fill,
}: SegmentedControlProps<T>) {
  const state = useRadioGroupState({
    value,
    onChange: (v) => {
      haptic();
      onChange(v as T);
    },
    isDisabled,
    orientation: "horizontal",
  });
  const { radioGroupProps, labelProps } = useRadioGroup({ label, isDisabled, orientation: "horizontal" }, state);
  return (
    <div {...radioGroupProps} className={styles.group} data-fill={fill || undefined}>
      <span {...labelProps} className={hideLabel ? "visually-hidden" : styles.groupLabel}>
        {label}
      </span>
      <div className={styles.row}>
        <Ctx.Provider value={state}>
          {options.map((o) => (
            <SegmentOption key={o.value} {...o} />
          ))}
        </Ctx.Provider>
      </div>
    </div>
  );
}

function SegmentOption({ value, label, icon }: Segment<string>) {
  const state = useContext(Ctx)!;
  const ref = useRef<HTMLInputElement>(null);
  const { inputProps, isSelected, isDisabled } = useRadio({ value, children: label }, state, ref);
  const { focusProps, isFocusVisible } = useFocusRing();
  return (
    <label
      className={styles.option}
      data-selected={isSelected || undefined}
      data-focus={isFocusVisible || undefined}
      data-disabled={isDisabled || undefined}
    >
      <VisuallyHidden>
        <input {...inputProps} {...focusProps} ref={ref} />
      </VisuallyHidden>
      <span className={styles.icon} aria-hidden="true">
        {isSelected ? <Check weight="bold" /> : icon}
      </span>
      <span>{label}</span>
    </label>
  );
}
