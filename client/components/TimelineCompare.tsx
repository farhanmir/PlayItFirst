/**
 * Business time machine — illustrative what-if from session heuristics.
 * Applying tweaks places real furniture; resulting metrics come from the sim afterward.
 */
import type { RoomSnapshot } from "../../shared/types";
import { useApp } from "../lib/store";

export function TimelineCompare({ snapshot }: { snapshot: RoomSnapshot }) {
  const conn = useApp((s) => s.conn);
  const m = snapshot.metrics;
  const machines = snapshot.layout?.furniture.filter((f) => f.kind === "coffee_machine").length ?? 1;
  const hasPickupGap = (() => {
    const c = snapshot.layout?.furniture.find((f) => f.kind === "counter");
    const p = snapshot.layout?.furniture.find((f) => f.kind === "pickup");
    if (!c || !p) return false;
    return Math.hypot(c.x - p.x, c.z - p.z) < 2;
  })();

  // Heuristic illustration only — not a measured replay
  const illustrative = {
    servedDelta: hasPickupGap ? "+~15–35%" : machines < 2 ? "+~10–20%" : "+~5–10%",
    waitDelta: machines < 2 ? "lower wait if 2nd machine lands" : "small wait change",
    note: "Illustrative ranges from layout heuristics — not a seeded A/B replay.",
  };

  return (
    <aside className="side-panel panel timeline-panel">
      <p className="tag">Business time machine · illustrative</p>
      <h3>Explore an alternate layout</h3>
      <p>
        {hasPickupGap
          ? "Your ordering and pickup queues overlap near the entrance — a classic bottleneck."
          : machines < 2
            ? "A second espresso machine would lift throughput during rushes."
            : "Staffing and menu simplification are the next levers to test."}
      </p>
      <div className="timeline-grid">
        <div>
          <h4>This session (measured)</h4>
          <Stat label="Customers served" value={String(m.customersServed)} />
          <Stat label="Average wait" value={`${m.avgWaitSec}s`} />
          <Stat label="Est. revenue / hr" value={`$${m.revenuePerHour}`} />
          <Stat label="Satisfaction" value={`${Math.round(m.satisfaction)}%`} />
        </div>
        <div className="alt">
          <h4>If you apply tweaks (guess)</h4>
          <Stat label="Served change" value={illustrative.servedDelta} />
          <Stat label="Wait" value={illustrative.waitDelta} />
          <Stat label="Method" value="Heuristic" />
          <Stat label="Not measured" value="—" />
        </div>
      </div>
      <p className="fine">{illustrative.note} Rival café panel is also a client heuristic.</p>
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
                x: Math.min(snapshot.property!.width - 1, pickup.x + 2.5),
                z: pickup.z,
              });
            }
          }
        }}
      >
        Apply real layout tweaks (then watch sim metrics)
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
