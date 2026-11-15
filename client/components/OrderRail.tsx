import { useState } from "react";
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
  const [expanded, setExpanded] = useState(false);
  const active = snapshot.customers.filter((c) =>
    ["queue", "ordering", "waiting"].includes(c.state),
  );

  return (
    <div className={`order-rail ${compact ? "compact" : ""} ${expanded ? "expanded" : ""}`}>
      <div className="order-rail-head">
        <span className="order-heading">{compact ? "Next order" : "Orders"}</span>
        {compact ? <button type="button" className="order-expand" aria-expanded={expanded}
          aria-label={expanded ? "Collapse order queue" : `Show ${active.length} orders`}
          onClick={() => setExpanded(!expanded)}>{expanded ? "Close" : `${active.length} in line`}</button> : <strong>{active.length}</strong>}
      </div>
      <div className="order-rail-scroll">
        {active.length === 0 && <p className="order-empty">Waiting for the next guest…</p>}
        {active.slice(0, compact && !expanded ? 1 : 8).map((c) => (
          <article key={c.id} className={`ticket persona-${c.persona} state-${c.state}`}>
            <header>
              <strong>{c.name}</strong>
              {!compact ? <span>{PERSONA[c.persona].label}</span> : <span>{orderStatus(c, snapshot)}</span>}
            </header>
            <p className="order-line">{c.order ? titleCase(c.order) : titleCase(c.preference)}</p>
            {!compact ? (
              <div className="ticket-meta">
                <span>{PERSONA[c.persona].hint}</span>
                <span className="patience">{patienceLabel(c.patience)}</span>
              </div>
            ) : null}
            <div className="ticket-bar" title={patienceLabel(c.patience)}>
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

function patienceLabel(patience: number) {
  if (patience > 180) return "Calm";
  if (patience > 90) return "Waiting";
  if (patience > 35) return "Impatient";
  return "Leaving soon";
}

/** Use the assigned barista's actual held item, not the customer's waiting state alone. */
function orderStatus(customer: Customer, snapshot: RoomSnapshot) {
  if (customer.state === "queue") return "In line";
  if (customer.state === "ordering") return "Take order";
  const holding = snapshot.players.find((player) => player.id === customer.ticketHolder)?.holding;
  if (customer.order && holding === `drink:${customer.order}`) return "Ready to serve";
  if (customer.order && holding?.startsWith(`brewing:${customer.order}@`)) return "Brewing";
  return "To make";
}
