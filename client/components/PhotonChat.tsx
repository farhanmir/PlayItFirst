import { useState } from "react";
import type { RoomSnapshot } from "../../shared/types";
import { useApp } from "../lib/store";
import { getResumeToken } from "../lib/storage";

/** Shared manager UI; Photon adapters call the same server service when provisioned. */
export function PhotonChat({ snapshot }: { snapshot: RoomSnapshot }) {
  const conn = useApp((s) => s.conn);
  const you = useApp((s) => s.you);
  const error = useApp((s) => s.managerError);
  const set = useApp((s) => s.set);
  const [text, setText] = useState("");
  const [phone, setPhone] = useState<{code:string; expiresAt:number; paired:boolean; messaging:string; voice:string; agentHandle:string|null; voiceNumber:string|null}|null>(null);
  const [phoneError, setPhoneError] = useState("");
  const [phoneActivation, setPhoneActivation] = useState("");
  const [phoneBusy, setPhoneBusy] = useState(false);
  const [voiceApproval, setVoiceApproval] = useState<{approvalCode:string; proposalId:string; cost:number}|null>(null);
  async function phoneAction(action: string, proposalId?: string) {
    const token = getResumeToken(snapshot.code);
    if (!token || phoneBusy) return;
    setPhoneBusy(true); setPhoneError("");
    try {
      const r = await fetch("/api/phone/session", { method:"POST", headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},
        body:JSON.stringify({room:snapshot.code,action,proposalId,...(action === "start" ? {activationCode:phoneActivation} : {})}), signal:AbortSignal.timeout(12000) });
      const value = await r.json();
      if (!r.ok) throw new Error(value.error || "Phone request failed");
      if (action === "end") { setPhone(null); setVoiceApproval(null); }
      else if (action === "voice_approval") setVoiceApproval(value);
      else { setPhone(value); if (action === "start") setPhoneActivation(""); }
    } catch (error) { setPhoneError(error instanceof Error ? error.message : "Phone request failed"); }
    finally { setPhoneBusy(false); }
  }
  const phoneTransport = useApp(s => s.photonPairing?.status.transport);
  const manager = snapshot.manager;
  const owner = snapshot.players.some((p) => p.id === you && p.role === "owner");
  return (
    <aside className="side-panel panel manager-panel" aria-label="Café manager">
      <p className="tag">Café manager</p>
      <h3>Jamie, your second pair of hands</h3>
      <p className="manager-runtime">{manager?.runtime === "deepagents"
        ? manager.providerVerified ? "Deepagents · provider run verified in this room" : "Deepagents · awaiting a verified run"
        : "Local rules · no model call"}. External phone sessions require separate provider setup and actual delivery verification.</p>
      {owner ? <details>
        <summary>{phoneTransport === "webhook" ? "Connect a telephone call (Photon Voice)" : "Connect your phone (Photon demo)"}</summary>
        <p>{phoneTransport === "webhook" ? "iMessage uses the separate signed-webhook pairing below. This session is for a provisioned telephone number and voice agent." : "Start a private 10-minute session. Only the configured iMessage sender can pair. Voice requires a provisioned number and connected voice agent."}</p>
        <label>Team phone activation code <input type="password" autoComplete="off" maxLength={256} value={phoneActivation} onChange={e=>setPhoneActivation(e.target.value)} /></label>
        <div className="manager-actions">
          <button type="button" className="btn btn-small" disabled={phoneBusy || !phoneActivation.trim()} onClick={() => void phoneAction("start")}>Start phone session</button>
          {phone ? <><button type="button" className="btn-ghost btn-small" disabled={phoneBusy} onClick={() => void phoneAction("status")}>Refresh status</button>
          <button type="button" className="btn-ghost btn-small" disabled={phoneBusy} onClick={() => void phoneAction("end")}>Disconnect</button></> : null}
        </div>
        {phoneError ? <p role="alert">{phoneError}</p> : null}
        {phone ? <div>
          <p>Expires {new Date(phone.expiresAt).toLocaleTimeString()}. Keep the owner connected.</p>
          {phone.agentHandle ? <p>Send iMessage to {phone.agentHandle}: <strong>PAIR {phone.code}</strong>. Then ask Jamie a question. Status: {phone.messaging}. A provider acceptance is not delivery.</p> : null}
          {phone.voiceNumber ? <p>Call {phone.voiceNumber} and read your session code <strong>{phone.code}</strong>. Voice tool status: {phone.voice}. Phone delivery is not verified by tool status.</p> : null}
        </div> : null}
        {voiceApproval ? <p role="status">Read approval code <strong>{voiceApproval.approvalCode}</strong> to the voice agent for the exact ${voiceApproval.cost.toFixed(2)} proposal. Expires within 90 seconds; one use.</p> : null}
      </details> : null}
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
            <strong>{proposal.action === "reorder_supplies" ? "Supply delivery · $35" : proposal.action === "move_pickup" ? "Move pickup · free" : "Simplify the menu · free"}</strong>
            <p>{proposal.reason}</p>
            {proposal.pickupMove ? <p>Move pickup from ({proposal.pickupMove.from.x}, {proposal.pickupMove.from.z}) to ({proposal.pickupMove.to.x}, {proposal.pickupMove.to.z}). Modeled walk: {proposal.pickupMove.beforeDistance.toFixed(1)} → {proposal.pickupMove.afterDistance.toFixed(1)} {proposal.pickupMove.unit}. Service-time gain is unverified.</p> : null}
            {proposal.status === "pending" ? (
              <div className="manager-actions">
                <button type="button" className="btn btn-small" disabled={!owner || manager.busy || proposal.expiresAt <= Date.now()}
                  onClick={() => { set({ managerError: null }); conn?.send({ t: "manager_approve", proposalId: proposal.id }); }}>
                  {proposal.expiresAt <= Date.now() ? "Expired" : proposal.cost ? "Approve $35 delivery" : proposal.action === "move_pickup" ? "Approve pickup move" : "Approve menu change"}
                </button>
                {phone?.voiceNumber ? <button type="button" className="btn-ghost btn-small" disabled={phoneBusy || !owner || manager.busy || proposal.expiresAt <= Date.now()} onClick={() => void phoneAction("voice_approval", proposal.id)}>Authorize voice approval code (${proposal.cost.toFixed(2)})</button> : null}
                <button type="button" className="btn-ghost btn-small" disabled={!owner || manager.busy}
                  onClick={() => { set({ managerError: null }); conn?.send({ t: "manager_decline", proposalId: proposal.id }); }}>Decline</button>
              </div>
            ) : <p>{proposal.result ?? proposal.status}</p>}
            {proposal.actionReceiptId ? <small>Layout receipt {proposal.actionReceiptId}</small> : null}
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
