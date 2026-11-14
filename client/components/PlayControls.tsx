import { useEffect, useMemo, useRef } from "react";
import type { RoomSnapshot } from "../../shared/types";
import { nearestStation } from "../../shared/stations";
import { useApp } from "../lib/store";
import { play } from "../lib/audio";
import { moveFromKeys } from "../lib/look";
import { actionPrompt, suggestedAction, stationLabel, type PlayAction } from "../lib/suggestAction";

function patchMyPosition(x: number, z: number) {
  const { snapshot, you, set } = useApp.getState();
  if (!snapshot || !you) return;
  set({
    snapshot: {
      ...snapshot,
      players: snapshot.players.map((p) => (p.id === you ? { ...p, x, z } : p)),
    },
  });
}

export function PlayControls({
  snapshot,
  immersive = false,
}: {
  snapshot: RoomSnapshot;
  immersive?: boolean;
}) {
  const conn = useApp((s) => s.conn);
  const you = useApp((s) => s.you);
  const me = snapshot.players.find((p) => p.id === you);
  const mobile = useApp((s) => s.mobile);
  const meRef = useRef(me);
  meRef.current = me;

  const station = useMemo(() => (you ? nearestStation(snapshot, you) : null), [snapshot, you]);
  const suggest = useMemo(() => suggestedAction(snapshot, you), [snapshot, you]);
  const prompt = useMemo(() => actionPrompt(snapshot, you), [snapshot, you]);
  const nearLabel = stationLabel(station);
  const jamieHelping =
    !!snapshot.aiBarista?.holding ||
    (snapshot.metrics.queueLength >= 3 &&
      snapshot.simTime - (snapshot.lastHumanInteractAt ?? 0) >= 4);

  useEffect(() => {
    if (!conn) return;
    const keys = new Set<string>();
    const onDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const k = e.key.toLowerCase();
      keys.add(k);
      // One contextual key: E or Space runs the suggested station action.
      if (k === "e" || k === " " || k === "enter") {
        e.preventDefault();
        const next = suggestedAction(useApp.getState().snapshot ?? snapshot, useApp.getState().you);
        if (next) act(next);
      }
      if (k === "f") act("make_coffee");
      if (k === "r") act("serve");
      if (k === "q") act("restock");
    };
    const onUp = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);

    const id = setInterval(() => {
      const current = meRef.current;
      if (!current) return;
      const { dx, dz } = moveFromKeys(keys, 0.22);
      if (!dx && !dz) return;
      const x = current.x + dx;
      const z = current.z + dz;
      patchMyPosition(x, z);
      conn.send({ t: "player_move", x, z });
    }, 33);

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
      : me.holding.startsWith("brewing:")
        ? `Brewing · ${me.holding.slice(8).split("@")[0]}…`
        : me.holding.startsWith("drink:")
          ? `Drink · ${me.holding.slice(6)}`
          : me.holding
    : "Hands empty";

  return (
    <div
      className={`play-controls panel ${mobile ? "mobile" : ""} ${immersive ? "immersive" : ""}`}
      role="toolbar"
      aria-label="Café play controls"
    >
      <div className="play-controls-top">
        <div className="holding-chip">
          <span className="tag">Holding</span>
          <strong>{holding}</strong>
        </div>
        {(nearLabel || jamieHelping) && (
          <p className="station-hint" aria-live="polite">
            {nearLabel ? <span>{nearLabel}</span> : null}
            {jamieHelping ? <em>Jamie covering the line</em> : null}
          </p>
        )}
      </div>

      <button
        type="button"
        className="context-act"
        aria-label={prompt}
        onClick={() => {
          if (suggest) act(suggest);
        }}
        disabled={!suggest}
      >
        {prompt}
      </button>

      {!immersive || mobile ? (
        <div className="action-grid">
          {(
            [
              ["take_order", "Order"],
              ["make_coffee", "Brew"],
              ["serve", "Serve"],
              ["restock", "Restock"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={suggest === id ? "suggested" : undefined}
              aria-current={suggest === id ? "true" : undefined}
              onClick={() => act(id)}
            >
              {label}
            </button>
          ))}
        </div>
      ) : (
        <p className="hint">WASD move · click to look · E / Space interact</p>
      )}

      {mobile && me && (
        <MobilePad
          onMove={(dx, dz) => {
            const x = me.x + dx;
            const z = me.z + dz;
            patchMyPosition(x, z);
            conn?.send({ t: "player_move", x, z });
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
          const keys = new Set<string>();
          if (y < -0.08) keys.add("w");
          if (y > 0.08) keys.add("s");
          if (x < -0.08) keys.add("a");
          if (x > 0.08) keys.add("d");
          const { dx, dz } = moveFromKeys(keys, 0.28);
          if (dx || dz) onMove(dx, dz);
          else onMove(x * 0.35, y * 0.35);
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
