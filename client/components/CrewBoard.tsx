import { useId, useState } from "react";
import { useApp } from "../lib/store";
import "./CrewBoard.css";
import type { PlayerRole, RoomSnapshot } from "../../shared/types";

export function CrewBoard({ snapshot }: { snapshot: RoomSnapshot }) {
  const you = useApp(s=>s.you);
  const isOwner = snapshot.players.some(p=>p.id===you && p.role==="owner");
  const ranked = [...snapshot.players].sort((a, b) => b.score - a.score);
  const jamie = snapshot.aiBarista;
  const jamieBusy = !!jamie?.holding;
  return (
    <aside className="side-panel panel crew-board">
      <p className="tag">Crew scoreboard</p>
      <h3>Who’s carrying the shift</h3>
      {isOwner && <p className="hint">Assign a builder to let a friend edit and furnish the café.</p>}
      <ol>
        {ranked.map((p, i) => (
          <li key={p.id}>
            <span className="crew-rank">{i + 1}</span>
            <span className="crew-swatch" style={{ background: p.color }} />
            <div>
              <strong>{p.name}</strong>
              <em>{p.connected === false ? "Disconnected · place saved" : p.role}</em>
            </div>
            <b>{p.score}</b>
            {isOwner && p.role!=="owner" && <RoleAssignment key={`${p.id}:${p.role}`} memberId={p.id} name={p.name} role={p.role} />}
          </li>
        ))}
        <li className="crew-ai" aria-label="Jamie AI barista">
          <span className="crew-rank">AI</span>
          <span className="crew-swatch" style={{ background: "#6b7280" }} />
          <div>
            <strong>Jamie</strong>
            <em>{jamie?.status ?? (jamieBusy ? holdingLabel(jamie?.holding) : "on standby")}</em>
          </div>
          <b>{jamieBusy ? "·" : "—"}</b>
        </li>
      </ol>
    </aside>
  );
}

function holdingLabel(holding: string | null | undefined): string {
  if (!holding) return "helping";
  if (holding.startsWith("ticket:")) return `ticket · ${holding.slice(7)}`;
  if (holding.startsWith("drink:")) return `drink · ${holding.slice(6)}`;
  return holding;
}


function RoleAssignment({memberId,name,role}:{memberId:string;name:string;role:Exclude<PlayerRole,"owner">}) {
  const id=useId();
  const [draft,setDraft]=useState(role);
  const conn=useApp(s=>s.conn),status=useApp(s=>s.status);
  return <form className="crew-role-form" aria-label={`Assign role to ${name}`} onKeyDown={event=>{ if(event.key==="Tab")event.stopPropagation(); }} onSubmit={event=>{
    event.preventDefault();
    if(status==="open" && draft!==role)conn?.send({t:"set_member_role",memberId,role:draft});
  }}>
    <label htmlFor={id}>{name}’s role</label>
    <select id={id} name="role" value={draft} onChange={event=>setDraft(event.target.value as Exclude<PlayerRole,"owner">)}>
      <option value="barista">Barista</option>
      <option value="cashier">Cashier</option>
      <option value="builder">Builder · furniture purchases</option>
      <option value="manager">Manager · business decisions</option>
      <option value="customer">Customer · visit only</option>
    </select>
    <button type="submit" disabled={status!=="open" || draft===role}>Assign role</button>
    <span role="status">Current role: {role}</span>
  </form>;
}
