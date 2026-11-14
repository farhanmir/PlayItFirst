import { useEffect, useState } from "react";
import type { RoomSnapshot } from "../../shared/types";

const TIPS: { when: (s: RoomSnapshot) => boolean; title: string; body: string }[] = [
  {
    when: (s) => s.phase === "build" && !s.open,
    title: "Design for flow",
    body: "Keep the counter and pickup apart so the queue doesn’t block the door. Machines buy throughput.",
  },
  {
    when: (s) => s.phase === "play" && s.metrics.customersServed === 0,
    title: "Run the line",
    body: "Take order → make coffee → serve. WASD to move. Friends can join from the QR code.",
  },
  {
    when: (s) => s.metrics.queueLength >= 4,
    title: "Queue pressure",
    body: "Try the tabletop board to move the counter, or answer Jamie in Photon for help.",
  },
  {
    when: (s) => !!s.director && !s.director.resolved,
    title: "Director event",
    body: "Your choice changes the simulation — staffing, menu, and satisfaction all respond.",
  },
];

export function TutorialTips({ snapshot }: { snapshot: RoomSnapshot }) {
  const [dismissed, setDismissed] = useState<string | null>(null);
  const tip = TIPS.find((t) => t.when(snapshot) && t.title !== dismissed);

  useEffect(() => {
    setDismissed(null);
  }, [snapshot.phase, snapshot.open]);

  if (!tip) return null;

  return (
    <div className="tutorial-tip panel rise">
      <div>
        <p className="tag">Tip</p>
        <h3>{tip.title}</h3>
        <p>{tip.body}</p>
      </div>
      <button type="button" className="btn btn-ghost btn-small" onClick={() => setDismissed(tip.title)}>
        Got it
      </button>
    </div>
  );
}
