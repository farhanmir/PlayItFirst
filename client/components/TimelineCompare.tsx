/**
 * Business time machine — side-by-side illustrative timelines from session metrics.
 * Deepagents-shaped: proposes an alternate layout strategy from observed bottlenecks.
 */
import type { RoomSnapshot } from "../../shared/types";
import { useApp } from "../lib/store";

export function TimelineCompare({ snapshot }: { snapshot: RoomSnapshot }) {
  const conn = useApp((s) => s.conn);
  const m = snapshot.metrics;
  const machines = snapshot.layout?.furniture.filter((f) => f.kind === "coffee_machine").length ?? 1;
  const hasPickupGap =
    (() => {
      const c = snapshot.layout?.furniture.find((f) => f.kind === "counter");
      const p = snapshot.layout?.furniture.find((f) => f.kind === "pickup");
      if (!c || !p) return false;
      return Math.hypot(c.x - p.x, c.z - p.z) < 2;
    })();

  const redesigned = {
    served: Math.round(m.customersServed * (hasPickupGap ? 1.35 : 1.15) + 2),
    wait: Math.max(1.2, +(m.avgWaitSec * (machines < 2 ? 0.62 : 0.78)).toFixed(1)),
    revenue: Math.round(m.revenuePerHour * (hasPickupGap ? 1.4 : 1.2) + 40),
    sat: Math.min(98, Math.round(m.satisfaction * 1.25 + 8)),
  };

  return (
    <aside className="side-panel panel timeline-panel">
      <p className="tag">Business time machine</p>
      <h3>Explore an alternate future</h3>
      <p>
        {hasPickupGap
          ? "Your ordering and pickup queues overlap near the entrance — a classic bottleneck."
          : machines < 2
            ? "A second espresso machine would lift throughput during rushes."
            : "Staffing and menu simplification are the next levers to test."}
      </p>
      <div className="timeline-grid">
        <div>
          <h4>Original</h4>
          <Stat label="Customers served" value={`${m.customersServed}/hr*`} />
          <Stat label="Average wait" value={`${m.avgWaitSec} min`} />
          <Stat label="Simulated revenue" value={`$${m.revenuePerHour}/hr`} />
          <Stat label="Satisfaction" value={`${Math.round(m.satisfaction)}%`} />
        </div>
        <div className="alt">
          <h4>Redesigned</h4>
          <Stat label="Customers served" value={`${redesigned.served}/hr*`} />
          <Stat label="Average wait" value={`${redesigned.wait} min`} />
          <Stat label="Simulated revenue" value={`$${redesigned.revenue}/hr`} />
          <Stat label="Satisfaction" value={`${redesigned.sat}%`} />
        </div>
      </div>
      <p className="fine">Illustrative metrics from your session — not actual forecasts.</p>
      <button
        className="btn"
        type="button"
        onClick={() => {
          if (!snapshot.property) return;
          conn?.send({
            t: "place_furniture",
            kind: "coffee_machine",
            x: Math.min(snapshot.property.width - 1.5, 3.5),
            z: Math.min(snapshot.property.depth - 1.5, 6),
          });
          if (hasPickupGap) {
            const pickup = snapshot.layout?.furniture.find((f) => f.kind === "pickup");
            if (pickup) {
              conn?.send({
                t: "move_furniture",
                id: pickup.id,
                x: Math.min(snapshot.property.width - 1, pickup.x + 2.5),
                z: pickup.z,
              });
            }
          }
        }}
      >
        Apply suggested layout tweaks
      </button>
    </aside>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="tl-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
