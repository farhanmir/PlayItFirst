import { play } from "../lib/audio";
import type { CafeViewMode } from "./CafeScene";

const PLAY_MODES: { id: CafeViewMode; label: string; blurb: string }[] = [
  { id: "first", label: "1st", blurb: "Play on the floor" },
  { id: "third", label: "3rd", blurb: "Follow your barista" },
  { id: "monitor", label: "Orbit", blurb: "Orbit the whole café" },
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
      <svg className="camera-mark" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M3 7h4l2-3h6l2 3h4v13H3Z"/><circle cx="12" cy="13" r="4"/></svg>
      {PLAY_MODES.map((m) => (
        <button
          key={m.id}
          type="button"
          className={mode === m.id || (mode === "dollhouse" && m.id === "monitor") ? "active" : ""}
          title={m.blurb}
          aria-label={m.label}
          aria-pressed={mode === m.id || (mode === "dollhouse" && m.id === "monitor")}
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
