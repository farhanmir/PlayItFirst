import { useEffect, useState } from "react";
import type { PropertyListing } from "../../shared/types";
import { apiUrl } from "../lib/api";

interface MatterportModel {
  propertyId: string;
  modelId: string;
  embedUrl: string;
  source: "matterport-live" | "matterport-showcase";
  name?: string;
  floorCount?: number;
  detail?: string;
}

export function MatterportPanel({ property }: { property: PropertyListing }) {
  const [model, setModel] = useState<MatterportModel | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setModel(null);
    setOpen(false);
    setError(null);
    if (property.source !== "costar-extract" && property.source !== "costar-live") return;
    void fetch(apiUrl(`/api/matterport/${encodeURIComponent(property.id)}`))
      .then(async (r) => {
        if (!r.ok) throw new Error("Matterport lookup failed");
        return (await r.json()) as MatterportModel;
      })
      .then((m) => {
        if (!cancelled) setModel(m);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Unavailable");
      });
    return () => {
      cancelled = true;
    };
  }, [property.id, property.source]);

  if (property.source !== "costar-extract" && property.source !== "costar-live") return null;
  const verified = model?.source === "matterport-live" && model.modelId === property.matterportModelId;

  return (
    <aside className="side-panel panel matterport-panel">
      <p className="tag">Matched Matterport property</p>
      <h3>{property.name}</h3>
      <p>{property.floorPlan ? "Playable reconstruction uses measured rooms, walls and openings from the matched scan." : property.matterportHint}</p>
      {!verified ? <p className="muted">{error || model ? "Live walkthrough unavailable; the reconstructed floor remains playable." : "Checking matched walkthrough availability…"}</p> : <>
        <p>Matched model metadata verified · <code>{model!.source}</code></p>
        <div className="matterport-actions">
          <button type="button" className="btn" onClick={() => setOpen(v => !v)}>{open ? "Hide walkthrough" : "Open Matterport walkthrough"}</button>
          <a className="btn btn-ghost" href={model!.embedUrl} target="_blank" rel="noreferrer">Open in Matterport</a>
        </div>
      </>}
      {open && model && verified ? (
        <div className="matterport-frame">
          <iframe
            title={`Matterport ${model.modelId}`}
            src={model.embedUrl}
            allow="xr-spatial-tracking; fullscreen; autoplay"
            allowFullScreen
          />
        </div>
      ) : null}
    </aside>
  );
}
