import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CheckCircleIcon as CheckCircle, WarningIcon as Warning } from "@phosphor-icons/react/ssr";
import styles from "./Toast.module.css";

type Tone = "done" | "error";
interface ToastItem {
  id: number;
  message: string;
  tone: Tone;
}

const Ctx = createContext<(message: string, tone?: Tone) => void>(() => {});

export const useToast = () => useContext(Ctx);

const TIMEOUT = 5000;

/**
 * Confirmation and error messages. Both live regions exist from first render
 * (screen readers ignore regions that appear with their content already inside).
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);
  const show = useCallback((message: string, tone: Tone = "done") => {
    const id = ++seq.current;
    // One message per tone at a time keeps a busy wall tablet readable.
    setItems((list) => [...list.filter((t) => t.tone !== tone), { id, message, tone }]);
  }, []);
  const dismiss = useCallback((id: number) => setItems((list) => list.filter((t) => t.id !== id)), []);
  const value = useMemo(() => show, [show]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className={styles.region}>
        <div role="status" aria-live="polite" className={styles.stack}>
          {items
            .filter((t) => t.tone === "done")
            .map((t) => (
              <Toast key={t.id} item={t} onDismiss={dismiss} />
            ))}
        </div>
        <div role="alert" className={styles.stack}>
          {items
            .filter((t) => t.tone === "error")
            .map((t) => (
              <Toast key={t.id} item={t} onDismiss={dismiss} />
            ))}
        </div>
      </div>
    </Ctx.Provider>
  );
}

function Toast({ item, onDismiss }: { item: ToastItem; onDismiss: (id: number) => void }) {
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    // Errors stay twice as long: they describe something the user has to redo.
    const timer = setTimeout(() => onDismiss(item.id), item.tone === "error" ? TIMEOUT * 2 : TIMEOUT);
    return () => clearTimeout(timer);
  }, [paused, item, onDismiss]);
  return (
    <div
      className={styles.toast}
      data-tone={item.tone}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <span className={styles.icon} aria-hidden="true">
        {item.tone === "error" ? <Warning weight="bold" /> : <CheckCircle weight="bold" />}
      </span>
      <p className={styles.message}>{item.message}</p>
      <button type="button" className={styles.dismiss} onClick={() => onDismiss(item.id)}>
        Dismiss
      </button>
    </div>
  );
}
