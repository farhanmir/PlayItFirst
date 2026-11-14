import type { RoomSnapshot } from "../../shared/types";

const dollars = (amount: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
const checked = (timestamp: number) => new Date(timestamp).toLocaleString();

export function FinanceLedger({ snapshot }: { snapshot: RoomSnapshot }) {
  const f = snapshot.finance;
  const sync = f.nessieSync;
  const records = new Map(sync?.records.map((record) => [record.localId, record]) ?? []);
  return (
    <aside className="side-panel panel finance-panel">
      <p className="tag">Business ledger</p>
      <h3>{dollars(f.balance)}</h3>
      <p className="sub">Operating cash · authoritative game ledger</p>
      <p className="sub">Shift revenue {dollars(f.revenue)} · expenses {dollars(f.expenses)}</p>
      {sync ? <section aria-label="Nessie sandbox reconciliation">
        <p className="sub" role="status">
          Nessie sandbox: {sync.status}. {sync.records.filter((r) => r.status === "confirmed").length} confirmed,
          {" "}{sync.records.filter((r) => r.status === "pending" || r.status === "queued").length} pending,
          {" "}{sync.records.filter((r) => r.status === "failed").length} failed,
          {" "}{sync.records.filter((r) => r.status === "unknown").length} unconfirmed.
        </p>
        {sync.error && <p className="sub">{sync.error}</p>}
        {sync.remoteBalanceCents !== undefined ? <p className="sub">
          Last retrieved bank balance: {dollars(sync.remoteBalanceCents / 100)}.
          {sync.remoteAvailableCents !== undefined && <> Available: {dollars(sync.remoteAvailableCents / 100)}.</>}
          {sync.checkedAt && <> Checked {checked(sync.checkedAt)}.</>}
          {sync.differenceCents !== undefined && <> Difference from game cash: {dollars(sync.differenceCents / 100)}.</>}
        </p> : <p className="sub">Bank balance not retrieved yet. Pending purchases are not confirmed payments.</p>}
        <details>
          <summary>Rent obligations and bank receipts</summary>
          <p className="sub">Opening rent is already included in game expenses. Future bills are obligations, not another game charge.</p>
          {sync.billSetupStatus && <p className="sub">Rent bill setup: {sync.billSetupStatus}.</p>}
          {sync.billError && <p className="sub">{sync.billError}</p>}
          {sync.billsCheckedAt && <p className="sub">Bills checked {checked(sync.billsCheckedAt)}.</p>}
          {sync.bills?.length ? <ul>{sync.bills.map((bill) => <li key={bill.id}>
            <div><strong>{bill.payee}</strong><span>Due {bill.dueDate} · {bill.status}</span></div>
            <em>{dollars(bill.amountCents / 100)}</em>
          </li>)}</ul> : <p className="sub">No retrieved bills to display.</p>}
          <ul>{sync.records.map((record) => <li key={record.localId}>
            <div>
              <strong>{record.category ?? (record.amountCents > 0 ? "Sale" : "Expense")} · {record.status}</strong>
              <span style={{ overflowWrap: "anywhere" }}>Local receipt: {record.localId}</span>
              {record.remoteId && <span style={{ overflowWrap: "anywhere" }}>Bank receipt: {record.remoteId}</span>}
            </div>
            <em>{dollars(record.amountCents / 100)}</em>
          </li>)}</ul>
        </details>
      </section> : <p className="sub">Simulated only. No external bank connection.</p>}
      <ul>
        {f.transactions.slice(0, 8).map((tx) => {
          const record = records.get(tx.id);
          return <li key={tx.id}>
            <div>
              <strong>{tx.label}</strong>
              <span>{tx.category} · {record ? `Bank: ${record.status}` : "Simulated only"}</span>
            </div>
            <em className={tx.amount >= 0 ? "ok" : "bad"}>
              {tx.amount >= 0 ? "+" : "−"}{dollars(Math.abs(tx.amount))}
            </em>
          </li>;
        })}
      </ul>
    </aside>
  );
}
