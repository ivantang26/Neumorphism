import { useEffect, useRef, useState, type SubmitEvent } from "react";
import { MinusIcon as Minus, PlusIcon as Plus } from "@phosphor-icons/react/ssr";
import {
  BUNDLES,
  EXTRA_VALVE_PRICE,
  formatGBP,
  MAX_EXTRA_VALVES,
  totalPrice,
  validatePreorder,
  type BundleId,
  type Preorder,
} from "~/lib/preorder";
import styles from "./PreorderForm.module.css";

type Errors = Partial<Record<keyof Preorder, string>>;

const FIELD_ORDER: (keyof Preorder)[] = ["bundle", "extraValves", "name", "email", "postcode"];

/**
 * Pre-order reservation. Server-rendered as a normal form that posts to
 * /api/preorder, so it works before (or without) JavaScript; once hydrated it
 * validates inline and submits with fetch.
 */
export default function PreorderForm() {
  const [bundle, setBundle] = useState<BundleId>("hub-valves");
  const [extra, setExtra] = useState(0);
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<"idle" | "sending" | "failed">("idle");
  const summaryRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const p = new URLSearchParams(location.search);
    const b = p.get("bundle");
    if (b && BUNDLES.some((x) => x.id === b)) setBundle(b as BundleId);
    // Returned here by the no-JavaScript fallback with ?error=<field>.
    const err = p.get("error") as keyof Preorder | null;
    if (err && FIELD_ORDER.includes(err)) setErrors({ [err]: "Please check this and send the form again." });
  }, []);

  const onSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const result = validatePreorder(data);
    if (!result.ok) {
      setErrors(result.errors);
      setTimeout(() => summaryRef.current?.focus(), 0);
      return;
    }
    setErrors({});
    setStatus("sending");
    try {
      const res = await fetch("/api/preorder", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(result.value),
      });
      const body = await res.json();
      if (!res.ok || !body.ok) {
        if (body.errors) setErrors(body.errors);
        throw new Error("rejected");
      }
      location.href = `/pre-order/thanks?ref=${encodeURIComponent(body.ref)}`;
    } catch {
      setStatus("failed");
      setTimeout(() => summaryRef.current?.focus(), 0);
    }
  };

  const errorList = FIELD_ORDER.filter((k) => errors[k]);
  const describedBy = (k: keyof Preorder) => (errors[k] ? `${k}-error` : undefined);

  return (
    <form ref={formRef} method="post" action="/api/preorder" className={styles.form} onSubmit={onSubmit} noValidate>
      <div ref={summaryRef} tabIndex={-1} className={styles.summaryAnchor}>
        {errorList.length > 0 && (
          <div className={styles.errorSummary} role="alert">
            <h2>Please check {errorList.length > 1 ? `these ${errorList.length} things` : "one thing"}</h2>
            <ul>
              {errorList.map((k) => (
                <li key={k}>
                  <a href={`#${k}`}>{errors[k]}</a>
                </li>
              ))}
            </ul>
          </div>
        )}
        {status === "failed" && errorList.length === 0 && (
          <div className={styles.errorSummary} role="alert">
            <h2>That didn't go through</h2>
            <p>Your reservation wasn't saved. Check your connection and try again.</p>
          </div>
        )}
      </div>

      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>Choose your bundle</legend>
        <div className={styles.bundles} id="bundle">
          {BUNDLES.map((b) => (
            <label key={b.id} className={styles.bundle} data-selected={bundle === b.id || undefined}>
              <input
                type="radio"
                name="bundle"
                value={b.id}
                checked={bundle === b.id}
                onChange={() => setBundle(b.id)}
                className={styles.radio}
              />
              <span className={styles.bundleText}>
                <span className={styles.bundleName}>{b.name}</span>
                <span className={`${styles.bundlePrice} tabular`}>{formatGBP(b.price)}</span>
                <span className={styles.bundleDetail}>{b.detail}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className={styles.field}>
        <label htmlFor="extraValves" className={styles.label}>
          Extra radiator valves
        </label>
        <p id="extraValves-hint" className={styles.hint}>
          {formatGBP(EXTRA_VALVE_PRICE)} each. One per radiator you want to control.
        </p>
        <div className={styles.stepper}>
          <button type="button" className={styles.stepButton} onClick={() => setExtra((n) => Math.max(0, n - 1))} disabled={extra <= 0}>
            <Minus weight="bold" aria-hidden="true" /> Fewer
          </button>
          <input
            id="extraValves"
            name="extraValves"
            type="number"
            inputMode="numeric"
            min={0}
            max={MAX_EXTRA_VALVES}
            value={extra}
            onChange={(e) => setExtra(Math.max(0, Math.min(MAX_EXTRA_VALVES, Number(e.target.value) || 0)))}
            className={`${styles.input} ${styles.number} tabular`}
            aria-describedby={["extraValves-hint", describedBy("extraValves")].filter(Boolean).join(" ")}
            aria-invalid={!!errors.extraValves || undefined}
          />
          <button type="button" className={styles.stepButton} onClick={() => setExtra((n) => Math.min(MAX_EXTRA_VALVES, n + 1))} disabled={extra >= MAX_EXTRA_VALVES}>
            <Plus weight="bold" aria-hidden="true" /> More
          </button>
        </div>
        {errors.extraValves && <p id="extraValves-error" className={styles.error}>{errors.extraValves}</p>}
      </div>

      <TextField name="name" label="Full name" autoComplete="name" error={errors.name} />
      <TextField name="email" label="Email address" type="email" autoComplete="email" error={errors.email} hint="We'll only use it for your order." />
      <TextField name="postcode" label="Postcode" autoComplete="postal-code" error={errors.postcode} hint="UK delivery only." short />

      <div className={styles.total}>
        <p>
          Total when it ships <strong className="tabular">{formatGBP(totalPrice(bundle, extra))}</strong>
        </p>
        <p className={styles.hint}>Reserving is free. We email you before taking any payment.</p>
      </div>

      <button type="submit" className={styles.submit} disabled={status === "sending"}>
        {status === "sending" ? "Reserving…" : "Reserve my hub"}
      </button>
    </form>
  );
}

function TextField({
  name,
  label,
  type = "text",
  autoComplete,
  error,
  hint,
  short,
}: {
  name: keyof Preorder;
  label: string;
  type?: string;
  autoComplete: string;
  error?: string;
  hint?: string;
  short?: boolean;
}) {
  const ids = [hint ? `${name}-hint` : null, error ? `${name}-error` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className={styles.field}>
      <label htmlFor={name} className={styles.label}>
        {label}
      </label>
      {hint && (
        <p id={`${name}-hint`} className={styles.hint}>
          {hint}
        </p>
      )}
      <input
        id={name}
        name={name}
        type={type}
        autoComplete={autoComplete}
        className={styles.input}
        data-short={short || undefined}
        aria-describedby={ids}
        aria-invalid={!!error || undefined}
        required
      />
      {error && (
        <p id={`${name}-error`} className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}
