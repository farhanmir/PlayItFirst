import { useEffect, useMemo, useState } from "react";
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
import { OrderRail } from "../components/OrderRail";
import { TutorialTips } from "../components/TutorialTips";
import { TimelineCompare } from "../components/TimelineCompare";
import { play } from "../lib/audio";
import "./game.css";

export function Game() {
  const snapshot = useApp((s) => s.snapshot);
  const blueprint = useApp((s) => s.blueprint);
  const mobile = useApp((s) => s.mobile);
  const [tab, setTab] = useState<"build" | "ops" | "table" | "future" | "plan">("ops");
  const firstPerson = useMemo(() => mobile && snapshot?.phase === "play", [mobile, snapshot?.phase]);

  useEffect(() => {
    if (!snapshot) return;
    if (snapshot.open && snapshot.phase === "play" && snapshot.eventLog[0]?.includes("Doors open")) {
      play("open");
    }
  }, [snapshot?.open]);

  useEffect(() => {
    if (snapshot?.director && !snapshot.director.resolved) play("rush", 0.35);
  }, [snapshot?.director?.id]);

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
        <TutorialTips snapshot={snapshot} />
        <DirectorPanel snapshot={snapshot} />
        {snapshot.phase === "play" && (
          <>
            <OrderRail snapshot={snapshot} />
            <PlayControls snapshot={snapshot} />
          </>
        )}
      </div>

      <div className="game-rails">
        <div className="rail-tabs">
          {(
            [
              ["build", "Build"],
              ["ops", "Ops"],
              ["table", "Table"],
              ["future", "Future"],
              ["plan", "Plan"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={tab === id ? "active" : ""}
              onClick={() => {
                play("ui", 0.25);
                setTab(id);
              }}
            >
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
              <InventoryCard snapshot={snapshot} />
              <EventLog lines={snapshot.eventLog} />
            </>
          )}
          {tab === "table" && <Tabletop snapshot={snapshot} />}
          {tab === "future" && <TimelineCompare snapshot={snapshot} />}
          {tab === "plan" && <BlueprintPanel markdown={blueprint} />}
        </div>
      </div>
    </main>
  );
}

function InventoryCard({ snapshot }: { snapshot: import("../../shared/types").RoomSnapshot }) {
  const inv = snapshot.inventory ?? { milk: 0, cups: 0, beans: 0 };
  return (
    <aside className="side-panel panel inventory-panel">
      <p className="tag">Inventory</p>
      <div className="inv-grid">
        <div>
          <span>Milk</span>
          <strong className={inv.milk < 4 ? "bad" : ""}>{inv.milk}</strong>
        </div>
        <div>
          <span>Cups</span>
          <strong className={inv.cups < 6 ? "bad" : ""}>{inv.cups}</strong>
        </div>
        <div>
          <span>Beans</span>
          <strong className={inv.beans < 5 ? "bad" : ""}>{inv.beans}</strong>
        </div>
      </div>
    </aside>
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
