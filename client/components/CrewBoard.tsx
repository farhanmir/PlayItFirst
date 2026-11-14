import type { RoomSnapshot } from "../../shared/types";

export function CrewBoard({ snapshot }: { snapshot: RoomSnapshot }) {
  const ranked = [...snapshot.players].sort((a, b) => b.score - a.score);
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
      </ol>
    </aside>
  );
}
