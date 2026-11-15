import { useEffect, useState } from "react";
import { useApp } from "../lib/store";

/** Phone linking lives in the management drawer, never on the service HUD. */
export function PhotonPairing() {
  const [activation, setActivation] = useState("");
  const conn = useApp(s => s.conn);
  const snapshot = useApp(s => s.snapshot);
  const you = useApp(s => s.you);
  const state = useApp(s => s.photonPairing);
  const error = useApp(s => s.photonPairError);
  const connection = useApp(s => s.status);
  const owner = snapshot?.players.some(p => p.id === you && p.role === "owner");
  useEffect(() => { if (owner && connection === "open") conn?.send({ t: "photon_pair_status" }); }, [conn, owner, connection]);
  if (!owner || (state && state.status.transport !== "webhook")) return null;
  const pairing = state?.pairing;
  const configured = state?.status.configured === true;
  const online = connection === "open";
  return <aside className="side-panel panel" aria-label="Phone messaging">
    <h3>Message Jamie from your phone</h3>
    <p>Connect your phone to this café through the provisioned Photon iMessage line.</p>
    {!state ? <p role="status">Checking messaging availability…</p> : !configured ? <p role="status">Messaging setup is incomplete on the server. Your café still works without it.</p> : null}
    {error && <p role="alert">{error}</p>}
    {pairing?.paired ? <>
      <p role="status">Phone {pairing.candidate} connected to this café. Send Jamie a request. Purchases require an explicit proposal approval.</p>
      <button type="button" className="btn btn-small" disabled={!online} onClick={() => conn?.send({ t: "photon_pair_revoke" })}>Disconnect phone</button>
    </> : <>
      <label>Team phone activation code <input type="password" autoComplete="off" maxLength={256} value={activation} onChange={e => setActivation(e.target.value)} /></label>
      <button type="button" className="btn btn-small" disabled={!configured || !online || !activation.trim()} onClick={() => { conn?.send({ t: "photon_pair_start", activationCode: activation }); setActivation(""); }}>{pairing?.code ? "Replace pairing code" : "Create pairing code"}</button>
      {pairing?.code && <p>Send <code>PAIR {pairing.code}</code> to your provisioned Photon line. This code expires in five minutes.</p>}
      {pairing?.candidate && <>
        <p>Phone ending {pairing.candidate} requested access. Confirm only if this is your phone.</p>
        <button type="button" className="btn btn-small" disabled={!online} onClick={() => conn?.send({ t: "photon_pair_confirm" })}>Confirm my phone</button>
        <button type="button" className="btn btn-small" disabled={!online} onClick={() => conn?.send({ t: "photon_pair_revoke" })}>Reject request</button>
      </>}
    </>}
    {pairing?.lastReply && <p role="status">Last reply accepted by Photon. Phone delivery remains unverified. Receipt: <code>{pairing.lastReply.messageId}</code></p>}
    <p className="hint">Pairing ends when this café expires or the server restarts. Provider acceptance alone does not confirm delivery to your phone.</p>
  </aside>;
}
