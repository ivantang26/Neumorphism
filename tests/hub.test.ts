// End-to-end over real WebSockets: two screens connected to one hub.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import WebSocket from "ws";
import { createHub, type Hub } from "../server/hub";
import type { ServerMessage } from "~/lib/sync";

let server: Server;
let hub: Hub;
let url: string;

beforeAll(async () => {
  hub = createHub({ dataDir: null, latency: [20, 40], tickMs: 0, pingMs: 0 });
  server = createServer();
  server.on("upgrade", (req, socket, head) => hub.handleUpgrade(req, socket, head));
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  url = `ws://127.0.0.1:${(server.address() as AddressInfo).port}/hub`;
});

afterAll(() => {
  hub.close();
  server.close();
});

function connect() {
  const ws = new WebSocket(url);
  const inbox: ServerMessage[] = [];
  const waiters: [(m: ServerMessage) => boolean, (m: ServerMessage) => void][] = [];
  ws.on("message", (raw) => {
    const m = JSON.parse(String(raw)) as ServerMessage;
    inbox.push(m);
    for (const [i, [test, resolve]] of waiters.entries()) {
      if (test(m)) {
        waiters.splice(i, 1);
        resolve(m);
        break;
      }
    }
  });
  const next = (test: (m: ServerMessage) => boolean, ms = 2000) =>
    new Promise<ServerMessage>((resolve, reject) => {
      const hit = inbox.find(test);
      if (hit) return resolve(hit);
      waiters.push([test, resolve]);
      setTimeout(() => reject(new Error("timed out")), ms);
    });
  const opened = new Promise((r) => ws.on("open", r));
  return { ws, inbox, next, opened };
}

describe("hub", () => {
  it("sends the current state on connect", async () => {
    const a = connect();
    const m = await a.next((m) => m.t === "state");
    expect(m.t === "state" && m.state.rooms).toHaveLength(5);
    a.ws.close();
  });

  it("a change on one screen reaches another within 1 second (acceptance criterion)", async () => {
    const a = connect();
    const b = connect();
    await Promise.all([a.opened, b.opened, a.next((m) => m.t === "state"), b.next((m) => m.t === "state")]);
    b.inbox.length = 0;

    const sent = performance.now();
    a.ws.send(JSON.stringify({ t: "cmd", id: "t1", action: { type: "setTarget", value: 23.5 } }));
    const seen = await b.next((m) => m.t === "state" && m.state.target === 23.5);
    const elapsed = performance.now() - sent;

    expect(seen.t).toBe("state");
    expect(elapsed).toBeLessThan(1000);
    await a.next((m) => m.t === "ack" && m.id === "t1");
    a.ws.close();
    b.ws.close();
  });

  it("rejects invalid actions without changing state", async () => {
    const a = connect();
    await a.opened;
    const before = hub.getState();
    a.ws.send(JSON.stringify({ t: "cmd", id: "bad", action: { type: "setRoomHeating", room: "attic", on: true } }));
    const m = await a.next((m) => m.t === "nack" && m.id === "bad");
    expect(m.t === "nack" && m.reason).toMatch(/Unknown room/);
    expect(hub.getState()).toBe(before);
    a.ws.close();
  });

  it("simulated device failures are rejected, and the fail switch itself always works", async () => {
    const a = connect();
    await a.opened;
    a.ws.send(JSON.stringify({ t: "cmd", id: "f1", action: { type: "setFailRate", value: 1 } }));
    await a.next((m) => m.t === "ack" && m.id === "f1");
    a.ws.send(JSON.stringify({ t: "cmd", id: "f2", action: { type: "setTarget", value: 19 } }));
    await a.next((m) => m.t === "nack" && m.id === "f2");
    a.ws.send(JSON.stringify({ t: "cmd", id: "f3", action: { type: "setFailRate", value: 0 } }));
    await a.next((m) => m.t === "ack" && m.id === "f3");
    expect(hub.getState().failRate).toBe(0);
    a.ws.close();
  });

  it("warms rooms that are calling for heat", () => {
    const before = hub.getState().rooms.find((r) => r.id === "living")!.current;
    hub.tick();
    const after = hub.getState().rooms.find((r) => r.id === "living")!.current;
    expect(after).not.toBe(before);
  });
});
