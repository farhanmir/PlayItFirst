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
    body: "Take order → brew → serve. Space does the highlighted action. Friends join via QR.",
  },
  {
    when: (s) => s.metrics.queueLength >= 4,
    title: "Queue pressure",
    body: "Open the Table tab and drag the counter marker — layout syncs live and the line reroutes.",
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
