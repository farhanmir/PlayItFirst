/**
 * WebSocket client — same-origin /ws with resume tokens and reconnect,
 * adapted from Gitzilla's client/app/net.ts pattern for SoftOpen.
 */
import type { ClientMsg, PlayerRole, ServerMsg } from "../../shared/types";
import { createMovementPrediction } from "./movementPrediction";
import { wsUrl } from "./api";
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
  let joined = false;
  const prediction = createMovementPrediction();
  let you: string | null = null;

  const setStatus = (s: ConnStatus) => statusFns.forEach((f) => f(s));

  const open = () => {
    if (retryTimer) clearTimeout(retryTimer);
    if (closed) return;
    if (ws && (ws.readyState === 0 || ws.readyState === 1)) return;
    setStatus("connecting");
    const sock = new WebSocket(wsUrl());
    ws = sock;
    sock.onopen = () => {
      if (closed || ws !== sock) { sock.close(); return; }
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

    };
    sock.onmessage = (ev) => {
      if (closed || ws !== sock) return;
      let m: ServerMsg;
      try {
        m = JSON.parse(typeof ev.data === "string" ? ev.data : "");
      } catch {
        return;
      }
      if (m.t === "error" && m.terminal) {
        closed = true;
        joined = false;
        if (m.code === "ROOM_NOT_FOUND" || m.code === "JOIN_REJECTED") setResumeToken(room, "");
        if (retryTimer) clearTimeout(retryTimer);
        document.removeEventListener("visibilitychange", onVis);
        sock.close();
      }
      if (m.t === "welcome") {
        joined = true;
        retry = 0;
        setStatus("open");
        if (m.token) setResumeToken(room, m.token);
        you = m.you;
        prediction.reset(m.snapshot.players.find((p) => p.id === you)?.moveAck ?? 0);
      }
      if (m.t === "snapshot" && you) m = { ...m, snapshot: prediction.reconcile(m.snapshot, you) };
      for (const f of msgFns) f(m);
    };
    sock.onclose = (event) => {
      if (ws !== sock) return;
      ws = null;
      joined = false;
      prediction.reset();
      setStatus("closed");
      // A second tab explicitly resumed this identity. Do not fight it by
      // reconnecting and taking ownership back forever.
      if (event?.code === 4001) {
        closed = true;
        document.removeEventListener("visibilitychange", onVis);
        for (const f of msgFns) f({ t: "error", message: "This café was resumed in another tab. Reload to reconnect here." });
      }
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
      if (!closed && joined && ws && ws.readyState === WebSocket.OPEN) {
        if (m.t === "player_move") m = { ...m, ...prediction.record(m.x, m.z) };
        ws.send(JSON.stringify(m));
      }
      // Never replay stale purchases, orders or approvals after reconnecting.
      // The user retries against the fresh authoritative welcome snapshot.
      else if (!closed && m.t !== "player_move") {
        for (const fn of msgFns) fn({ t: "error", message: "Connection interrupted. Wait for reconnection, then try that action again." });
      }
    },
    onMessage(fn) {
      msgFns.push(fn);
    },
    onStatus(fn) {
      statusFns.push(fn);
    },
    close() {
      closed = true;
      joined = false;
      document.removeEventListener("visibilitychange", onVis);
      if (retryTimer) clearTimeout(retryTimer);
      ws?.close();
    },
  };
}
