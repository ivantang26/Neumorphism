import type { ElementType, ReactNode } from "react";
import styles from "./Card.module.css";

export interface CardProps {
  as?: ElementType;
  children: ReactNode;
  className?: string;
  /** Pressed-in surface instead of raised (wells, readouts). */
  inset?: boolean;
  /** Highlight ring, e.g. the room that's open in the side panel. */
  active?: boolean;
  padding?: "sm" | "md" | "lg";
  [key: `aria-${string}`]: string | undefined;
  id?: string;
}

/** Raised card. Its hairline is decorative; interactive things inside carry their own rings. */
export function Card({ as: Tag = "div", children, className, inset, active, padding = "md", ...rest }: CardProps) {
  return (
    <Tag
      {...rest}
      className={[styles.card, className].filter(Boolean).join(" ")}
      data-inset={inset || undefined}
      data-active={active || undefined}
      data-padding={padding}
    >
      {children}
    </Tag>
  );
}
