import { describe, expect, it } from "vitest";
import { totalPrice, validatePreorder } from "~/lib/preorder";

const good = { bundle: "hub", extraValves: "2", name: "Ada Okafor", email: "ada@example.com", postcode: "sw1a 1aa" };

describe("pre-order", () => {
  it("accepts a valid reservation and normalises it", () => {
    const r = validatePreorder(good);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual({ ...good, extraValves: 2, postcode: "SW1A 1AA" });
  });

  it("explains each problem in plain words", () => {
    const r = validatePreorder({ bundle: "x", extraValves: "40", name: "", email: "ada@", postcode: "12345" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(Object.keys(r.errors).sort()).toEqual(["bundle", "email", "extraValves", "name", "postcode"]);
      expect(r.errors.postcode).toMatch(/UK postcode/);
    }
  });

  it("prices bundles from one place (hub £179, PRD §4)", () => {
    expect(totalPrice("hub", 0)).toBe(179);
    expect(totalPrice("hub-valves", 0)).toBe(299);
    expect(totalPrice("hub", 3)).toBe(179 + 3 * 32);
  });
});
