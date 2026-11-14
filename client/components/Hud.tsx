import type { RoomSnapshot } from "../../shared/types";
import { useApp } from "../lib/store";

export function Hud({ snapshot }: { snapshot: RoomSnapshot }) {
  const f = snapshot.finance;
  const m = snapshot.metrics;
  const qrSvg = useApp((s) => s.qrSvg);
  const roomCode = useApp((s) => s.roomCode);
  const status = useApp((s) => s.status);

  return (
    <header className="hud-top panel">
      <div className="hud-brand">
        <strong>PlayFirst</strong>
        <span className="tag">{snapshot.phase}</span>
        <span className={`conn ${status}`} title={`Connection: ${status}`}>
          {status}
        </span>
      </div>

      <div className="hud-vitals" aria-label="Café vitals">
        <Vital label="Funds" value={`$${Math.round(f.balance).toLocaleString()}`} />
        <Vital label="Revenue" value={`+$${Math.round(f.revenue).toLocaleString()}`} tone="ok" />
        <Vital label="Served" value={String(m.customersServed)} />
        <Vital label="Queue" value={String(m.queueLength)} />
        <Vital label="Wait" value={`${m.avgWaitSec}s`} />
        <Vital label="Happy" value={`${Math.round(m.satisfaction)}%`} />
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
}: {
  label: string;
  value: string;
  tone?: "ok";
}) {
  return (
    <div className="vital">
      <span>{label}</span>
      <strong className={tone}>{value}</strong>
    </div>
  );
}
