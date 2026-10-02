import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initialHome, roomTarget } from "~/lib/home";
import { HubClient, type ServerMessage, type SocketLike } from "~/lib/sync";

class FakeSocket implements SocketLike {
  readyState = 0;
  sent: { t: string; id: string; action: unknown }[] = [];
  onopen: SocketLike["onopen"] = null;
  onclose: SocketLike["onclose"] = null;
  onmessage: SocketLike["onmessage"] = null;
  onerror: SocketLike["onerror"] = null;
  send(data: string) {
    this.sent.push(JSON.parse(data));
  }
  close() {
    if (this.readyState === 3) return;
    this.readyState = 3;
    this.onclose?.({});
  }
  open() {
    this.readyState = 1;
    this.onopen?.({});
  }
  push(msg: ServerMessage) {
    this.onmessage?.({ data: JSON.stringify(msg) });
  }
}

function memoryStorage() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
}

describe("optimistic sync with rollback (FR-7)", () => {
  let sockets: FakeSocket[];
  let client: HubClient;
  let errors: string[];
  const storage = memoryStorage();

  beforeEach(() => {
    vi.useFakeTimers();
    sockets = [];
    errors = [];
    client = new HubClient({
      url: "ws://test/hub",
      timeout: 2000,
      storage,
      createSocket: () => {
        const s = new FakeSocket();
        sockets.push(s);
        return s;
      },
    });
    client.onError((m) => errors.push(m));
    client.connect();
    sockets[0].open();
    sockets[0].push({ t: "state", rev: 1, state: initialHome() });
  });
  afterEach(() => {
    client.close();
    vi.useRealTimers();
  });

  const target = () => client.getSnapshot().view!.target;

  it("shows a change immediately, before the hub answers", () => {
    expect(client.send({ type: "setTarget", value: 23 })).toBe(true);
    expect(target()).toBe(23);
    expect(client.getSnapshot().pending).toBe(1);
    expect(sockets[0].sent[0]).toMatchObject({ t: "cmd", action: { type: "setTarget", value: 23 } });
  });

  it("keeps the change once the hub confirms it", () => {
    client.send({ type: "setTarget", value: 23 });
    const id = sockets[0].sent[0].id;
    sockets[0].push({ t: "state", rev: 2, state: { ...initialHome(), target: 23 } });
    sockets[0].push({ t: "ack", id });
    expect(target()).toBe(23);
    expect(client.getSnapshot().pending).toBe(0);
    expect(errors).toEqual([]);
  });

  it("rolls back and explains when the hub rejects a change", () => {
    client.send({ type: "setRoomHeating", room: "kitchen", on: false });
    expect(client.getSnapshot().view!.rooms[1].heating).toBe(false);
    sockets[0].push({ t: "nack", id: sockets[0].sent[0].id, reason: "device" });
    expect(client.getSnapshot().view!.rooms[1].heating).toBe(true);
    expect(errors[0]).toMatch(/Kitchen heating couldn't be changed\. Your change was undone\./);
  });

  it("rolls back when the hub doesn't answer in time", () => {
    client.send({ type: "setTarget", value: 25 });
    vi.advanceTimersByTime(2001);
    expect(target()).toBe(21);
    expect(errors[0]).toMatch(/didn't respond in time/);
  });

  it("rolls back only the failed change when several are in flight", () => {
    client.send({ type: "setTarget", value: 22 });
    client.send({ type: "setRoomTarget", room: "office", value: 18 });
    const [first, second] = sockets[0].sent;
    sockets[0].push({ t: "nack", id: first.id, reason: "device" });
    const view = client.getSnapshot().view!;
    expect(view.target).toBe(21);
    expect(roomTarget(view, view.rooms[3])).toBe(18);
    sockets[0].push({ t: "ack", id: second.id });
  });

  it("refuses changes while offline and keeps the last known state", () => {
    sockets[0].close();
    const snap = client.getSnapshot();
    expect(snap.status).toBe("offline");
    expect(snap.view!.target).toBe(21);
    expect(client.send({ type: "setTarget", value: 24 })).toBe(false);
  });

  it("drops in-flight changes if the connection is lost", () => {
    client.send({ type: "setTarget", value: 24 });
    sockets[0].close();
    expect(target()).toBe(21);
    expect(errors[0]).toMatch(/lost its connection/);
  });

  it("reconnects with backoff", () => {
    sockets[0].close();
    vi.advanceTimersByTime(600);
    expect(sockets).toHaveLength(2);
  });

  it("starts from the cached state on the next launch (offline banner shows it)", () => {
    const next = new HubClient({ url: "ws://x", storage, createSocket: () => new FakeSocket() });
    expect(next.getSnapshot().view?.name).toBe("Alder House");
    expect(next.getSnapshot().lastSync).not.toBeNull();
  });

  it("never sends an action the reducer would reject", () => {
    expect(client.send({ type: "setLight", room: "living", light: "missing" })).toBe(false);
    expect(sockets[0].sent).toHaveLength(0);
  });
});
