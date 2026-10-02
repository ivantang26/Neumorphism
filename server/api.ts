// Small first-party JSON API, shared by the dev server and scripts/serve.ts.
//
//   POST /api/preorder   reserve a hub (no payment is taken; pre-order is a reservation)
//   POST /api/event      anonymous daily counters for the §10 success metrics
//   GET  /api/metrics    those counters plus landing conversion
//
// Nothing here sets cookies or stores IP addresses.

import type { IncomingMessage, ServerResponse } from "node:http";
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { validatePreorder } from "../src/lib/preorder.ts";

const EVENTS = new Set(["landing_view", "preorder", "scene_used", "high_contrast_on", "dashboard_view", "temp_changed"]);

export function apiHandler({ dataDir = "data" }: { dataDir?: string } = {}) {
  const metricsFile = join(dataDir, "metrics.json");
  const preorderFile = join(dataDir, "preorders.jsonl");

  const readMetrics = (): Record<string, Record<string, number>> => {
    try {
      return JSON.parse(readFileSync(metricsFile, "utf8"));
    } catch {
      return {};
    }
  };
  const count = (name: string) => {
    const day = new Date().toISOString().slice(0, 10);
    const m = readMetrics();
    m[day] ??= {};
    m[day][name] = (m[day][name] ?? 0) + 1;
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(metricsFile, JSON.stringify(m, null, 1));
  };

  return async function handle(req: IncomingMessage, res: ServerResponse) {
    const url = new URL(req.url ?? "/", "http://local");
    try {
      if (url.pathname === "/api/preorder" && req.method === "POST") {
        const body = await readBody(req);
        const isForm = (req.headers["content-type"] ?? "").includes("application/x-www-form-urlencoded");
        const input = isForm ? Object.fromEntries(new URLSearchParams(body)) : JSON.parse(body || "{}");
        const result = validatePreorder(input);
        if (!result.ok) {
          if (isForm) return redirect(res, `/pre-order?error=${encodeURIComponent(Object.keys(result.errors)[0])}`);
          return json(res, 422, { ok: false, errors: result.errors });
        }
        const ref = `TH-${Date.now().toString(36).toUpperCase().slice(-6)}`;
        mkdirSync(dataDir, { recursive: true });
        appendFileSync(preorderFile, JSON.stringify({ ref, at: new Date().toISOString(), ...result.value }) + "\n");
        count("preorder");
        if (isForm) return redirect(res, `/pre-order/thanks?ref=${ref}`);
        return json(res, 200, { ok: true, ref });
      }

      if (url.pathname === "/api/event" && req.method === "POST") {
        const body = await readBody(req);
        const name = (() => {
          try {
            return JSON.parse(body).name;
          } catch {
            return null;
          }
        })();
        // Honour Do Not Track and Global Privacy Control.
        const optOut = req.headers["dnt"] === "1" || req.headers["sec-gpc"] === "1";
        if (typeof name === "string" && EVENTS.has(name) && !optOut) count(name);
        res.writeHead(204).end();
        return;
      }

      if (url.pathname === "/api/metrics" && req.method === "GET") {
        const token = process.env.METRICS_TOKEN;
        if (token && req.headers.authorization !== `Bearer ${token}`) return json(res, 401, { ok: false });
        const days = readMetrics();
        const totals: Record<string, number> = {};
        for (const d of Object.values(days)) for (const [k, v] of Object.entries(d)) totals[k] = (totals[k] ?? 0) + v;
        const views = totals.landing_view ?? 0;
        return json(res, 200, {
          totals,
          landingConversion: views ? Math.round(((totals.preorder ?? 0) / views) * 10000) / 100 : null,
          conversionTarget: 3,
          days,
        });
      }

      json(res, 404, { ok: false });
    } catch (err) {
      console.error("[api]", err);
      json(res, 400, { ok: false });
    }
  };
}

function readBody(req: IncomingMessage, limit = 16 * 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > limit) {
        reject(new Error("Body too large"));
        req.destroy();
      } else chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}

function redirect(res: ServerResponse, to: string) {
  res.writeHead(303, { location: to }).end();
}
