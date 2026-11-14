import { useEffect, useState } from "react";
import { apiUrl } from "../lib/api";

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

  useEffect(() => {
    void fetch(apiUrl("/api/integrations"))
      .then((r) => r.json())
      .then((d: Integrations) => setInfo(d))
      .catch(() => undefined);
  }, []);

  if (!info) return null;

  const chips = [
    { label: "CoStar", on: info.costar === "costar-live", tip: info.costarDetail || info.costar },
    { label: "Matterport", on: info.matterport, tip: info.matterport ? "Model API token" : "Showcase embed (stand-in)" },
    { label: "Nessie", on: info.nessie, tip: info.nessie ? "Sandbox key" : "Local ledger" },
    {
      label: "Deepagents",
      on: info.deepagents,
      tip: info.deepagents ? "Hosted LLM (tool runtime still partial)" : "Local director rules",
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
