/**
 * Physical tabletop object tracking (hackathon wow factor).
 * Drag marker tokens; layout syncs live into the café on release.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { FurnitureKind, RoomSnapshot } from "../../shared/types";
import { useApp } from "../lib/store";
import { play } from "../lib/audio";

const MARKERS: { kind: FurnitureKind; label: string; glyph: string }[] = [
  { kind: "coffee_machine", label: "Machine (bottle)", glyph: "M" },
  { kind: "counter", label: "Counter (notebook)", glyph: "C" },
  { kind: "table", label: "Tables (caps)", glyph: "T" },
  { kind: "pickup", label: "Pickup", glyph: "P" },
];

interface Token {
  kind: FurnitureKind;
  x: number;
  z: number;
}

export function Tabletop({ snapshot }: { snapshot: RoomSnapshot }) {
  const conn = useApp((s) => s.conn);
  const property = snapshot.property;
  const boardRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const initial = useMemo<Token[]>(() => {
    return MARKERS.map((m) => {
      const existing = snapshot.layout?.furniture.find((f) => f.kind === m.kind);
      return {
        kind: m.kind,
        x: existing?.x ?? 3,
        z: existing?.z ?? 3,
      };
    });
  }, [snapshot.layout?.furniture]);
  const [tokens, setTokens] = useState<Token[]>(initial);
  const [flash, setFlash] = useState<string | null>(null);

  // Keep tokens aligned when remote layout changes (unless dragging)
  useEffect(() => {
    if (dragging.current) return;
    setTokens(initial);
  }, [initial]);

  if (!property) return null;

  const toWorld = (clientX: number, clientY: number) => {
    const rect = boardRef.current!.getBoundingClientRect();
    const nx = (clientX - rect.left) / rect.width;
    const nz = (clientY - rect.top) / rect.height;
    return {
      x: Math.max(0.5, Math.min(property.width - 0.5, nx * property.width)),
      z: Math.max(0.5, Math.min(property.depth - 0.5, nz * property.depth)),
    };
  };

  const pushSync = (next: Token[], label: string) => {
    conn?.send({
      t: "tabletop_sync",
      markers: next.map((t) => ({ kind: t.kind, x: t.x, z: t.z })),
    });
    play("place");
    setFlash(label);
    window.setTimeout(() => setFlash(null), 1600);
  };

  return (
    <aside className="side-panel panel tabletop-panel">
      <p className="tag">Physical ↔ Digital</p>
      <h3>Tabletop build</h3>
      <p>Drag a marker — the café layout updates live when you release. Customers reroute on the next tick.</p>
      <div
        className={`tabletop-board ${flash ? "synced" : ""}`}
        ref={boardRef}
        role="application"
        aria-label="Tabletop layout board"
      >
        {tokens.map((token) => {
          const meta = MARKERS.find((m) => m.kind === token.kind)!;
          return (
            <button
              key={token.kind}
              type="button"
              className="token"
              aria-label={`Drag ${meta.label}`}
              style={{
                left: `${(token.x / property.width) * 100}%`,
                top: `${(token.z / property.depth) * 100}%`,
              }}
              onPointerDown={(e) => {
                e.preventDefault();
                dragging.current = true;
                (e.currentTarget as HTMLButtonElement).setPointerCapture?.(e.pointerId);
                let latest = tokens;
                const move = (ev: PointerEvent) => {
                  const pos = toWorld(ev.clientX, ev.clientY);
                  latest = latest.map((t) => (t.kind === token.kind ? { ...t, ...pos } : t));
                  setTokens(latest);
                };
                const up = () => {
                  dragging.current = false;
                  window.removeEventListener("pointermove", move);
                  window.removeEventListener("pointerup", up);
                  pushSync(latest, `${meta.label.split(" ")[0]} synced · customers rerouting`);
                };
                window.addEventListener("pointermove", move);
                window.addEventListener("pointerup", up);
              }}
              title={meta.label}
            >
              <span>{meta.glyph}</span>
            </button>
          );
        })}
        <div className="board-grid" aria-hidden />
        {flash ? (
          <p className="tabletop-flash" role="status">
            {flash}
          </p>
        ) : null}
      </div>
      <button
        className="btn btn-ghost"
        type="button"
        onClick={() => pushSync(tokens, "Full layout synced")}
      >
        Resync all markers
      </button>
    </aside>
  );
}
