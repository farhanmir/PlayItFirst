/** Matterport-inspired dollhouse / floorplan camera preset for the café. */
import { play } from "../lib/audio";

export function DollhouseToggle({
  mode,
  onChange,
}: {
  mode: "orbit" | "dollhouse" | "play";
  onChange: (m: "orbit" | "dollhouse" | "play") => void;
}) {
  return (
    <div className="view-toggle panel" role="group" aria-label="Camera view">
      <span className="tag">Matterport view</span>
      {(
        [
          ["orbit", "Explore"],
          ["dollhouse", "Dollhouse"],
          ["play", "Floor"],
        ] as const
      ).map(([id, label]) => (
        <button
          key={id}
          type="button"
          className={mode === id ? "active" : ""}
          aria-label={`${label} camera`}
          aria-pressed={mode === id}
          onClick={() => {
            play("ui", 0.2);
            onChange(id);
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
