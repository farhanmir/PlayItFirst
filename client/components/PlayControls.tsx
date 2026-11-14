import { useEffect, useMemo, useRef } from "react";
import type { RoomSnapshot } from "../../shared/types";
import { nearestStation } from "../../shared/stations";
import { useApp } from "../lib/store";
import { play } from "../lib/audio";
import { suggestedAction, stationLabel, type PlayAction } from "../lib/suggestAction";

export function PlayControls({ snapshot }: { snapshot: RoomSnapshot }) {
  const conn = useApp((s) => s.conn);
  const you = useApp((s) => s.you);
  const me = snapshot.players.find((p) => p.id === you);
  const mobile = useApp((s) => s.mobile);
  const meRef = useRef(me);
  meRef.current = me;

  const station = useMemo(() => (you ? nearestStation(snapshot, you) : null), [snapshot, you]);
  const suggest = useMemo(() => suggestedAction(snapshot, you), [snapshot, you]);
  const nearLabel = stationLabel(station);
  const jamieHelping =
    !!snapshot.aiBarista?.holding ||
    (snapshot.metrics.queueLength >= 3 &&
      snapshot.simTime - (snapshot.lastHumanInteractAt ?? 0) >= 4);

  useEffect(() => {
    if (!conn) return;
    const keys = new Set<string>();
    const onDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      keys.add(k);
      if (k === "e") act("take_order");
      if (k === "f") act("make_coffee");
      if (k === "r") act("serve");
      if (k === "q") act("restock");
      if (k === " " || k === "enter") {
        e.preventDefault();
        const next = suggestedAction(useApp.getState().snapshot ?? snapshot, useApp.getState().you);
        if (next) act(next);
      }
    };
    const onUp = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);

    const id = setInterval(() => {
      const current = meRef.current;
      if (!current) return;
      let x = current.x;
      let z = current.z;
      const speed = 0.2;
      if (keys.has("w") || keys.has("arrowup")) z -= speed;
      if (keys.has("s") || keys.has("arrowdown")) z += speed;
      if (keys.has("a") || keys.has("arrowleft")) x -= speed;
      if (keys.has("d") || keys.has("arrowright")) x += speed;
      if (x !== current.x || z !== current.z) conn.send({ t: "player_move", x, z });
    }, 50);

    return () => {
      clearInterval(id);
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, [conn]);

  const act = (action: PlayAction) => {
    conn?.send({ t: "interact", action });
    if (action === "take_order") play("order");
    if (action === "make_coffee") play("brew");
    if (action === "serve") {
      play("serve");
      play("coin", 0.3);
    }
    if (action === "restock") play("place");
    if (action === "collect") play("coin");
  };

  const holding = me?.holding
    ? me.holding.startsWith("ticket:")
      ? `Ticket · ${me.holding.slice(7)}`
      : me.holding.startsWith("drink:")
        ? `Drink · ${me.holding.slice(6)}`
        : me.holding
    : "Hands empty";

  const actions: { id: PlayAction; label: string }[] = [
    { id: "take_order", label: "Take order" },
    { id: "make_coffee", label: "Make coffee" },
    { id: "serve", label: "Serve" },
    { id: "restock", label: "Restock" },
    { id: "collect", label: "Collect $" },
  ];

  return (
    <div
      className={`play-controls panel ${mobile ? "mobile" : ""}`}
      role="toolbar"
      aria-label="Café play controls"
    >
      <div className="holding-chip">
        <span className="tag">Holding</span>
        <strong>{holding}</strong>
      </div>
      {(nearLabel || jamieHelping) && (
        <p className="station-hint" aria-live="polite">
          {nearLabel ? <span>{nearLabel}</span> : null}
          {jamieHelping ? <em>Jamie (AI) covering the line</em> : null}
        </p>
      )}
      <p className="hint">
        {mobile
          ? "Tap highlighted action · drag pad to move"
          : "WASD move · Space next action · E order · F brew · R serve · Q restock"}
      </p>
      <div className="action-grid">
        {actions.map((a) => (
          <button
            key={a.id}
            type="button"
            className={suggest === a.id ? "suggested" : undefined}
            aria-label={a.label}
            aria-current={suggest === a.id ? "true" : undefined}
            onClick={() => act(a.id)}
          >
            {a.label}
          </button>
        ))}
        <button
          type="button"
          aria-label="Switch to build phase"
          onClick={() => {
            play("ui");
            conn?.send({ t: "set_phase", phase: "build" });
          }}
        >
          Build
        </button>
      </div>
      {mobile && me && (
        <MobilePad
          onMove={(dx, dz) => {
            conn?.send({ t: "player_move", x: me.x + dx, z: me.z + dz });
          }}
        />
      )}
    </div>
  );
}

function MobilePad({ onMove }: { onMove: (dx: number, dz: number) => void }) {
  return (
    <div
      className="mobile-pad"
      role="application"
      aria-label="Drag to move your character"
      onPointerDown={(e) => {
        const el = e.currentTarget;
        const move = (ev: PointerEvent) => {
          const rect = el.getBoundingClientRect();
          const x = (ev.clientX - rect.left) / rect.width - 0.5;
          const y = (ev.clientY - rect.top) / rect.height - 0.5;
          onMove(x * 0.35, y * 0.35);
        };
        const up = () => {
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", up);
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
      }}
    >
      Move
    </div>
  );
}
