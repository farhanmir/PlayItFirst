import { play } from "../lib/audio";
import type { CafeViewMode } from "./CafeScene";

const MODES: { id: CafeViewMode; label: string; blurb: string }[] = [
  { id: "first", label: "1st Person", blurb: "Play on the floor" },
  { id: "third", label: "3rd Person", blurb: "Follow your barista" },
  { id: "monitor", label: "Monitor", blurb: "Orbit the whole café" },
  { id: "dollhouse", label: "Dollhouse", blurb: "Matterport cutaway" },
];

export function ViewModeToggle({
  mode,
  onChange,
}: {
  mode: CafeViewMode;
  onChange: (m: CafeViewMode) => void;
}) {
  return (
    <div className="view-toggle panel" role="group" aria-label="Camera view">
      <span className="tag">Camera</span>
      {MODES.map((m) => (
        <button
          key={m.id}
          type="button"
          className={mode === m.id ? "active" : ""}
          title={m.blurb}
          aria-label={m.label}
          aria-pressed={mode === m.id}
          onClick={() => {
            play("ui", 0.2);
            onChange(m.id);
          }}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
