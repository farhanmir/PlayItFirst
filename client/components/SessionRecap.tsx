import type { RoomSnapshot } from "../../shared/types";
import { useApp } from "../lib/store";
import { play } from "../lib/audio";
import { CustomerFeedback } from "./CustomerFeedback";

export function SessionRecap({ snapshot }: { snapshot: RoomSnapshot }) {
  const conn = useApp((s) => s.conn);
  const m = snapshot.metrics;
  const f = snapshot.finance;
  const profit = f.revenue - f.expenses;
  const grade =
    m.satisfaction >= 80 && m.customersLost < 3 ? "A" : m.satisfaction >= 65 ? "B" : m.satisfaction >= 50 ? "C" : "D";

  return (
    <aside className="side-panel panel recap-panel">
      <p className="tag">Session recap</p>
      <h3>
        Grade <span className="grade">{grade}</span>
      </h3>
      <p>
        {snapshot.property?.name ?? "Your café"} · {Math.round(snapshot.simTime)}s simulated
      </p>
      <dl className="recap-grid">
        <div>
          <dt>Served</dt>
          <dd>{m.customersServed}</dd>
        </div>
        <div>
          <dt>Lost</dt>
          <dd>{m.customersLost}</dd>
        </div>
        <div>
          <dt>Satisfaction</dt>
          <dd>{Math.round(m.satisfaction)}%</dd>
        </div>
        <div>
          <dt>Net</dt>
          <dd className={profit >= 0 ? "ok" : "bad"}>
            {profit >= 0 ? "+" : "−"}${Math.abs(Math.round(profit)).toLocaleString()}
          </dd>
        </div>
      </dl>
      <CustomerFeedback feedback={snapshot.feedback} />
      {snapshot.reviews && snapshot.reviews.length > 0 && (
        <section className="recap-reviews" aria-label="Customer reviews">
          <p className="tag">What customers said · Grok</p>
          <ul>
            {snapshot.reviews.slice(0, 5).map((r) => (
              <li key={`${r.at}-${r.name}`} className={r.outcome === "served" ? "ok" : "bad"}>
                <strong>{r.name}</strong> “{r.text}”{r.tip ? ` · tipped $${r.tip.toFixed(2)}` : ""}
              </li>
            ))}
          </ul>
        </section>
      )}
      <button
        className="btn"
        type="button"
        onClick={() => {
          play("ui");
          conn?.send({ t: "request_blueprint" });
        }}
      >
        Turn this into a blueprint
      </button>
    </aside>
  );
}
