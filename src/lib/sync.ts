// Client side of the hub connection (FR-7).
//
// The dashboard shows `confirmed` state from the hub with any still-pending
// commands replayed on top, so a tap shows its result immediately. When the hub
// acknowledges a command it is dropped from the queue (the broadcast state
// already contains it). When the hub rejects it, or it times out, it is dropped
// too, which rolls the UI back with no special undo code.

import { applyAction, describeAction, type Action, type HomeState } from "./home";

export type Status = "connecting" | "online" | "offline";

export type ServerMessage =
  | { t: "state"; rev: number; state: HomeState }
  | { t: "ack"; id: string }
  | { t: "nack"; id: string; reason: string }
  | { t: "ping" };

export type ClientMessage = { t: "cmd"; id: string; action: Action };

interface Pending {
  id: string;
  action: Action;
  timer: ReturnType<typeof setTimeout>;
}

export interface Snapshot {
  view: HomeState | null;
  status: Status;
  /** When the hub last sent state (ms since epoch). Shown in the offline banner. */
  lastSync: number | null;
  pending: number;
}

export interface SocketLike {
  readyState: number;
  send(data: string): void;
  close(): void;
  onopen: ((ev: unknown) => void) | null;
  onclose: ((ev: unknown) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onerror: ((ev: unknown) => void) | null;
}

export interface HubClientOptions {
  url: string;
  /** How long to wait for the hub to confirm a command before rolling it back. */
  timeout?: number;
  createSocket?: (url: string) => SocketLike;
  storage?: Pick<Storage, "getItem" | "setItem"> | null;
  /** A silent connection is treated as dead after this long. The hub pings every 5s. */
  watchdog?: number;
}

const CACHE_KEY = "thermo:last-state";
const OPEN = 1;

export class HubClient {
  private confirmed: HomeState | null = null;
  private queue: Pending[] = [];
  private socket: SocketLike | null = null;
  private status: Status = "connecting";
  private lastSync: number | null = null;
  private listeners = new Set<() => void>();
  private errorListeners = new Set<(message: string) => void>();
  private snapshot: Snapshot = { view: null, status: "connecting", lastSync: null, pending: 0 };
  private retry = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private watchdogTimer: ReturnType<typeof setTimeout> | null = null;
  private closed = false;
  private seq = 0;
  private readonly opts: Required<Omit<HubClientOptions, "storage">> & Pick<HubClientOptions, "storage">;

  constructor(options: HubClientOptions) {
    this.opts = {
      timeout: 4000,
      watchdog: 12000,
      createSocket: (url) => new WebSocket(url) as unknown as SocketLike,
      ...options,
    };
    const cached = this.readCache();
    if (cached) {
      this.confirmed = cached.state;
      this.lastSync = cached.savedAt;
    }
    this.publish();
  }

  connect(): void {
    this.closed = false;
    if (this.socket) return;
    const socket = this.opts.createSocket(this.opts.url);
    this.socket = socket;
    socket.onopen = () => {
      this.retry = 0;
      this.kick();
    };
    socket.onmessage = (ev) => {
      this.kick();
      let msg: ServerMessage;
      try {
        msg = JSON.parse(String(ev.data));
      } catch {
        return;
      }
      this.receive(msg);
    };
    socket.onclose = () => this.dropped(socket);
    socket.onerror = () => socket.close();
  }

  close(): void {
    this.closed = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    if (this.watchdogTimer) clearTimeout(this.watchdogTimer);
    const s = this.socket;
    this.socket = null;
    s?.close();
  }

  /** Force a reconnect now, for the browser's `online` event or a "Try again" button. */
  reconnect(): void {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    this.retry = 0;
    if (this.socket && this.socket.readyState !== OPEN) {
      const s = this.socket;
      this.socket = null;
      s.onclose = null;
      s.close();
    }
    this.connect();
  }

  /** Mark the connection lost straight away (browser `offline` event). */
  goOffline(): void {
    this.socket?.close();
  }

  /** Send a command optimistically. Returns false (and changes nothing) when offline. */
  send(action: Action): boolean {
    if (this.status !== "online" || !this.socket || this.socket.readyState !== OPEN || !this.confirmed) return false;
    // Validate locally first: an action the reducer rejects never leaves the device.
    try {
      applyAction(this.viewState()!, action);
    } catch {
      return false;
    }
    const id = `c${Date.now().toString(36)}${(this.seq++).toString(36)}`;
    const timer = setTimeout(() => this.settle(id, "timeout"), this.opts.timeout);
    this.queue.push({ id, action, timer });
    const msg: ClientMessage = { t: "cmd", id, action };
    this.socket.send(JSON.stringify(msg));
    this.publish();
    return true;
  }

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  onError(fn: (message: string) => void): () => void {
    this.errorListeners.add(fn);
    return () => this.errorListeners.delete(fn);
  }

  getSnapshot = (): Snapshot => this.snapshot;

  private receive(msg: ServerMessage) {
    switch (msg.t) {
      case "state":
        this.confirmed = msg.state;
        this.lastSync = Date.now();
        if (this.status !== "online") this.status = "online";
        this.writeCache();
        this.publish();
        break;
      case "ack":
        this.settle(msg.id, null);
        break;
      case "nack":
        this.settle(msg.id, msg.reason);
        break;
      case "ping":
        break;
    }
  }

  private settle(id: string, failure: string | null) {
    const i = this.queue.findIndex((p) => p.id === id);
    if (i === -1) return;
    const [p] = this.queue.splice(i, 1);
    clearTimeout(p.timer);
    if (failure && this.confirmed) {
      const what = describeAction(this.confirmed, p.action);
      const why = failure === "timeout" ? "didn't respond in time" : "couldn't be changed";
      this.emitError(`${capitalise(what)} ${why}. Your change was undone.`);
    }
    this.publish();
  }

  private dropped(socket: SocketLike) {
    if (this.socket !== socket) return;
    this.socket = null;
    if (this.watchdogTimer) clearTimeout(this.watchdogTimer);
    const hadPending = this.queue.length > 0;
    for (const p of this.queue) clearTimeout(p.timer);
    this.queue = [];
    this.status = "offline";
    if (hadPending) this.emitError("Thermo lost its connection, so your last change was undone.");
    this.publish();
    if (this.closed) return;
    const delay = Math.min(8000, 500 * 2 ** this.retry++);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.connect();
    }, delay);
  }

  private kick() {
    if (this.watchdogTimer) clearTimeout(this.watchdogTimer);
    const s = this.socket;
    this.watchdogTimer = setTimeout(() => s?.close(), this.opts.watchdog);
  }

  private viewState(): HomeState | null {
    let view = this.confirmed;
    if (!view) return null;
    for (const p of this.queue) {
      try {
        view = applyAction(view, p.action);
      } catch {
        // A pending command that no longer applies (the room changed underneath it) is skipped.
      }
    }
    return view;
  }

  private publish() {
    this.snapshot = {
      view: this.viewState(),
      status: this.status,
      lastSync: this.lastSync,
      pending: this.queue.length,
    };
    for (const fn of this.listeners) fn();
  }

  private emitError(message: string) {
    for (const fn of this.errorListeners) fn(message);
  }

  private readCache(): { state: HomeState; savedAt: number } | null {
    try {
      const raw = this.opts.storage?.getItem(CACHE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  private writeCache() {
    try {
      this.opts.storage?.setItem(CACHE_KEY, JSON.stringify({ state: this.confirmed, savedAt: this.lastSync }));
    } catch {
      // Storage full or blocked: the offline banner just has less to show.
    }
  }
}

function capitalise(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
