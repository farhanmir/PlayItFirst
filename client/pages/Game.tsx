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
import { TimelineCompare } from "../components/TimelineCompare";
import { RivalCafePanel } from "../components/RivalCafePanel";
import { HelpOverlay } from "../components/HelpOverlay";
import { PhotonCall } from "../components/PhotonCall";
import { ViewModeToggle } from "../components/ViewModeToggle";
import { SessionRecap } from "../components/SessionRecap";
import { WebXRSession } from "../components/WebXRSession";
import { CrewBoard } from "../components/CrewBoard";
import { ServeToast } from "../components/ServeToast";
import { MatterportPanel } from "../components/MatterportPanel";
import { PhotonVoice } from "../components/PhotonVoice";
import { IntegrationsBadge } from "../components/IntegrationsBadge";
import { PlayCrosshair } from "../components/PlayCrosshair";
import type { CafeViewMode } from "../components/CafeScene";
import { play } from "../lib/audio";
import { startAmbient, stopAmbient } from "../lib/ambient";
import "./game.css";

type DrawerTab = "manage" | "build" | "table" | "future" | "plan";

export function Game() {
  const snapshot = useApp((s) => s.snapshot);
  const blueprint = useApp((s) => s.blueprint);
  const mobile = useApp((s) => s.mobile);
  const conn = useApp((s) => s.conn);
  const buildKind = useApp((s) => s.buildKind);
  const set = useApp((s) => s.set);

  // Third-person default keeps the whole café readable; first-person stays one click away.
  const [viewMode, setViewMode] = useState<CafeViewMode>("third");
  const [userPickedView, setUserPickedView] = useState(false);
  const [buildMode, setBuildMode] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>("manage");

  useEffect(() => {
    if (userPickedView || buildMode) return;
    setViewMode("third");
  }, [snapshot?.phase, mobile, userPickedView, buildMode]);

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "Tab") {
        e.preventDefault();
        setBuildMode((open) => {
          const next = !open;
          play("ui", 0.25);
          if (next) {
            setDrawerOpen(false);
            setDrawerTab("build");
            setViewMode("monitor");
            setUserPickedView(true);
            if (!useApp.getState().snapshot?.open) useApp.getState().conn?.send({ t: "set_phase", phase: "build" });
          } else {
            useApp.getState().set({ buildKind: null });
            setViewMode("third");
            if (useApp.getState().snapshot?.open) useApp.getState().conn?.send({ t: "set_phase", phase: "play" });
          }
          return next;
        });
      }
      if (e.key === "Escape") {
        setBuildMode((open) => {
          if (open) {
            useApp.getState().set({ buildKind: null });
            setViewMode("third");
            return false;
          }
          setDrawerOpen((drawer) => !drawer);
          return open;
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!snapshot?.property) {
    return (
      <main className="game-loading">
        <p className="brand-inline">SoftOpen</p>
        <p>Waiting for property selection…</p>
      </main>
    );
  }

  const playView = viewMode === "first" || viewMode === "third";

  const onViewChange = (mode: CafeViewMode) => {
    setUserPickedView(true);
    setViewMode(mode);
    if (mode === "first" || mode === "third") {
      setBuildMode(false);
      set({ buildKind: null });
    }
  };

  const enterBuild = () => {
    play("ui", 0.25);
    setBuildMode(true);
    setDrawerOpen(false);
    setDrawerTab("build");
    setViewMode("monitor");
    setUserPickedView(true);
    // Stay in play for others — only this client uses the editor camera.
    if (!snapshot.open) conn?.send({ t: "set_phase", phase: "build" });
  };

  const exitBuild = () => {
    play("ui", 0.2);
    setBuildMode(false);
    set({ buildKind: null });
    setViewMode("third");
    if (snapshot.open) conn?.send({ t: "set_phase", phase: "play" });
  };

  const toggleBuild = () => {
    if (buildMode) exitBuild();
    else enterBuild();
  };

  return (
    <main className={`game game-immersive ${buildMode ? "build-open" : ""} ${drawerOpen ? "drawer-open" : ""}`}>
      <div className="game-stage">
        <CafeCanvasFallback>
          <CafeScene snapshot={snapshot} viewMode={viewMode} buildMode={buildMode} />
        </CafeCanvasFallback>

        <Hud snapshot={snapshot} live compact />
        <PlayCrosshair snapshot={snapshot} mode={viewMode} />
        <ServeToast snapshot={snapshot} />
        <DirectorPanel snapshot={snapshot} />
        <PhotonCall snapshot={snapshot} />
        <HelpOverlay />

        {!buildMode && playView ? <OrderRail snapshot={snapshot} compact /> : null}
        {!buildMode && snapshot.phase === "play" ? <PlayControls snapshot={snapshot} immersive /> : null}

        <div className="game-chrome" role="toolbar" aria-label="Game chrome">
          <ViewModeToggle mode={viewMode} onChange={onViewChange} />
          <button type="button" className={`chrome-btn ${buildMode ? "active" : ""}`} onClick={toggleBuild}>
            {buildMode ? "Exit build" : "Build"}
            <kbd>Tab</kbd>
          </button>
          <button
            type="button"
            className={`chrome-btn ${drawerOpen ? "active" : ""}`}
            onClick={() => {
              play("ui", 0.2);
              setDrawerOpen((open) => !open);
            }}
          >
            {drawerOpen ? "Close" : "Menu"}
            <kbd>Esc</kbd>
          </button>
        </div>

        {buildMode ? (
          <>
            <div className="build-banner" role="status">
              <strong>Build mode</strong>
              <span>
                {buildKind ? "Click the floor to place · syncs live for everyone" : "Pick furniture · others keep serving"}
              </span>
            </div>
            <aside className="build-catalog" aria-label="Furniture catalog">
              <BuildPanel snapshot={snapshot} liveEdit />
            </aside>
          </>
        ) : null}
      </div>

      <aside className="game-drawer" aria-hidden={!drawerOpen}>
        <div className="drawer-tabs">
          {(
            [
              ["manage", "Manage"],
              ["build", "Build"],
              ["table", "Table"],
              ["future", "Future"],
              ["plan", "Plan"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={drawerTab === id ? "active" : ""}
              onClick={() => {
                play("ui", 0.2);
                setDrawerTab(id);
                if (id === "build") {
                  enterBuild();
                  return;
                }
                setBuildMode(false);
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="drawer-body">
          {drawerTab === "manage" && (
            <>
              <IntegrationsBadge />
              <PhotonChat snapshot={snapshot} />
              <PhotonVoice snapshot={snapshot} />
              <CrewBoard snapshot={snapshot} />
              <FinanceLedger snapshot={snapshot} />
              <InventoryCard snapshot={snapshot} />
              <EventLog lines={snapshot.eventLog} />
            </>
          )}
          {drawerTab === "build" && (
            <>
              <BuildPanel snapshot={snapshot} liveEdit={!snapshot.open || buildMode} />
              {snapshot.property ? <MatterportPanel property={snapshot.property} /> : null}
            </>
          )}
          {drawerTab === "table" && (
            <>
              <Tabletop snapshot={snapshot} />
              <WebXRSession onEnterDollhouse={() => onViewChange("dollhouse")} />
            </>
          )}
          {drawerTab === "future" && (
            <>
              <RivalCafePanel snapshot={snapshot} />
              <TimelineCompare snapshot={snapshot} />
            </>
          )}
          {drawerTab === "plan" && (
            <>
              <SessionRecap snapshot={snapshot} />
              <BlueprintPanel markdown={blueprint} />
            </>
          )}
        </div>
      </aside>
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
