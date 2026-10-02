import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { PAIRS, parseTokens, ratio } from "~/lib/contrast";

const css = readFileSync(new URL("../src/styles/tokens.css", import.meta.url), "utf8");
const { soft, more } = parseTokens(css);

describe("contrast strategy (PRD §3, §8)", () => {
  it("keeps the PRD's colour tokens exactly", () => {
    expect(soft).toMatchObject({
      base: "#e4e9f0",
      "shadow-light": "#ffffff",
      "shadow-dark": "#a9b4c4",
      edge: "#b8c2d0",
      "edge-strong": "#6f7a8e",
      text: "#2a3342",
      "text-mute": "#56627a",
      warm: "#ff7a45",
      cool: "#3e8ef7",
      on: "#2fbf71",
    });
  });

  it("matches the ratios quoted in the PRD", () => {
    expect(ratio(soft.text, soft.base)).toBeCloseTo(10.4, 1);
    expect(ratio(soft["text-mute"], soft.base)).toBeGreaterThanOrEqual(5);
    expect(ratio(soft["edge-strong"], soft.base)).toBeCloseTo(3.5, 1);
  });

  for (const [name, palette] of [
    ["soft", soft],
    ["high contrast", more],
  ] as const) {
    it(`every pair passes in the ${name} palette`, () => {
      for (const p of PAIRS) {
        expect(ratio(palette[p.fg], palette[p.bg]), `--${p.fg} on --${p.bg}`).toBeGreaterThanOrEqual(p.min);
      }
    });
  }

  it("high contrast removes the soft shadows (FR-5)", () => {
    expect(css).toMatch(/\[data-contrast="more"\] \{[^}]*--raised: none;[^}]*--pressed: none;[^}]*--bw: 2px;/s);
    expect(css).toMatch(/@media \(prefers-contrast: more\)/);
  });
});
