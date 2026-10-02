// Build gate (PRD §8): the dashboard's JavaScript must stay under 250KB gzipped.
// Follows the module graph from the /app page's entry scripts, so it counts what
// the dashboard actually loads, not every chunk in the build.
import { readFileSync, existsSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join, dirname, resolve } from "node:path";

const DIST = resolve("dist");
const BUDGET = 250 * 1024;

function gz(file: string) {
  return gzipSync(readFileSync(file), { level: 9 }).length;
}

function scriptsIn(html: string): string[] {
  const out = new Set<string>();
  for (const m of html.matchAll(/(?:src|component-url|renderer-url|before-hydration-url)="(\/_astro\/[^"]+\.js)"/g)) out.add(m[1]);
  for (const m of html.matchAll(/import\(["'](\/_astro\/[^"']+\.js)["']\)/g)) out.add(m[1]);
  for (const m of html.matchAll(/from\s*["'](\/_astro\/[^"']+\.js)["']/g)) out.add(m[1]);
  return [...out];
}

function walk(entry: string, seen: Set<string>) {
  if (seen.has(entry)) return;
  const file = join(DIST, entry);
  if (!existsSync(file)) return;
  seen.add(entry);
  const src = readFileSync(file, "utf8");
  for (const m of src.matchAll(/(?:import|from)\s*\(?\s*["'](\.{1,2}\/[^"']+\.js)["']/g)) {
    walk(resolve("/", dirname(entry), m[1]).replace(/\\/g, "/").replace(/^[A-Z]:/i, ""), seen);
  }
}

function report(page: string, budget: number | null) {
  const html = readFileSync(join(DIST, page), "utf8");
  const seen = new Set<string>();
  for (const s of scriptsIn(html)) walk(s, seen);
  const css = [...html.matchAll(/href="(\/_astro\/[^"]+\.css)"/g)].map((m) => m[1]);
  const jsBytes = [...seen].reduce((sum, f) => sum + gz(join(DIST, f)), 0);
  const cssBytes = css.reduce((sum, f) => sum + gz(join(DIST, f)), 0);
  const kb = (n: number) => `${(n / 1024).toFixed(1)}KB`;
  const ok = budget === null || jsBytes <= budget;
  console.log(
    `${ok ? "pass" : "FAIL"}  ${page.padEnd(22)} JS ${kb(jsBytes).padStart(8)} gz (${seen.size} files)   CSS ${kb(cssBytes).padStart(7)} gz${budget ? `   budget ${kb(budget)}` : ""}`,
  );
  return ok;
}

console.log("Gzipped weight of what each page loads:\n");
const results = [
  report("app/index.html", BUDGET),
  report("index.html", null),
  report("pre-order/index.html", null),
];
if (results.includes(false)) {
  console.error("\nThe dashboard is over its 250KB gzipped budget.");
  process.exit(1);
}
console.log("\nDashboard is within budget.");
