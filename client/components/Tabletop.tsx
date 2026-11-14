/**
 * Physical tabletop object tracking (hackathon wow factor).
 * Browser canvas "vision" board: drag marker tokens; sync transforms into the live café.
 * Pattern intent mirrors Gitzilla's dual-device / tabletop interaction, specialized for layout editing.
 */
import { useMemo, useRef, useState } from "react";
import type { FurnitureKind, RoomSnapshot } from "../../shared/types";
import { useApp } from "../lib/store";

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

  return (
    <aside className="side-panel panel tabletop-panel">
      <p className="tag">Physical ↔ Digital</p>
      <h3>Tabletop build</h3>
      <p>Drag objects on the board. Computer-vision style markers push live layout changes into the café.</p>
      <div className="tabletop-board" ref={boardRef}>
        {tokens.map((token) => {
          const meta = MARKERS.find((m) => m.kind === token.kind)!;
          return (
            <button
              key={token.kind}
              type="button"
              className="token"
              style={{
                left: `${(token.x / property.width) * 100}%`,
                top: `${(token.z / property.depth) * 100}%`,
              }}
              onPointerDown={(e) => {
                e.preventDefault();
                const move = (ev: PointerEvent) => {
                  const pos = toWorld(ev.clientX, ev.clientY);
                  setTokens((prev) => prev.map((t) => (t.kind === token.kind ? { ...t, ...pos } : t)));
                };
                const up = () => {
                  window.removeEventListener("pointermove", move);
                  window.removeEventListener("pointerup", up);
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
        <div className="board-grid" />
      </div>
      <button
        className="btn"
        type="button"
        onClick={() => {
          conn?.send({
            t: "tabletop_sync",
            markers: tokens.map((t) => ({ kind: t.kind, x: t.x, z: t.z })),
          });
        }}
      >
        Sync layout to café
      </button>
    </aside>
  );
}
