import { useState } from "react";
import type { RoomSnapshot } from "../../shared/types";
import { useApp } from "../lib/store";

/** Shared manager UI; Photon adapters call the same server service when provisioned. */
export function PhotonChat({ snapshot }: { snapshot: RoomSnapshot }) {
  const conn = useApp((s) => s.conn);
  const you = useApp((s) => s.you);
  const error = useApp((s) => s.managerError);
  const set = useApp((s) => s.set);
  const [text, setText] = useState("");
  const manager = snapshot.manager;
  const owner = snapshot.players.some((p) => p.id === you && p.role === "owner");
  return (
    <aside className="side-panel panel manager-panel" aria-label="Café manager">
      <p className="tag">Café manager</p>
      <h3>Jamie, your second pair of hands</h3>
      <p className="manager-runtime">{manager?.runtime === "deepagents"
        ? manager.providerVerified ? "Deepagents · provider run verified in this room" : "Deepagents · awaiting a verified run"
        : "Local rules · no model call"}. External Photon messaging and phone calls are not connected.</p>
      <form className="photon-compose" onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim()) return;
        set({ managerError: null });
        conn?.send({ t: "manager_request", prompt: text.trim() });
        setText("");
      }}>
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={1200}
          placeholder="Check milk, cash and the queue" aria-label="Ask the café manager" disabled={!owner || manager?.busy} />
        <button className="btn btn-small" type="submit" disabled={!owner || manager?.busy || !text.trim()}>{manager?.busy ? "Thinking…" : "Ask"}</button>
      </form>
      {!owner ? <p>Only the café owner can request plans and approve changes.</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      <p role="status">{manager?.summary ?? "Ask for a plan. Jamie will check the live café and ask before changing anything."}</p>
      <div className="manager-proposals">
        {manager?.proposals.slice(-4).reverse().map((proposal) => (
          <section key={proposal.id} className="manager-proposal">
            <strong>{proposal.action === "reorder_supplies" ? "Supply delivery · $35" : "Simplify the menu · free"}</strong>
            <p>{proposal.reason}</p>
            {proposal.status === "pending" ? (
              <div className="manager-actions">
                <button type="button" className="btn btn-small" disabled={!owner || manager.busy || proposal.expiresAt <= Date.now()}
                  onClick={() => { set({ managerError: null }); conn?.send({ t: "manager_approve", proposalId: proposal.id }); }}>
                  {proposal.expiresAt <= Date.now() ? "Expired" : proposal.cost ? "Approve $35 delivery" : "Approve menu change"}
                </button>
                <button type="button" className="btn-ghost btn-small" disabled={!owner || manager.busy}
                  onClick={() => { set({ managerError: null }); conn?.send({ t: "manager_decline", proposalId: proposal.id }); }}>Decline</button>
              </div>
            ) : <p>{proposal.result ?? proposal.status}</p>}
            {proposal.transactionId ? <small>Ledger receipt {proposal.transactionId.slice(0, 8)}</small> : null}
          </section>
        ))}
      </div>
      {manager?.trace.length ? <details><summary>What Jamie checked and did</summary>
        <ol>{manager.trace.slice(-8).map((step, index) => <li key={`${step.at}-${index}`}><strong>{step.tool}</strong> · {step.detail}</li>)}</ol>
      </details> : null}
    </aside>
  );
}
