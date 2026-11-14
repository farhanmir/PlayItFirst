import type { RoomSnapshot } from "../../shared/types";
import { useApp } from "../lib/store";

/** Compact director prompt — stays out of the café view until the player chooses. */
export function DirectorPanel({ snapshot }: { snapshot: RoomSnapshot }) {
  const event = snapshot.director;
  const conn = useApp((s) => s.conn);
  if (!event || event.resolved) return null;

  return (
    <div className={`director-panel panel director-compact severity-${event.severity}`}>
      <p className="tag">Floor call</p>
      <h3>{event.title}</h3>
      <p>{event.body}</p>
      <div className="director-choices">
        {event.choices.map((c) => (
          <button
            key={c.id}
            type="button"
            className="btn btn-ghost"
            onClick={() => conn?.send({ t: "director_choice", eventId: event.id, choiceId: c.id })}
          >
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}
