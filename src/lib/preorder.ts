// Pre-order bundles and validation, used by the pre-order page and the API.

export const BUNDLES = [
  {
    id: "hub",
    name: "Thermo hub",
    price: 179,
    detail: "The hub and its wall stand. It replaces your thermostat and runs the whole home to one target.",
  },
  {
    id: "hub-valves",
    name: "Hub with 4 radiator valves",
    price: 299,
    detail: "Adds four Thermo smart valves so every room can be set on its own.",
  },
] as const;

export const EXTRA_VALVE_PRICE = 32;
export const MAX_EXTRA_VALVES = 12;

export type BundleId = (typeof BUNDLES)[number]["id"];

export interface Preorder {
  bundle: BundleId;
  extraValves: number;
  name: string;
  email: string;
  postcode: string;
}

export type PreorderResult =
  | { ok: true; value: Preorder }
  | { ok: false; errors: Partial<Record<keyof Preorder, string>> };

// UK postcode, loosely: outward code, optional space, inward code.
const POSTCODE = /^[A-Z]{1,2}[0-9][A-Z0-9]?\s?[0-9][A-Z]{2}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function totalPrice(bundle: BundleId, extraValves: number): number {
  const b = BUNDLES.find((x) => x.id === bundle) ?? BUNDLES[0];
  return b.price + Math.max(0, extraValves) * EXTRA_VALVE_PRICE;
}

export function validatePreorder(input: Record<string, unknown>): PreorderResult {
  const errors: Partial<Record<keyof Preorder, string>> = {};
  const str = (k: string) => (typeof input[k] === "string" ? (input[k] as string).trim() : "");

  const bundle = str("bundle") as BundleId;
  if (!BUNDLES.some((b) => b.id === bundle)) errors.bundle = "Choose a bundle.";

  const extraValves = Number(input.extraValves ?? 0);
  if (!Number.isInteger(extraValves) || extraValves < 0 || extraValves > MAX_EXTRA_VALVES)
    errors.extraValves = `Choose between 0 and ${MAX_EXTRA_VALVES} extra valves.`;

  const name = str("name");
  if (!name) errors.name = "Enter your name.";
  else if (name.length > 80) errors.name = "Name must be 80 characters or fewer.";

  const email = str("email");
  if (!email) errors.email = "Enter your email address.";
  else if (!EMAIL.test(email) || email.length > 254) errors.email = "Enter an email address like name@example.com.";

  const postcode = str("postcode").toUpperCase();
  if (!postcode) errors.postcode = "Enter your postcode.";
  else if (!POSTCODE.test(postcode)) errors.postcode = "Enter a UK postcode like SW1A 1AA.";

  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { bundle, extraValves, name, email, postcode } };
}

export function formatGBP(n: number): string {
  return `£${n.toLocaleString("en-GB")}`;
}
