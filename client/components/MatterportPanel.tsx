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
    setError(null);
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
  }, [property.id]);

  return (
    <aside className="side-panel panel matterport-panel">
      <p className="tag">Matterport twin</p>
      <h3>{property.name}</h3>
      <p>
        {model?.detail || property.matterportHint}
        {model ? (
          <>
            {" "}
            · <code>{model.source}</code>
          </>
        ) : null}
      </p>
      {error ? <p className="muted">{error}</p> : null}
      <div className="matterport-actions">
        <button type="button" className="btn" disabled={!model} onClick={() => setOpen((v) => !v)}>
          {open ? "Hide walkthrough" : "Open Matterport walkthrough"}
        </button>
        {model ? (
          <a className="btn btn-ghost" href={model.embedUrl} target="_blank" rel="noreferrer">
            Open in Matterport
          </a>
        ) : null}
      </div>
      {open && model ? (
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
