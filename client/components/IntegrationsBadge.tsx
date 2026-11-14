import { useEffect, useState } from "react";
import { apiUrl } from "../lib/api";
import { useApp } from "../lib/store";

interface Integrations {
  costar: string;
  costarDetail?: string;
  matterport: boolean;
  nessie: boolean;
  deepagents: boolean;
  photonVoice: string;
  webxr: string;
}

export function IntegrationsBadge() {
  const [info, setInfo] = useState<Integrations | null>(null);
  const manager = useApp((s) => s.snapshot?.manager);

  useEffect(() => {
    void fetch(apiUrl("/api/integrations"))
      .then((r) => r.json())
      .then((d: Integrations) => setInfo(d))
      .catch(() => undefined);
  }, []);

  if (!info) return null;

  const verified = manager?.runtime === "deepagents" && manager.providerVerified;
  const contextBlocked = manager?.runtime === "local" && manager.trace.some((entry) => entry.tool === "model_context_blocked");

  const chips = [
    { label: "CoStar", on: info.costar === "costar-live" || info.costar === "costar-extract", tip: info.costarDetail || info.costar },
    { label: "Matterport", on: info.matterport, tip: info.matterport ? "Model API token" : "Showcase embed (stand-in)" },
    { label: "Nessie", on: info.nessie, tip: info.nessie ? "Sandbox key" : "Local ledger" },
    {
      label: `Deepagents · ${verified ? "verified" : info.deepagents ? "configured" : "local"}`,
      on: verified,
      tip: verified ? "Successful live provider run verified in this room"
        : contextBlocked ? "Model configured; this sponsor-data room uses local rules because external model processing is not authorized"
        : info.deepagents ? "Model configured; awaiting a successful live provider run in this room" : "Local manager rules; model key missing",
    },
    { label: "Crew voice", on: true, tip: `${info.photonVoice} — not Photon 2.0 messaging` },
    { label: "WebXR", on: true, tip: info.webxr },
  ];

  return (
    <div className="integrations-badge" aria-label="Sponsor integration status">
      {chips.map((c) => (
        <span key={c.label} className={c.on ? "live" : "mock"} title={c.tip}>
          {c.label}
        </span>
      ))}
    </div>
  );
}
