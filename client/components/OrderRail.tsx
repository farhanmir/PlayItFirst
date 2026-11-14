import type { Customer, RoomSnapshot } from "../../shared/types";

const PERSONA: Record<Customer["persona"], { label: string; hint: string }> = {
  student: { label: "Student", hint: "Low budget · high patience" },
  office: { label: "Office", hint: "Higher budget · low patience" },
  regular: { label: "Regular", hint: "Loyal · specific prefs" },
};

export function OrderRail({
  snapshot,
  compact = false,
}: {
  snapshot: RoomSnapshot;
  compact?: boolean;
}) {
  const active = snapshot.customers.filter((c) =>
    ["queue", "ordering", "waiting"].includes(c.state),
  );

  return (
    <div className={`order-rail ${compact ? "compact" : ""}`}>
      <div className="order-rail-head">
        <span className="tag">Orders</span>
        <strong>{active.length}</strong>
      </div>
      <div className="order-rail-scroll">
        {active.length === 0 && <p className="order-empty">Waiting for the next guest…</p>}
        {active.slice(0, compact ? 4 : 8).map((c) => (
          <article key={c.id} className={`ticket persona-${c.persona} state-${c.state}`}>
            <header>
              <strong>{c.name}</strong>
              <span>{PERSONA[c.persona].label}</span>
            </header>
            <p className="order-line">{c.order ? titleCase(c.order) : titleCase(c.preference)}</p>
            {!compact ? (
              <div className="ticket-meta">
                <span>{PERSONA[c.persona].hint}</span>
                <span className="patience">Wait {Math.max(0, Math.round(c.patience))}</span>
              </div>
            ) : (
              <span className="patience">Wait {Math.max(0, Math.round(c.patience))}</span>
            )}
            <div className="ticket-bar">
              <i style={{ width: `${Math.min(100, Math.round((c.patience / 280) * 100))}%` }} />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function titleCase(s: string) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}
