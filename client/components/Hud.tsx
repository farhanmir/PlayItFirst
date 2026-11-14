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
  const you = useApp((s) => s.you);
  const me = snapshot.players.find((p) => p.id === you);
  const [mute, setMute] = useState(false);
  const holding = me?.holding
    ? me.holding.startsWith("ticket:")
      ? me.holding.slice(7)
      : me.holding.startsWith("brewing:")
        ? `Brewing ${me.holding.slice(8).split("@")[0]}`
        : me.holding.startsWith("drink:")
          ? me.holding.slice(6)
          : me.holding
    : null;

  return (
    <header className={`hud-top panel ${live ? "hud-live" : ""} ${compact ? "hud-compact" : ""}`}>
      <div className="hud-brand">
        <strong>SoftOpen</strong>
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
          {mute ? "Sound off" : "Sound"}
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
        {compact && holding ? <Vital label="Holding" value={holding} priority="high" /> : null}
      </div>

      <div className="hud-invite">
        {qrSvg ? (
          <div className="hud-qr" dangerouslySetInnerHTML={{ __html: qrSvg }} title="Scan to join" />
        ) : null}
        <div className="hud-invite-meta">
          <span className="hud-room">{roomCode}</span>
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
