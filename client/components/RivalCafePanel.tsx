/**
 * Side-by-side race vs a simulated rival café in another CoStar listing.
 */
import { useEffect, useMemo, useState } from "react";
import type { PropertyListing, RoomSnapshot } from "../../shared/types";
import { useApp } from "../lib/store";
import {
  createRivalProfile,
  pickRivalProperty,
  playerRaceScore,
  simulateRivalScore,
} from "../lib/rivalCafe";

export function RivalCafePanel({ snapshot }: { snapshot: RoomSnapshot }) {
  const properties = useApp((s) => s.properties);
  const [wallElapsed, setWallElapsed] = useState(0);

  const rivalListing = useMemo(
    () => pickRivalProperty(snapshot.property?.id, properties as PropertyListing[]),
    [snapshot.property?.id, properties],
  );

  const profile = useMemo(
    () => (rivalListing ? createRivalProfile(rivalListing) : null),
    [rivalListing],
  );

  // Tick while doors are open so the race animates even if simTime jumps
  useEffect(() => {
    if (!snapshot.open) {
      setWallElapsed(0);
      return;
    }
    const started = performance.now();
    const id = window.setInterval(() => {
      setWallElapsed((performance.now() - started) / 1000);
    }, 400);
    return () => window.clearInterval(id);
  }, [snapshot.open, snapshot.property?.id]);

  const elapsed = snapshot.open ? Math.max(snapshot.simTime, wallElapsed) : 0;
  const rival = rivalListing
    ? simulateRivalScore(rivalListing, elapsed, { open: snapshot.open })
    : null;
  const youScore = playerRaceScore(snapshot.finance.revenue, snapshot.metrics.customersServed);
  const rivalScore = rival?.score ?? 0;
  const lead = youScore - rivalScore;
  const maxScore = Math.max(youScore, rivalScore, 1);
  const youPct = Math.round((youScore / maxScore) * 100);
  const rivalPct = Math.round((rivalScore / maxScore) * 100);

  if (!profile || !rival) {
    return (
      <aside className="side-panel panel rival-panel">
        <p className="tag">Rival café</p>
        <p>Loading competitor listing…</p>
      </aside>
    );
  }

  return (
    <aside className="side-panel panel rival-panel">
      <p className="tag">Rival café</p>
      <h3>Neighborhood race</h3>
      <p className="rival-lede">
        {profile.name} just signed {profile.propertyName} in {profile.neighborhood}. Same street
        economics — who builds the better cup?
      </p>

      <div className="rival-meta" style={{ ["--rival-tone" as string]: profile.tone }}>
        <div className="rival-badge" aria-hidden />
        <div>
          <strong>{profile.name}</strong>
          <span>
            {profile.city} · {profile.costarId}
          </span>
          <span className="rival-manager">Managed by {profile.manager}</span>
        </div>
      </div>

      {!snapshot.open ? (
        <p className="rival-wait">Open your doors to start the race — they are stocking shelves too.</p>
      ) : (
        <p className={`rival-lead ${lead >= 0 ? "ahead" : "behind"}`}>
          {lead === 0
            ? "Dead heat — keep pouring."
            : lead > 0
              ? `You lead by ${lead.toLocaleString()} pts`
              : `${profile.name} leads by ${Math.abs(lead).toLocaleString()} pts`}
        </p>
      )}

      <div className="rival-bars" role="img" aria-label="Score comparison">
        <RaceBar label="You" value={youScore} pct={youPct} tone="you" />
        <RaceBar label={profile.name} value={rivalScore} pct={rivalPct} tone="rival" />
      </div>

      <div className="rival-grid">
        <div>
          <h4>You · {snapshot.property?.neighborhood}</h4>
          <Stat label="Revenue" value={`$${Math.round(snapshot.finance.revenue).toLocaleString()}`} />
          <Stat label="Served" value={String(snapshot.metrics.customersServed)} />
          <Stat label="Happy" value={`${Math.round(snapshot.metrics.satisfaction)}%`} />
        </div>
        <div className="rival-col">
          <h4>
            {profile.name} · {profile.neighborhood}
          </h4>
          <Stat label="Revenue" value={`$${rival.revenue.toLocaleString()}`} />
          <Stat label="Served" value={String(rival.customersServed)} />
          <Stat label="Happy" value={`${rival.satisfaction}%`} />
        </div>
      </div>
      <p className="fine">Simulated rival paced from CoStar foot traffic — beatable in a live demo.</p>
    </aside>
  );
}

function RaceBar({
  label,
  value,
  pct,
  tone,
}: {
  label: string;
  value: number;
  pct: number;
  tone: "you" | "rival";
}) {
  return (
    <div className={`race-bar race-${tone}`}>
      <div className="race-bar-head">
        <span>{label}</span>
        <strong>{value.toLocaleString()}</strong>
      </div>
      <div className="race-track">
        <div className="race-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="tl-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
