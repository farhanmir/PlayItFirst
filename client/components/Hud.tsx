import type { RoomSnapshot } from "../../shared/types";
import { useApp } from "../lib/store";

export function Hud({ snapshot }: { snapshot: RoomSnapshot }) {
  const f = snapshot.finance;
  const m = snapshot.metrics;
  const qrSvg = useApp((s) => s.qrSvg);
  const roomCode = useApp((s) => s.roomCode);
  const status = useApp((s) => s.status);

  return (
    <div className="hud-top">
      <div className="hud-brand panel">
        <strong>PlayFirst</strong>
        <span className="tag">{snapshot.phase}</span>
        <span className={`conn ${status}`}>{status}</span>
      </div>

      <div className="hud-finance panel">
        <div>
          <span className="label">Business funds</span>
          <strong>${Math.round(f.balance).toLocaleString()}</strong>
        </div>
        <div>
          <span className="label">Revenue</span>
          <strong className="ok">+${Math.round(f.revenue).toLocaleString()}</strong>
        </div>
        <div>
          <span className="label">Nessie acct</span>
          <code>{f.nessieAccountId}</code>
        </div>
      </div>

      <div className="hud-metrics panel">
        <Metric label="Served" value={String(m.customersServed)} />
        <Metric label="Queue" value={String(m.queueLength)} />
        <Metric label="Wait" value={`${m.avgWaitSec}s`} />
        <Metric label="Happy" value={`${Math.round(m.satisfaction)}%`} />
      </div>

      <div className="hud-qr panel">
        <div dangerouslySetInnerHTML={{ __html: qrSvg || "" }} />
        <span>{roomCode}</span>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
