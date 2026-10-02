// Build gate: every colour pair the UI relies on meets its WCAG target, in the
// soft palette and in high-contrast mode. Reads the real values from tokens.css.
import { readFileSync } from "node:fs";
import { PAIRS, parseTokens, ratio } from "../src/lib/contrast.ts";

const css = readFileSync(new URL("../src/styles/tokens.css", import.meta.url), "utf8");
const palettes = parseTokens(css);
let failed = 0;

for (const [mode, tokens] of Object.entries(palettes)) {
  console.log(`\n${mode === "soft" ? "Soft palette" : "High contrast"}`);
  for (const p of PAIRS) {
    const fg = tokens[p.fg];
    const bg = tokens[p.bg];
    if (!fg || !bg) {
      console.error(`  MISSING  --${p.fg} or --${p.bg}`);
      failed++;
      continue;
    }
    const r = ratio(fg, bg);
    const ok = r >= p.min;
    if (!ok) failed++;
    console.log(`  ${ok ? "pass" : "FAIL"}  ${r.toFixed(2).padStart(5)}:1  (min ${p.min})  --${p.fg} on --${p.bg}  ${p.why}`);
  }
}

// Shadows alone never carry a boundary: the PRD's own accents are listed here as
// a reminder of why the -ink tokens exist, not as a gate.
console.log("\nPRD accents as fills (informational, bounded by -ink edges):");
for (const k of ["warm", "cool", "on"]) console.log(`  --${k}: ${ratio(palettes.soft[k], palettes.soft.base).toFixed(2)}:1 on --base`);

if (failed) {
  console.error(`\n${failed} contrast check(s) failed.`);
  process.exit(1);
}
console.log("\nAll contrast checks pass.");
