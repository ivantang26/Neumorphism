// Simulated Thermo hub. Stands in for the cloud API + Matter devices (PRD §9).
//
// - WebSocket on /hub. Every accepted command is applied with the shared reducer
//   and the new state is broadcast to every connected screen straight away, so
//   a second device sees the change well inside the 1 second target (FR-7).
// - Devices answer after a short, realistic delay and can be told to fail a
//   share of commands (Settings > "Simulate an unreliable hub") to demonstrate rollback.
// - A slow tick moves room temperatures toward their targets so the dashboard is live.

import { WebSocketServer, type WebSocket } from "ws";
import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  ActionError,
  applyAction,
  initialHome,
  isHeating,
  roomTarget,
  type Action,
  type HomeState,
} from "../src/lib/home.ts";
import type { ClientMessage, ServerMessage } from "../src/lib/sync.ts";

export interface HubOptions {
  dataDir?: string | null;
  /** Device response delay range in ms. Tests set this to [0, 0]. */
  latency?: [number, number];
  tickMs?: number;
  pingMs?: number;
  random?: () => number;
}

export interface Hub {
  handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): void;
  getState(): HomeState;
  /** Advance the simulation one step (exposed for tests). */
  tick(): void;
  close(): void;
}

export function createHub(opts: HubOptions = {}): Hub {
  const { dataDir = "data", latency = [80, 220], tickMs = 3000, pingMs = 5000, random = Math.random } = opts;
  const file = dataDir ? join(dataDir, "home.json") : null;
  let state = load(file);
  let rev = 0;
  let saveTimer: ReturnType<typeof setTimeout> | null = null;

  const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });

  const send = (ws: WebSocket, msg: ServerMessage) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
  };
  const broadcast = () => {
    rev++;
    const data = JSON.stringify({ t: "state", rev, state } satisfies ServerMessage);
    for (const ws of wss.clients) if (ws.readyState === ws.OPEN) ws.send(data);
    scheduleSave();
  };

  const scheduleSave = () => {
    if (!file || saveTimer) return;
    saveTimer = setTimeout(() => {
      saveTimer = null;
      try {
        mkdirSync(dataDir!, { recursive: true });
        writeFileSync(file, JSON.stringify(state, null, 1));
      } catch (err) {
        console.warn("[hub] could not save state", err);
      }
    }, 500);
  };

  wss.on("connection", (ws) => {
    send(ws, { t: "state", rev, state });
    ws.on("message", (raw) => {
      let msg: ClientMessage;
      try {
        msg = JSON.parse(String(raw));
      } catch {
        return;
      }
      if (msg?.t !== "cmd" || typeof msg.id !== "string" || !msg.action) return;
      handleCommand(ws, msg.id, msg.action);
    });
  });

  function handleCommand(ws: WebSocket, id: string, action: Action) {
    const [lo, hi] = latency;
    const delay = lo + random() * (hi - lo);
    // The fail-rate switch itself must always work, or you couldn't turn it off.
    const fails = action.type !== "setFailRate" && random() < state.failRate;
    setTimeout(() => {
      if (fails) return send(ws, { t: "nack", id, reason: "device" });
      try {
        state = applyAction(state, action);
      } catch (err) {
        return send(ws, { t: "nack", id, reason: err instanceof ActionError ? err.message : "invalid" });
      }
      broadcast();
      send(ws, { t: "ack", id });
    }, delay);
  }

  function tick() {
    let changed = false;
    const rooms = state.rooms.map((room) => {
      const target = roomTarget(state, room);
      let current = room.current;
      // Radiators add about 0.5°C a minute while calling for heat; every room
      // leaks a little toward a floor set by the weather. The gap between the
      // two gives a realistic on/off cycle around the target.
      if (isHeating(state, room)) current = Math.min(target + 0.3, current + 0.025);
      const floor = Math.max(state.outdoor + 6, 12);
      if (current > floor) current -= 0.006;
      current = Math.round(current * 1000) / 1000;
      if (current !== room.current) changed = true;
      return { ...room, current };
    });
    const heatingRooms = rooms.filter((r) => isHeating(state, r)).length;
    const energy = [...state.energy];
    if (heatingRooms) {
      energy[energy.length - 1] = Math.round((energy[energy.length - 1] + 0.004 * heatingRooms) * 1000) / 1000;
      changed = true;
    }
    if (changed) {
      state = { ...state, rooms, energy };
      broadcast();
    }
  }

  const tickTimer = tickMs > 0 ? setInterval(tick, tickMs) : null;
  const pingTimer =
    pingMs > 0
      ? setInterval(() => {
          for (const ws of wss.clients) send(ws, { t: "ping" });
        }, pingMs)
      : null;

  return {
    handleUpgrade(req, socket, head) {
      wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
    },
    getState: () => state,
    tick,
    close() {
      if (tickTimer) clearInterval(tickTimer);
      if (pingTimer) clearInterval(pingTimer);
      for (const ws of wss.clients) ws.terminate();
      wss.close();
    },
  };
}

function load(file: string | null): HomeState {
  if (!file) return initialHome();
  try {
    const saved = JSON.parse(readFileSync(file, "utf8")) as HomeState;
    // A saved file from an older model shape is ignored rather than trusted.
    if (Array.isArray(saved.rooms) && saved.rooms.length === 5 && typeof saved.target === "number") return saved;
  } catch {
    // First run.
  }
  return initialHome();
}
