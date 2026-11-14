import { useState } from "react";
import type { RoomSnapshot } from "../../shared/types";
import { useApp } from "../lib/store";
import { setMuted, play } from "../lib/audio";

export function Hud({ snapshot }: { snapshot: RoomSnapshot }) {
  const f = snapshot.finance;
  const m = snapshot.metrics;
  const qrSvg = useApp((s) => s.qrSvg);
  const roomCode = useApp((s) => s.roomCode);
  const status = useApp((s) => s.status);
  const [mute, setMute] = useState(false);

  return (
    <header className="hud-top panel">
      <div className="hud-brand">
        <strong>PlayFirst</strong>
        <span className="tag">{snapshot.phase}</span>
        <span className={`conn ${status}`} title={`Connection: ${status}`}>
          {status}
        </span>
        <button
          type="button"
          className="btn-ghost btn-small hud-mute"
          aria-label={mute ? "Unmute sound" : "Mute sound"}
          aria-pressed={mute}
          onClick={() => {
            const next = !mute;
            setMute(next);
            setMuted(next);
            if (!next) play("ui", 0.2);
          }}
        >
          {mute ? "Sound off" : "Sound on"}
        </button>
      </div>

      <div className="hud-vitals" aria-label="Café vitals">
        <Vital label="Funds" value={`$${Math.round(f.balance).toLocaleString()}`} />
        <Vital label="Revenue" value={`+$${Math.round(f.revenue).toLocaleString()}`} tone="ok" priority="high" />
        <Vital label="Served" value={String(m.customersServed)} priority="high" />
        <Vital label="Queue" value={String(m.queueLength)} priority="high" />
        <Vital label="Wait" value={`${m.avgWaitSec}s`} priority="low" />
        <Vital
          label="Happy"
          value={`${Math.round(m.satisfaction)}%`}
          tone={m.satisfaction >= 70 ? "ok" : undefined}
          priority="high"
        />
      </div>

      <div className="hud-invite">
        {qrSvg ? (
          <div className="hud-qr" dangerouslySetInnerHTML={{ __html: qrSvg }} title="Scan to join" />
        ) : null}
        <div className="hud-invite-meta">
          <span className="hud-room">{roomCode}</span>
          {f.nessieAccountId ? <code className="hud-nessie">{f.nessieAccountId}</code> : null}
        </div>
      </div>
    </header>
  );
}

function Vital({
  label,
  value,
  tone,
  priority = "normal",
}: {
  label: string;
  value: string;
  tone?: "ok";
  priority?: "high" | "normal" | "low";
}) {
  return (
    <div className={`vital vital-${priority}`}>
      <span>{label}</span>
      <strong className={tone}>{value}</strong>
    </div>
  );
}
