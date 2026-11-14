/**
 * WebSocket client — same-origin /ws with resume tokens and reconnect,
 * adapted from Gitzilla's client/app/net.ts pattern for SoftOpen.
 */
import type { ClientMsg, PlayerRole, ServerMsg } from "../../shared/types";
import { getResumeToken, setResumeToken } from "./storage";

export type ConnStatus = "connecting" | "open" | "closed";

export interface Conn {
  send(m: ClientMsg): void;
  onMessage(fn: (m: ServerMsg) => void): void;
  onStatus(fn: (s: ConnStatus) => void): void;
  close(): void;
}

export function connect(room: string, name: string, role?: PlayerRole): Conn {
  const msgFns: ((m: ServerMsg) => void)[] = [];
  const statusFns: ((s: ConnStatus) => void)[] = [];
  let ws: WebSocket | null = null;
  let closed = false;
  let retry = 0;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  const queue: ClientMsg[] = [];

  const setStatus = (s: ConnStatus) => statusFns.forEach((f) => f(s));

  const open = () => {
    if (retryTimer) clearTimeout(retryTimer);
    if (closed) return;
    if (ws && (ws.readyState === 0 || ws.readyState === 1)) return;
    setStatus("connecting");
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    const sock = new WebSocket(`${proto}//${location.host}/ws`);
    ws = sock;
    sock.onopen = () => {
      retry = 0;
      const resume = getResumeToken(room) ?? undefined;
      sock.send(
        JSON.stringify({
          t: "hello",
          room,
          name,
          role,
          resume,
        } satisfies ClientMsg),
      );
      setStatus("open");
      while (queue.length) sock.send(JSON.stringify(queue.shift()));
    };
    sock.onmessage = (ev) => {
      let m: ServerMsg;
      try {
        m = JSON.parse(typeof ev.data === "string" ? ev.data : "");
      } catch {
        return;
      }
      if (m.t === "welcome" && m.token) setResumeToken(room, m.token);
      for (const f of msgFns) f(m);
    };
    sock.onclose = () => {
      if (ws !== sock) return;
      ws = null;
      setStatus("closed");
      if (closed) return;
      retry++;
      retryTimer = setTimeout(open, Math.min(4000, 250 * 2 ** Math.min(retry, 4)));
    };
    sock.onerror = () => sock.close();
  };

  open();

  const onVis = () => {
    if (document.visibilityState === "visible" && !ws && !closed) open();
  };
  document.addEventListener("visibilitychange", onVis);

  return {
    send(m) {
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(m));
      else if (m.t !== "player_move") queue.push(m);
    },
    onMessage(fn) {
      msgFns.push(fn);
    },
    onStatus(fn) {
      statusFns.push(fn);
    },
    close() {
      closed = true;
      document.removeEventListener("visibilitychange", onVis);
      if (retryTimer) clearTimeout(retryTimer);
      ws?.close();
    },
  };
}
