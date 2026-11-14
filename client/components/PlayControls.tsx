import { useEffect, useMemo, useRef } from "react";
import type { RoomSnapshot } from "../../shared/types";
import { BREW_SECONDS, nearestStation } from "../../shared/stations";
import { furnitureMoveClear } from "../../shared/movement";
import { floorMoveClear, pointInPolygon } from "../../shared/floorplan";
import { useApp } from "../lib/store";
import { play } from "../lib/audio";
import { moveFromKeys, moveFromAxes, stickAxes, walkingDistance } from "../lib/look";
import { actionPrompt, suggestedAction, stationLabel, type PlayAction } from "../lib/suggestAction";
import { interactionSounds } from "../lib/interactionFeedback";

function patchMyPosition(x: number, z: number) {
  const { snapshot, you, set } = useApp.getState();
  if (!snapshot || !you) return null;
  if (!snapshot.property) return null;
  x = Math.max(0.3, Math.min(snapshot.property.width - 0.3, x));
  z = Math.max(0.3, Math.min(snapshot.property.depth - 0.3, z));
  const current = snapshot.players.find((p) => p.id === you);
  if (!current) return null;
  const plan = snapshot.property.floorPlan;
  const clear = (point: { x: number; z: number }) =>
    furnitureMoveClear(snapshot.layout?.furniture ?? [], current, point) &&
    (!plan || floorMoveClear(plan, current, point));
  // Slide along a wall rather than stopping both axes when one is blocked.
  const candidates = [{ x, z }, { x, z: current.z }, { x: current.x, z }];
  const next = candidates.find((point) =>
    (point.x !== current.x || point.z !== current.z) && clear(point));
  if (!next) return null;
  ({ x, z } = next);
  set({
    snapshot: {
      ...snapshot,
      players: snapshot.players.map((p) => (p.id === you ? { ...p, x, z } : p)),
    },
  });
  return { x, z };
}

export function PlayControls({
  snapshot,
  immersive = false,
  enabled = true,
}: {
  snapshot: RoomSnapshot;
  immersive?: boolean;
  enabled?: boolean;
}) {
  const conn = useApp((s) => s.conn);
  const you = useApp((s) => s.you);
  const me = snapshot.players.find((p) => p.id === you);
  const mobile = useApp((s) => s.mobile);
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
  const destination = useMemo(() => {
    if (!me || suggest || me.holding?.startsWith("brewing:")) return null;
    const waiting = snapshot.customers.some(c => c.state === "waiting" && c.order && (c.ticketHolder === me.id || c.ticketHolder == null));
    const kind = me.holding?.startsWith("drink:") ? "pickup" : me.holding?.startsWith("ticket:") || waiting ? "coffee_machine" : "counter";
    const target = snapshot.layout?.furniture.filter(f => f.kind === kind)
      .sort((a, b) => Math.hypot(a.x - me.x, a.z - me.z) - Math.hypot(b.x - me.x, b.z - me.z))[0];
    if (!target) return null;
    const room = snapshot.property?.floorPlan?.rooms.find(r => pointInPolygon(target.x, target.z, r.polygon));
    return `${room?.label ? `${room.label} · ` : ""}${target.label} · ${Math.ceil(Math.hypot(target.x - me.x, target.z - me.z))} m away`;
  }, [snapshot.property, snapshot.layout, snapshot.customers, me, suggest]);

  useEffect(() => {
    if (!conn || !enabled) return;
    const keys = new Set<string>();
    const onDown = (e: KeyboardEvent) => {
      if (document.querySelector("dialog[open]")) { keys.clear(); return; }
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea, select, [contenteditable=true], [role=dialog]")) return;
      const k = e.key.toLowerCase();
      if (e.repeat && ["e", " ", "enter", "f", "r", "q"].includes(k)) return;
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) e.preventDefault();
      keys.add(k);
      // One contextual key: E or Space runs the suggested station action.
      if (k === "e" || ((k === " " || k === "enter") && !(e.target instanceof HTMLElement && e.target.closest("button, a")))) {
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
    document.addEventListener("visibilitychange", clearKeys);
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);

    let previousTick = performance.now();
    const id = setInterval(() => {
      const now = performance.now();
      const distance = walkingDistance(now - previousTick);
      previousTick = now;
      if (document.hidden || document.querySelector("dialog[open]") || document.activeElement?.matches("input, textarea, select, [contenteditable=true]")) { keys.clear(); return; }
      const state = useApp.getState();
      const current = state.snapshot?.players.find((p) => p.id === state.you);
      if (!current) return;
      const { dx, dz } = moveFromKeys(keys, distance);
      if (!dx && !dz) return;
      const x = current.x + dx;
      const z = current.z + dz;
      const next = patchMyPosition(x, z);
      if (next) conn.send({ t: "player_move", ...next });
    }, 33);

    return () => {
      clearInterval(id);
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", clearKeys);
      document.removeEventListener("visibilitychange", clearKeys);
    };
  }, [conn, enabled]);

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
        {(destination || nearLabel || jamieHelping) && (
          <p className="station-hint" aria-live="polite">
            {destination || nearLabel ? <span>{destination || nearLabel}</span> : null}
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
        disabled={!suggest || !enabled}
      >
        {!mobile && suggest ? <kbd className="action-key">E</kbd> : null}
        <span>{prompt.replace(/^E · /, "")}</span>
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
              disabled={!enabled}
              onClick={() => act(id)}
            >
              {label}
            </button>
          ))}
        </div>
      ) : (
        <p className="hint">WASD move · click to look · E / Space interact</p>
      )}

      {mobile && me && enabled && (
        <MobilePad
          onMove={(dx, dz) => {
            const state = useApp.getState();
            const current = state.snapshot?.players.find((p) => p.id === state.you);
            if (!current) return;
            const x = current.x + dx;
            const z = current.z + dz;
            const next = patchMyPosition(x, z);
            if (next) conn?.send({ t: "player_move", ...next });
          }}
        />
      )}
    </div>
  );
}

