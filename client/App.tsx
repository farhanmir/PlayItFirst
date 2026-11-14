import { useEffect, useRef, useState } from "react";
import { useApp } from "./lib/store";
import { connect } from "./lib/net";
import { Landing } from "./pages/Landing";
import { PropertySelect } from "./pages/PropertySelect";
import { Game } from "./pages/Game";
import { DemoOverlay } from "./components/DemoOverlay";
import type { PlayerRole, PropertyListing } from "../shared/types";
import { unlockAudio, play } from "./lib/audio";
import {
  DEMO_PLAYER_NAME,
  DEMO_PROPERTY_ID,
  demoStatusFor,
  isDemoQuery,
  sleep,
  type DemoPhase,
} from "./lib/demo";

export function App() {
  const screen = useApp((s) => s.screen);
  const set = useApp((s) => s.set);
  const [demoPhase, setDemoPhase] = useState<DemoPhase>("idle");
  const demoStarted = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const room = params.get("room");
    if (room) {
      const savedName = localStorage.getItem("playfirst.name") || `Guest ${Math.floor(Math.random() * 90 + 10)}`;
      joinRoom(room, savedName, true);
    }

    void fetch("/api/properties")
      .then((r) => r.json())
      .then((properties: PropertyListing[]) => set({ properties }))
      .catch(() => undefined);
  }, [set]);

  useEffect(() => {
    if (demoStarted.current) return;
    if (!isDemoQuery()) return;
    const params = new URLSearchParams(location.search);
    if (params.get("room")) return;
    demoStarted.current = true;
    void runJudgeDemo(setDemoPhase);
  }, []);

  return (
    <div className="app-shell">
      <div className="grain" aria-hidden />
      <DemoOverlay status={demoStatusFor(demoPhase)} />
      {screen === "landing" && (
        <Landing
          onStart={async (name) => {
            await startHost(name);
          }}
          onJoin={joinRoom}
          demoBusy={demoPhase !== "idle" && demoPhase !== "ready" && demoPhase !== "error"}
          onJudgeDemo={async () => {
            if (demoStarted.current && demoPhase !== "idle" && demoPhase !== "error" && demoPhase !== "ready") {
              return;
            }
            demoStarted.current = true;
            history.replaceState({}, "", "/?demo=1");
            await runJudgeDemo(setDemoPhase);
          }}
        />
      )}
      {screen === "property" && <PropertySelect />}
      {screen === "game" && <Game />}
    </div>
  );
}

async function startHost(name: string) {
  await unlockAudio();
  play("ui");
  const set = useApp.getState().set;
  localStorage.setItem("playfirst.name", name);
  const res = await fetch("/api/rooms", { method: "POST" });
  const data = (await res.json()) as { code: string; url: string; qrSvg: string };
  set({
    name,
    roomCode: data.code,
    qrSvg: data.qrSvg,
    joinUrl: data.url,
    screen: "property",
  });
  wireConnection(data.code, name, "owner");
  history.replaceState({}, "", `/?room=${data.code}`);
  return data.code;
}

function joinRoom(code: string, name: string, fromLink = false) {
  void unlockAudio();
  const set = useApp.getState().set;
  localStorage.setItem("playfirst.name", name);
  set({
    name,
    roomCode: code,
    screen: fromLink ? "game" : "property",
  });
  wireConnection(code, name, fromLink ? "barista" : "owner");
  history.replaceState({}, "", `/?room=${code}`);
}

async function runJudgeDemo(setPhase: (p: DemoPhase) => void) {
  try {
    setPhase("hosting");
    await unlockAudio();
    play("ui");
    const code = await startHost(DEMO_PLAYER_NAME);
    setPhase("selecting");
    await sleep(700);

    // Wait briefly for WS welcome so select_property lands
    for (let i = 0; i < 40; i++) {
      const { conn, status } = useApp.getState();
      if (conn && status === "open") break;
      await sleep(50);
    }

    const conn = useApp.getState().conn;
    conn?.send({ t: "select_property", propertyId: DEMO_PROPERTY_ID });
    useApp.getState().set({ screen: "game" });
    setPhase("entering");
    await sleep(1100);

    setPhase("opening");
    await sleep(900);
    useApp.getState().conn?.send({ t: "open_cafe" });
    play("open", 0.45);
    setPhase("ready");
    history.replaceState({}, "", `/?room=${code}&demo=1`);
    await sleep(1600);
    setPhase("idle");
  } catch (err) {
    console.warn(err);
    setPhase("error");
  }
}

function wireConnection(room: string, name: string, role: PlayerRole) {
  const prev = useApp.getState().conn;
  prev?.close();
  const conn = connect(room, name, role);
  const set = useApp.getState().set;
  set({ conn, status: "connecting" });

  conn.onStatus((status) => set({ status }));
  conn.onMessage((m) => {
    if (m.t === "welcome") {
      set({
        you: m.you,
        snapshot: m.snapshot,
        screen: m.snapshot.property ? "game" : useApp.getState().screen === "landing" ? "property" : useApp.getState().screen,
      });
      void fetch(`/api/rooms/${room}/qr`)
        .then((r) => r.json())
        .then((data: { qrSvg: string; url: string }) => set({ qrSvg: data.qrSvg, joinUrl: data.url }))
        .catch(() => undefined);
    }
    if (m.t === "snapshot") set({ snapshot: m.snapshot });
    if (m.t === "blueprint") set({ blueprint: m.markdown, screen: "game" });
    if (m.t === "error") console.warn(m.message);
  });
}
