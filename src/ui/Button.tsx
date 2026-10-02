import { useRef, type ReactNode } from "react";
import { useButton } from "react-aria";
import { haptic } from "~/lib/prefs";
import styles from "./Button.module.css";

export interface ButtonProps {
  children: ReactNode;
  onPress?: () => void;
  /** raised: default soft button. primary: warm fill for the one main action. */
  variant?: "raised" | "primary";
  size?: "md" | "lg";
  /** Shown before the text label. Icons are never the only label (PRD §8). */
  icon?: ReactNode;
  isDisabled?: boolean;
  /** For toggle-style buttons: rendered pressed-in with aria-pressed. */
  isSelected?: boolean;
  type?: "button" | "submit";
  className?: string;
  "aria-describedby"?: string;
}

export function Button({ children, onPress, variant = "raised", size = "md", icon, isSelected, className, ...rest }: ButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const { buttonProps, isPressed } = useButton(
    {
      ...rest,
      onPress: () => {
        haptic();
        onPress?.();
      },
    },
    ref,
  );
  return (
    <button
      {...buttonProps}
      ref={ref}
      aria-pressed={isSelected}
      data-pressed={isPressed || isSelected || undefined}
      data-variant={variant}
      data-size={size}
      className={[styles.button, className].filter(Boolean).join(" ")}
    >
      {icon && <span className={styles.icon} aria-hidden="true">{icon}</span>}
      <span>{children}</span>
    </button>
  );
}

/** Same look, as a link. Server-renders with no JavaScript (used on the landing pages). */
export function ButtonLink({
  href,
  children,
  variant = "raised",
  size = "md",
  icon,
  className,
}: {
  href: string;
  children: ReactNode;
  variant?: "raised" | "primary";
  size?: "md" | "lg";
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <a href={href} data-variant={variant} data-size={size} className={[styles.button, className].filter(Boolean).join(" ")}>
      {icon && <span className={styles.icon} aria-hidden="true">{icon}</span>}
      <span>{children}</span>
    </a>
  );
}