function MobilePad({ onMove }: { onMove: (dx: number, dz: number) => void }) {
  const direction = useRef({ x: 0, y: 0 });
  const padRef = useRef<HTMLDivElement>(null);
  const activePointer = useRef<number | null>(null);
  const resetPad = () => {
    activePointer.current = null;
    direction.current = { x: 0, y: 0 };
    padRef.current?.style.setProperty("--stick-x", "0px");
    padRef.current?.style.setProperty("--stick-y", "0px");
  };
  const moveRef = useRef(onMove);
  moveRef.current = onMove;
  useEffect(() => {
    const stop = resetPad;
    let previousTick = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const distance = walkingDistance(now - previousTick);
      previousTick = now;
      if (document.hidden || document.querySelector("dialog[open]")) { stop(); return; }
      const { x, y } = direction.current;
      const { strafe, forward } = stickAxes(x, y);
      const step = moveFromAxes(strafe, forward, distance);
      if (step.dx || step.dz) moveRef.current(step.dx, step.dz);
    }, 33);
    window.addEventListener("blur", stop);
    document.addEventListener("visibilitychange", stop);
    return () => {
      clearInterval(timer);
      window.removeEventListener("blur", stop);
      document.removeEventListener("visibilitychange", stop);
    };
  }, []);
  const update = (el: HTMLDivElement, clientX: number, clientY: number) => {
    const rect = el.getBoundingClientRect();
    direction.current = { x: ((clientX - rect.left) / rect.width - 0.5) * 2, y: ((clientY - rect.top) / rect.height - 0.5) * 2 };
    const len = Math.max(1, Math.hypot(direction.current.x, direction.current.y));
    el.style.setProperty("--stick-x", `${direction.current.x / len * 22}px`);
    el.style.setProperty("--stick-y", `${direction.current.y / len * 22}px`);
  };
  return (
    <div
      ref={padRef}
      className="mobile-pad"
      role="application"
      aria-label="Drag to move your character"
      style={{ touchAction: "none" }}
      onPointerDown={(e) => {
        if (activePointer.current !== null) return;
        e.preventDefault();
        activePointer.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        update(e.currentTarget, e.clientX, e.clientY);
      }}
      onPointerMove={(e) => { if (activePointer.current === e.pointerId && e.currentTarget.hasPointerCapture(e.pointerId)) update(e.currentTarget, e.clientX, e.clientY); }}
      onLostPointerCapture={(e) => { if (activePointer.current === e.pointerId) resetPad(); }}
      onPointerUp={(e) => {
        if (activePointer.current !== e.pointerId) return;
        resetPad();
        if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
      }}
      onPointerCancel={(e) => { if (activePointer.current === e.pointerId) resetPad(); }}
    >
      <span className="stick-puck" aria-hidden="true" />
      <span className="stick-label">Move</span>
    </div>
  );
}
