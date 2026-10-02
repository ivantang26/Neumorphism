// WCAG contrast maths plus the list of colour pairs Thermo must pass.
// Used by scripts/check-contrast.ts (build gate) and tests/contrast.test.ts.

export function luminance(hex: string): number {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const v = parseInt(full.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function ratio(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

export type Palette = Record<string, string>;

/**
 * Pull literal hex tokens out of tokens.css. Returns the soft palette and the
 * high-contrast palette ([data-contrast="more"] overrides merged over soft).
 * Tokens that reference another token (var(--x)) are resolved.
 */
export function parseTokens(css: string): { soft: Palette; more: Palette } {
  const block = (selectorPattern: RegExp) => {
    const m = css.match(selectorPattern);
    if (!m) throw new Error(`Token block not found: ${selectorPattern}`);
    const start = css.indexOf("{", m.index!) + 1;
    let depth = 1;
    let i = start;
    while (depth && i < css.length) {
      if (css[i] === "{") depth++;
      if (css[i] === "}") depth--;
      i++;
    }
    return css.slice(start, i - 1);
  };
  const read = (body: string, base: Palette = {}) => {
    const out: Palette = { ...base };
    for (const [, name, value] of body.matchAll(/--([\w-]+):\s*([^;]+);/g)) out[name] = value.trim();
    for (const k of Object.keys(out)) {
      let v = out[k];
      for (let n = 0; n < 5 && v.startsWith("var(--"); n++) v = out[v.slice(6, -1)] ?? v;
      out[k] = v;
    }
    return Object.fromEntries(Object.entries(out).filter(([, v]) => /^#[0-9a-f]{3,6}$/i.test(v)));
  };
  const soft = read(block(/^:root,\s*\n\[data-contrast="normal"\]\s*\{/m));
  const more = read(block(/^\[data-contrast="more"\]\s*\{/m), soft);
  return { soft, more };
}

export interface Pair {
  fg: string;
  bg: string;
  min: number;
  why: string;
}

/** Every pair the UI relies on. Text is 4.5:1; component boundaries and indicators 3:1. */
export const PAIRS: Pair[] = [
  { fg: "text", bg: "base", min: 4.5, why: "body text" },
  { fg: "text-mute", bg: "base", min: 4.5, why: "secondary text" },
  { fg: "text", bg: "track", min: 4.5, why: "text on pressed track" },
  { fg: "cool-ink", bg: "base", min: 4.5, why: "links and selected option text" },
  { fg: "error-text", bg: "base", min: 4.5, why: "form errors" },
  { fg: "on-warm-text", bg: "warm", min: 4.5, why: "primary button label" },
  { fg: "on-on-text", bg: "on", min: 4.5, why: "text on the on-colour" },
  { fg: "selected-text", bg: "selected-bg", min: 4.5, why: "selected segment label" },
  { fg: "edge-strong", bg: "base", min: 3, why: "control edge ring (PRD §3)" },
  { fg: "edge-strong", bg: "track", min: 3, why: "control ring on inset track" },
  { fg: "focus", bg: "base", min: 3, why: "focus ring" },
  { fg: "warm-ink", bg: "base", min: 3, why: "dial arc outline, primary button edge" },
  { fg: "cool-ink", bg: "base", min: 3, why: "eco arc outline, chart bars" },
  { fg: "on-ink", bg: "base", min: 3, why: "active toggle track edge" },
];
