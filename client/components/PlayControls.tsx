import { useEffect, useMemo, useRef } from "react";
import type { RoomSnapshot } from "../../shared/types";
import { BREW_SECONDS, nearestStation } from "../../shared/stations";
import { floorMoveClear } from "../../shared/floorplan";
import { useApp } from "../lib/store";
import { play } from "../lib/audio";
import { moveFromKeys } from "../lib/look";
import { actionPrompt, suggestedAction, stationLabel, type PlayAction } from "../lib/suggestAction";
import { interactionSounds } from "../lib/interactionFeedback";

function patchMyPosition(x: number, z: number) {
  const { snapshot, you, set } = useApp.getState();
  if (!snapshot || !you) return false;
  const current = snapshot.players.find((p) => p.id === you);
  const plan = snapshot.property?.floorPlan;
  if (plan && current && !floorMoveClear(plan, current, { x, z })) return false;
  set({
    snapshot: {
      ...snapshot,
      players: snapshot.players.map((p) => (p.id === you ? { ...p, x, z } : p)),
    },
  });
  return true;
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
  const feedback = useRef({ snapshot, you });

  useEffect(() => {
    const previous = feedback.current;
    feedback.current = { snapshot, you };
    // Mount/reconnect establishes a baseline instead of replaying old actions.
    if (previous.you !== you) return;
    for (const sound of interactionSounds(previous.snapshot, snapshot, you)) play(sound);
  }, [snapshot, you]);

  const station = useMemo(() => (you ? nearestStation(snapshot, you) : null), [snapshot, you]);
  const suggest = useMemo(() => suggestedAction(snapshot, you), [snapshot, you]);
  const prompt = useMemo(() => actionPrompt(snapshot, you), [snapshot, you]);
  const nearLabel = stationLabel(station);
  const jamieHelping = !!snapshot.aiBarista?.holding;

  useEffect(() => {
    if (!conn) return;
    const keys = new Set<string>();
    const onDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const k = e.key.toLowerCase();
      if (e.repeat && ["e", " ", "enter", "f", "r", "q"].includes(k)) return;
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
    const clearKeys = () => keys.clear();
    window.addEventListener("blur", clearKeys);
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);

    const id = setInterval(() => {
      const current = meRef.current;
      if (!current) return;
      const { dx, dz } = moveFromKeys(keys, 0.22);
      if (!dx && !dz) return;
      const x = current.x + dx;
      const z = current.z + dz;
      if (patchMyPosition(x, z)) conn.send({ t: "player_move", x, z });
    }, 33);

    return () => {
      clearInterval(id);
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", clearKeys);
    };
  }, [conn]);

  const act = (action: PlayAction) => {
    conn?.send({ t: "interact", action });
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

      {me?.holding?.startsWith("brewing:") ? (
        <progress className="brew-progress" aria-label="Coffee brewing" max={BREW_SECONDS}
          value={Math.max(0, snapshot.simTime - Number(me.holding.split("@")[1]))} />
      ) : null}

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
            const state = useApp.getState();
            const current = state.snapshot?.players.find((p) => p.id === state.you);
            if (!current) return;
            const x = current.x + dx;
            const z = current.z + dz;
            if (patchMyPosition(x, z)) conn?.send({ t: "player_move", x, z });
          }}
        />
      )}
    </div>
  );
}

function MobilePad({ onMove }: { onMove: (dx: number, dz: number) => void }) {
  const direction = useRef({ x: 0, y: 0 });
  const moveRef = useRef(onMove);
  moveRef.current = onMove;
  useEffect(() => {
    const stop = () => { direction.current = { x: 0, y: 0 }; };
    const timer = window.setInterval(() => {
      const { x, y } = direction.current;
      if (!x && !y) return;
      const keys = new Set<string>();
      if (y < -0.12) keys.add("w");
      if (y > 0.12) keys.add("s");
      if (x < -0.12) keys.add("a");
      if (x > 0.12) keys.add("d");
      const step = moveFromKeys(keys, 0.18);
      moveRef.current(step.dx, step.dz);
    }, 33);
    window.addEventListener("blur", stop);
    return () => { clearInterval(timer); window.removeEventListener("blur", stop); };
  }, []);
  const update = (el: HTMLDivElement, clientX: number, clientY: number) => {
    const rect = el.getBoundingClientRect();
    direction.current = { x: (clientX - rect.left) / rect.width - 0.5, y: (clientY - rect.top) / rect.height - 0.5 };
  };
  return (
    <div
      className="mobile-pad"
      role="application"
      aria-label="Drag to move your character"
      style={{ touchAction: "none" }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        update(e.currentTarget, e.clientX, e.clientY);
      }}
      onPointerMove={(e) => { if (e.currentTarget.hasPointerCapture(e.pointerId)) update(e.currentTarget, e.clientX, e.clientY); }}
      onLostPointerCapture={() => { direction.current = { x: 0, y: 0 }; }}
      onPointerUp={(e) => { direction.current = { x: 0, y: 0 }; e.currentTarget.releasePointerCapture(e.pointerId); }}
      onPointerCancel={() => { direction.current = { x: 0, y: 0 }; }}
    >
      Move
    </div>
  );
}
