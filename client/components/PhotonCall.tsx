/**
 * Photon Voice–style incoming call from the AI café manager.
 * Demo wow factor: Jamie "calls" during a rush; accepting mutates sim state via Photon reply path.
 */
import { useEffect, useState } from "react";
import type { RoomSnapshot } from "../../shared/types";
import { useApp } from "../lib/store";
import { play } from "../lib/audio";

export function PhotonCall({ snapshot }: { snapshot: RoomSnapshot }) {
  const conn = useApp((s) => s.conn);
  const mobile = useApp((s) => s.mobile);
  const [ringing, setRinging] = useState(false);
  const [active, setActive] = useState(false);
  const [line, setLine] = useState("");
  const [seenEvent, setSeenEvent] = useState<string | null>(null);
  const directorOpen = !!snapshot.director && !snapshot.director.resolved;

  useEffect(() => {
    const ev = snapshot.director;
    if (!ev || ev.resolved) return;
    if (ev.severity !== "critical") return;
    if (ev.id === seenEvent) return;
    setSeenEvent(ev.id);
    setRinging(true);
    play("rush", 0.5);
    play("ping", 0.4);
  }, [snapshot.director?.id, snapshot.director?.resolved, snapshot.director?.severity, seenEvent]);

  // Narrow screens: keep director choices readable — show the call after they resolve.
  if (mobile && directorOpen && !active) return null;
  if (!ringing && !active) return null;

  return (
    <div className={`photon-call panel ${active ? "live" : "ringing"}`}>
      <div className="call-avatar" aria-hidden>
        <span>J</span>
        <i className="pulse" />
      </div>
      <div className="call-copy">
        <p className="tag">Photon Voice</p>
        <h3>{active ? "Jamie · live" : "Incoming call · Jamie"}</h3>
        <p>
          {active
            ? line || "hey — pickup is jammed and milk is almost out. what do you want me to do?"
            : "Café manager reporting a floor emergency."}
        </p>
      </div>
      <div className="call-actions">
        {!active ? (
          <>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setRinging(false);
                setActive(true);
                setLine("hey — pickup is jammed and milk is almost out. what do you want me to do?");
                play("open", 0.35);
              }}
            >
              Answer
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setRinging(false);
                play("sad", 0.3);
              }}
            >
              Decline
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="btn"
              onClick={() => {
                conn?.send({ t: "photon_reply", body: "move alex to drinks and order more milk" });
                setLine("done — alex is on drinks and milk is ordered. hang tight.");
                play("serve");
                setTimeout(() => setActive(false), 2200);
              }}
            >
              “Move Alex · order milk”
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                if (snapshot.director && !snapshot.director.resolved) {
                  conn?.send({
                    t: "director_choice",
                    eventId: snapshot.director.id,
                    choiceId: "temp_help",
                  });
                }
                setLine("hiring temp help now. queue should ease.");
                play("coin");
                setTimeout(() => setActive(false), 2200);
              }}
            >
              Hire temp help
            </button>
            <button type="button" className="btn btn-ghost btn-small" onClick={() => setActive(false)}>
              Hang up
            </button>
          </>
        )}
      </div>
    </div>
  );
}
