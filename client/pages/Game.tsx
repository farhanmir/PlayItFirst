import { useMemo, useState } from "react";
import { useApp } from "../lib/store";
import { CafeScene } from "../components/CafeScene";
import { Hud } from "../components/Hud";
import { BuildPanel } from "../components/BuildPanel";
import { PlayControls } from "../components/PlayControls";
import { DirectorPanel } from "../components/DirectorPanel";
import { PhotonChat } from "../components/PhotonChat";
import { FinanceLedger } from "../components/FinanceLedger";
import { Tabletop } from "../components/Tabletop";
import { BlueprintPanel } from "../components/BlueprintPanel";
import "./game.css";

export function Game() {
  const snapshot = useApp((s) => s.snapshot);
  const blueprint = useApp((s) => s.blueprint);
  const mobile = useApp((s) => s.mobile);
  const [tab, setTab] = useState<"build" | "ops" | "table" | "plan">("ops");
  // Desktop keeps an orbit overview for demos; phones get a follow-cam play view.
  const firstPerson = useMemo(() => mobile && snapshot?.phase === "play", [mobile, snapshot?.phase]);

  if (!snapshot?.property) {
    return (
      <main className="game-loading">
        <p className="brand-inline">PlayFirst</p>
        <p>Waiting for property selection…</p>
      </main>
    );
  }

  return (
    <main className="game">
      <Hud snapshot={snapshot} />
      <div className="game-stage">
        <CafeScene snapshot={snapshot} firstPerson={!!firstPerson && snapshot.phase !== "build"} />
        <DirectorPanel snapshot={snapshot} />
        {snapshot.phase === "play" && <PlayControls snapshot={snapshot} />}
      </div>

      <div className="game-rails">
        <div className="rail-tabs">
          {(
            [
              ["build", "Build"],
              ["ops", "Ops"],
              ["table", "Tabletop"],
              ["plan", "Blueprint"],
            ] as const
          ).map(([id, label]) => (
            <button key={id} type="button" className={tab === id ? "active" : ""} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </div>
        <div className="rail-body">
          {tab === "build" && <BuildPanel snapshot={snapshot} />}
          {tab === "ops" && (
            <>
              <PhotonChat snapshot={snapshot} />
              <FinanceLedger snapshot={snapshot} />
              <EventLog lines={snapshot.eventLog} />
            </>
          )}
          {tab === "table" && <Tabletop snapshot={snapshot} />}
          {tab === "plan" && <BlueprintPanel markdown={blueprint} />}
        </div>
      </div>
    </main>
  );
}

function EventLog({ lines }: { lines: string[] }) {
  return (
    <aside className="side-panel panel event-log">
      <h3>Floor log</h3>
      <ul>
        {lines.slice(0, 10).map((line, i) => (
          <li key={`${i}-${line}`}>{line}</li>
        ))}
      </ul>
    </aside>
  );
}
