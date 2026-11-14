import type { RoomSnapshot } from "../../shared/types";

export function CrewBoard({ snapshot }: { snapshot: RoomSnapshot }) {
  const ranked = [...snapshot.players].sort((a, b) => b.score - a.score);
  const jamie = snapshot.aiBarista;
  const jamieBusy = !!jamie?.holding;
  return (
    <aside className="side-panel panel crew-board">
      <p className="tag">Crew scoreboard</p>
      <h3>Who’s carrying the shift</h3>
      <ol>
        {ranked.map((p, i) => (
          <li key={p.id}>
            <span className="crew-rank">{i + 1}</span>
            <span className="crew-swatch" style={{ background: p.color }} />
            <div>
              <strong>{p.name}</strong>
              <em>{p.role}</em>
            </div>
            <b>{p.score}</b>
          </li>
        ))}
        <li className="crew-ai" aria-label="Jamie AI barista">
          <span className="crew-rank">AI</span>
          <span className="crew-swatch" style={{ background: "#6b7280" }} />
          <div>
            <strong>Jamie</strong>
            <em>{jamieBusy ? holdingLabel(jamie?.holding) : "on standby"}</em>
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
