import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("./api", () => ({ wsUrl: () => "ws://test/ws" }));
vi.mock("./storage", () => ({ getResumeToken: () => "resume-token", setResumeToken: vi.fn() }));
import { connect } from "./net";

class FakeSocket {
  static OPEN = 1;
  static sockets: FakeSocket[] = [];
  readyState = 0;
  onopen?: () => void;
  onclose?: () => void;
  onerror?: () => void;
  onmessage?: (event: { data: string }) => void;
  sent: any[] = [];
  constructor() { FakeSocket.sockets.push(this); }
  send(data: string) { this.sent.push(JSON.parse(data)); }
  close() { this.readyState = 3; this.onclose?.(); }
  open() { this.readyState = 1; this.onopen?.(); }
  receive(message: unknown) { this.onmessage?.({ data: JSON.stringify(message) }); }
  welcome() { this.receive({ t: "welcome", token: "new-token", you: "me", snapshot: { players: [{ id: "me" }] } }); }
}

beforeEach(() => {
  vi.useFakeTimers();
  FakeSocket.sockets = [];
  vi.stubGlobal("WebSocket", FakeSocket);
  vi.stubGlobal("document", { addEventListener: vi.fn(), removeEventListener: vi.fn(), visibilityState: "visible" });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("connection recovery", () => {
  it("waits for welcome and never buffers offline financial or service actions", () => {
    const conn = connect("abc", "Guest");
    const first = FakeSocket.sockets[0];
    const statuses: string[] = [];
    conn.onStatus(s => statuses.push(s));
    for (let i = 0; i < 1000; i++) conn.send({ t: "interact", action: "restock" });
    first.open();
    expect(first.sent.map(m => m.t)).toEqual(["hello"]);
    expect(statuses).not.toContain("open");
    first.welcome();
    conn.send({ t: "interact", action: "take_order" });
    expect(first.sent.at(-1).action).toBe("take_order");
    first.close();
    conn.send({ t: "interact", action: "restock" });
    vi.advanceTimersByTime(500);
    const second = FakeSocket.sockets[1];
    second.open(); second.welcome();
    expect(second.sent.map(m => m.t)).toEqual(["hello"]);
    expect(second.sent[0].resume).toBe("resume-token");
    conn.close();
  });

  it.each(["ROOM_NOT_FOUND", "SESSION_REPLACED", "JOIN_REJECTED"])("stops reconnecting after %s", code => {
    const conn = connect("missing", "Guest");
    const listener = vi.fn(); conn.onMessage(listener);
    const socket = FakeSocket.sockets[0]; socket.open();
    socket.receive({ t: "error", code, terminal: true, message: "Room unavailable" });
    vi.advanceTimersByTime(60000);
    expect(FakeSocket.sockets).toHaveLength(1);
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ terminal: true, code }));
    expect(socket.readyState).toBe(3);
    conn.close();
  });
});
