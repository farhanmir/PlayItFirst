import { useEffect, useRef, useState } from "react";
import type { RoomSnapshot } from "../../shared/types";
import { useApp } from "../lib/store";
import { setMuted, play } from "../lib/audio";

export function Hud({
  snapshot,
  live = false,
  compact = false,
}: {
  snapshot: RoomSnapshot;
  live?: boolean;
  compact?: boolean;
}) {
  const f = snapshot.finance;
  const m = snapshot.metrics;
  const qrSvg = useApp((s) => s.qrSvg);
  const roomCode = useApp((s) => s.roomCode);
  const status = useApp((s) => s.status);
  const [mute, setMute] = useState(false);


  return (
    <header className={`hud-top panel ${live ? "hud-live" : ""} ${compact ? "hud-compact" : ""}`}>
      <div className="hud-brand">
        <strong>Play It First</strong>
        {snapshot.open ? <span className="live-dot" title="Doors open">Open</span> : <span className="tag">Build</span>}
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
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z" />{mute ? <path d="m16 9 6 6m0-6-6 6" /> : <><path d="M15 8a6 6 0 0 1 0 8" /><path d="M18 5a10 10 0 0 1 0 14" /></>}</svg>
        </button>
      </div>

      <div className="hud-vitals" aria-label="Café vitals">
        <Vital label="Cash" value={`$${Math.round(f.balance).toLocaleString()}`} priority="high" />
        <Vital label="Served" value={String(m.customersServed)} priority="high" />
        <Vital label="Queue" value={String(m.queueLength)} priority="high" pulse={m.queueLength >= 4} />
        {!compact ? (
          <>
            <Vital label="Revenue" value={`+$${Math.round(f.revenue).toLocaleString()}`} tone="ok" />
            <Vital label="Wait" value={`${m.avgWaitSec}s`} priority="low" />
            <Vital
              label="Happy"
              value={`${Math.round(m.satisfaction)}%`}
              tone={m.satisfaction >= 70 ? "ok" : undefined}
              priority="high"
            />
          </>
        ) : null}

      </div>

      <details className="hud-invite">
        <summary aria-label="Invite a friend to your café"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M19 6v8m-4-4h8"/></svg><span>Invite</span></summary>
        <div className="invite-popover">
          <strong>Better with a friend</strong>
          <p>Scan with your phone to join this café.</p>
          {qrSvg ? <div className="hud-qr" dangerouslySetInnerHTML={{ __html: qrSvg }} title="Scan to join" /> : null}
          <span className="hud-room">{roomCode}</span>
        </div>
      </details>
    </header>
  );
}

function Vital({
  label,
  value,
  tone,
  priority = "normal",
  pulse = false,
}: {
  label: string;
  value: string;
  tone?: "ok";
  priority?: "high" | "normal" | "low";
  pulse?: boolean;
}) {
  const prev = useRef(value);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (prev.current === value) return;
    prev.current = value;
    setFlash(true);
    const id = window.setTimeout(() => setFlash(false), 420);
    return () => window.clearTimeout(id);
  }, [value]);

  return (
    <div className={`vital vital-${priority} ${flash ? "vital-flash" : ""} ${pulse ? "vital-pulse" : ""}`}>
      <span>{label}</span>
      <strong className={tone}>{value}</strong>
    </div>
  );
}
