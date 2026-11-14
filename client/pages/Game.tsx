import { useEffect, useState } from "react";
import { useApp } from "../lib/store";
import { CafeScene } from "../components/CafeScene";
import { CafeCanvasFallback } from "../components/CafeCanvasFallback";
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
import { RivalCafePanel } from "../components/RivalCafePanel";
import { RolePicker } from "../components/RolePicker";
import { HelpOverlay } from "../components/HelpOverlay";
import { PhotonCall } from "../components/PhotonCall";
import { ViewModeToggle } from "../components/ViewModeToggle";
import { SessionRecap } from "../components/SessionRecap";
import { WebXRHint } from "../components/WebXRHint";
import { CrewBoard } from "../components/CrewBoard";
import { MiniMap } from "../components/MiniMap";
import { ServeToast } from "../components/ServeToast";
import { MatterportPanel } from "../components/MatterportPanel";
import { PhotonVoice } from "../components/PhotonVoice";
import { WebXRSession } from "../components/WebXRSession";
import { IntegrationsBadge } from "../components/IntegrationsBadge";
import { PlayCrosshair } from "../components/PlayCrosshair";
import type { CafeViewMode } from "../components/CafeScene";
import { play } from "../lib/audio";
import { startAmbient, stopAmbient } from "../lib/ambient";
import "./game.css";

export function Game() {
  const snapshot = useApp((s) => s.snapshot);
  const blueprint = useApp((s) => s.blueprint);
  const mobile = useApp((s) => s.mobile);
  const [tab, setTab] = useState<"build" | "ops" | "table" | "future" | "plan">("ops");
  const [viewMode, setViewMode] = useState<CafeViewMode>("monitor");
  const [userPickedView, setUserPickedView] = useState(false);
  const [railsOpen, setRailsOpen] = useState(true);

  useEffect(() => {
    if (userPickedView) return;
    if (snapshot?.phase === "play") {
      setViewMode(mobile ? "third" : "first");
      setRailsOpen(false);
    } else if (snapshot?.phase === "build") {
      setViewMode("monitor");
      setRailsOpen(true);
    }
  }, [snapshot?.phase, mobile, userPickedView]);

  useEffect(() => {
    if (!snapshot) return;
    if (snapshot.open && snapshot.phase === "play" && snapshot.eventLog[0]?.includes("Doors open")) {
      play("open");
    }
  }, [snapshot?.open]);

  useEffect(() => {
    if (snapshot?.open) void startAmbient();
    else stopAmbient();
    return () => stopAmbient();
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

  const immersive =
    snapshot.phase === "play" && (viewMode === "first" || viewMode === "third");

  const onViewChange = (m: CafeViewMode) => {
    setUserPickedView(true);
    setViewMode(m);
  };

  return (
    <main
      className={`game ${immersive ? "immersive" : ""} ${railsOpen ? "rails-open" : "rails-collapsed"}`}
    >
      <Hud snapshot={snapshot} live />
      {!immersive && <IntegrationsBadge />}
      <HelpOverlay />
      <div className="game-stage">
        <CafeCanvasFallback>
          <CafeScene snapshot={snapshot} viewMode={viewMode} />
        </CafeCanvasFallback>
        <ViewModeToggle mode={viewMode} onChange={onViewChange} />
        <PlayCrosshair snapshot={snapshot} mode={viewMode} />
        {viewMode !== "first" && <WebXRHint onOpenTable={() => setTab("table")} />}
        {viewMode !== "first" && <MiniMap snapshot={snapshot} />}
        <TutorialTips snapshot={snapshot} />
        <DirectorPanel snapshot={snapshot} />
        <PhotonCall snapshot={snapshot} />
        {viewMode !== "first" && <RolePicker snapshot={snapshot} />}
        <ServeToast snapshot={snapshot} />
        {snapshot.phase === "play" && (
          <>
            {viewMode !== "first" && <OrderRail snapshot={snapshot} />}
            <PlayControls snapshot={snapshot} />
          </>
        )}
        <button
          type="button"
          className="rails-fab btn-ghost"
          aria-expanded={railsOpen}
          aria-label={railsOpen ? "Hide side panel" : "Show side panel"}
          onClick={() => {
            play("ui", 0.2);
            setRailsOpen((v) => !v);
          }}
        >
          {railsOpen ? "Hide panel" : "Ops panel"}
        </button>
      </div>

      <div className="game-rails" aria-hidden={!railsOpen}>
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
                setRailsOpen(true);
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="rail-body">
          {tab === "build" && (
            <>
              <BuildPanel snapshot={snapshot} />
              {snapshot.property ? <MatterportPanel property={snapshot.property} /> : null}
            </>
          )}
          {tab === "ops" && (
            <>
              <PhotonChat snapshot={snapshot} />
              <PhotonVoice snapshot={snapshot} />
              <CrewBoard snapshot={snapshot} />
              <FinanceLedger snapshot={snapshot} />
              <InventoryCard snapshot={snapshot} />
              <EventLog lines={snapshot.eventLog} />
            </>
          )}
          {tab === "table" && (
            <>
              <Tabletop snapshot={snapshot} />
              <WebXRSession onEnterDollhouse={() => onViewChange("dollhouse")} />
            </>
          )}
          {tab === "future" && (
            <>
              <RivalCafePanel snapshot={snapshot} />
              <TimelineCompare snapshot={snapshot} />
            </>
          )}
          {tab === "plan" && (
            <>
              <SessionRecap snapshot={snapshot} />
              <BlueprintPanel markdown={blueprint} />
            </>
          )}
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
