import type { RoomSnapshot } from "../../shared/types";

export function FinanceLedger({ snapshot }: { snapshot: RoomSnapshot }) {
  const f = snapshot.finance;
  return (
    <aside className="side-panel panel finance-panel">
      <p className="tag">Business ledger</p>
      <h3>${Math.round(f.balance).toLocaleString()}</h3>
      <p className="sub">Simulated business funds · local ledger</p>
      {f.nessieSync ? <p className="sub" aria-live="polite">
        Nessie sandbox: {f.nessieSync.status}. {f.nessieSync.records.filter((r) => r.status === "confirmed").length} confirmed,
        {" "}{f.nessieSync.records.filter((r) => r.status === "pending" || r.status === "queued").length} pending.
        {f.nessieSync.error ? ` ${f.nessieSync.error}` : ""}
        {f.nessieSync.differenceCents !== undefined ? ` Balance difference: $${(f.nessieSync.differenceCents / 100).toFixed(2)}.` : ""}
      </p> : null}
      <ul>
        {f.transactions.slice(0, 8).map((tx) => (
          <li key={tx.id}>
            <div>
              <strong>{tx.label}</strong>
              <span>{tx.category}</span>
            </div>
            <em className={tx.amount >= 0 ? "ok" : "bad"}>
              {tx.amount >= 0 ? "+" : "−"}${Math.abs(Math.round(tx.amount)).toLocaleString()}
            </em>
          </li>
        ))}
      </ul>
    </aside>
  );
}
