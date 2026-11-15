import type { RoomSnapshot } from "../../shared/types";
import { useApp } from "../lib/store";

/** Top-down floorplan radar — Matterport-adjacent spatial awareness. */
export function MiniMap({ snapshot }: { snapshot: RoomSnapshot }) {
  const you = useApp((s) => s.you);
  const p = snapshot.property;
  const layout = snapshot.layout;
  if (!p || !layout) return null;
  const w = p.width;
  const d = p.depth;

  return (
    <div className="minimap panel" aria-label="Café floorplan minimap">
      <p className="tag">Floorplate</p>
      <svg viewBox={`0 0 ${w} ${d}`} role="img">
        <rect x="0" y="0" width={w} height={d} fill="rgba(243,235,226,0.06)" stroke="rgba(243,235,226,0.25)" strokeWidth="0.08" />
        {layout.furniture.map((f) => (
          <rect
            key={f.id}
            x={f.x - 0.35}
            y={f.z - 0.35}
            width={0.7}
            height={0.7}
            rx={0.08}
            fill={
              f.kind === "coffee_machine"
                ? "#d9773f"
                : f.kind === "counter" || f.kind === "pickup"
                  ? "#c4a574"
                  : f.kind === "decoration"
                    ? "#5d9a74"
                    : "#8b5a3c"
            }
            opacity={0.9}
          />
        ))}
        {snapshot.customers.map((c) => (
          <circle key={c.id} cx={c.x} cy={c.z} r={0.18} fill="#f3ebe2" opacity={0.75} />
        ))}
        {snapshot.players.filter((pl) => pl.connected !== false).map((pl) => (
          <circle
            key={pl.id}
            cx={pl.x}
            cy={pl.z}
            r={pl.id === you ? 0.28 : 0.22}
            fill={pl.color}
            stroke={pl.id === you ? "#f3ebe2" : "none"}
            strokeWidth={0.06}
          />
        ))}
      </svg>
    </div>
  );
}
