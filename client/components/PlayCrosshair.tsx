import { useMemo } from "react";
import type { RoomSnapshot } from "../../shared/types";
import { nearestStation } from "../../shared/stations";
import { actionPrompt, stationLabel } from "../lib/suggestAction";
import { useApp } from "../lib/store";

/** First-person reticle + live station prompt. */
export function PlayCrosshair({
  snapshot,
  mode,
}: {
  snapshot: RoomSnapshot;
  mode: "first" | "third" | "monitor" | "dollhouse";
}) {
  const you = useApp((s) => s.you);
  const station = useMemo(() => (you ? nearestStation(snapshot, you) : null), [snapshot, you]);
  const label = stationLabel(station);
  const prompt = useMemo(() => actionPrompt(snapshot, you), [snapshot, you]);

  if (mode !== "first" && mode !== "third") return null;

  return (
    <div className={`play-crosshair ${mode}`} aria-hidden={mode !== "first"}>
      {mode === "first" ? <span className="reticle" /> : null}
      <div className="crosshair-prompt">
        <strong>{label ?? "Café floor"}</strong>
        <span>{prompt}</span>
      </div>
    </div>
  );
}
