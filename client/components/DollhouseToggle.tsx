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
    <div className="view-toggle panel">
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
