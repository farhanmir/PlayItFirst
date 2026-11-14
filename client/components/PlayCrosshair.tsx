import { useMemo } from "react";
import type { RoomSnapshot } from "../../shared/types";
import { nearestStation } from "../../shared/stations";
import { suggestedAction, stationLabel } from "../lib/suggestAction";
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
  const suggest = useMemo(() => suggestedAction(snapshot, you), [snapshot, you]);
  const label = stationLabel(station);

  if (mode !== "first" && mode !== "third") return null;

  const actionHint =
    suggest === "take_order"
      ? "E · Take order"
      : suggest === "make_coffee"
        ? "F · Brew"
        : suggest === "serve"
          ? "R · Serve"
          : suggest === "restock"
            ? "Q · Restock"
            : "Space · Next action";

  return (
    <div className={`play-crosshair ${mode}`} aria-hidden={mode !== "first"}>
      {mode === "first" ? <span className="reticle" /> : null}
      <div className="crosshair-prompt">
        {label ? <strong>{label}</strong> : <strong>Floor</strong>}
        <span>{actionHint}</span>
      </div>
    </div>
  );
}
