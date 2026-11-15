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
  demoPropertyId as pickDemoProperty,
  demoStatusFor,
  isDemoQuery,
  sleep,
  type DemoPhase,
} from "./lib/demo";
import { apiUrl, publicOrigin } from "./lib/api";
import { getStoredName, setStoredName } from "./lib/storage";

export function App() {
  const screen = useApp((s) => s.screen);
  const connectionError = useApp((s) => s.connectionError);
  const set = useApp((s) => s.set);
  const [demoPhase, setDemoPhase] = useState<DemoPhase>("idle");
  const demoStarted = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const room = params.get("room");
    if (room) {
      const savedName = getStoredName() || `Guest ${Math.floor(Math.random() * 90 + 10)}`;
      joinRoom(room, savedName, true);
    }

    void fetch(apiUrl("/api/properties"))
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
          connectionError={connectionError}
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
      {screen !== "landing" && connectionError && <p role="alert" className="connection-error" style={{ position: "fixed", top: "5rem", left: "50%", transform: "translateX(-50%)", zIndex: 100, background: "#fff5df", color: "#40261b", padding: "0.75rem 1rem", borderRadius: 8, maxWidth: "min(90vw, 40rem)" }}>{connectionError}</p>}
      {screen === "property" && <PropertySelect />}
      {screen === "game" && <Game />}
    </div>
  );
}

async function startHost(name: string, judgeDemo = false) {
  void unlockAudio().catch(() => undefined);
  play("ui");
  const set = useApp.getState().set;
  setStoredName(name);
  const res = await fetch(apiUrl("/api/rooms"), {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-SoftOpen-Public-Origin": publicOrigin() },
    body: JSON.stringify({ publicOrigin: publicOrigin(), judgeDemo }),
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error("Could not open a café. Please try again.");
  const data = (await res.json()) as { code: string; url: string; qrSvg: string };
  if (typeof data.code !== "string" || !data.code.trim()) {
    throw new Error("The café did not open. Please try again.");
  }
  const joinUrl = data.url?.startsWith("http") ? data.url : `${publicOrigin()}/?room=${data.code}`;
  set({
    name,
    roomCode: data.code,
    qrSvg: data.qrSvg,
    joinUrl,
    screen: "property",
  });
  wireConnection(data.code, name, "owner");
  history.replaceState({}, "", `/?room=${data.code}`);
  return data.code;
}

function joinRoom(code: string, name: string, fromLink = false) {
  void unlockAudio().catch(() => undefined);
  const set = useApp.getState().set;
  setStoredName(name);
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
    void unlockAudio().catch(() => undefined);
    play("ui");
    const practice = new URLSearchParams(location.search).get("practice") === "1";
    const code = await startHost(DEMO_PLAYER_NAME, true);
    setPhase("selecting");
    const catalog = await fetch(apiUrl("/api/properties"), { signal: AbortSignal.timeout(12000) });
    if (!catalog.ok) throw new Error("Property catalog unavailable");
    const properties = await catalog.json() as PropertyListing[];
    if (!Array.isArray(properties) || !properties.length) throw new Error("Property catalog is empty");
    useApp.getState().set({ properties });

    // Wait for WS welcome so select_property lands
    for (let i = 0; i < 60; i++) {
      const { conn, status } = useApp.getState();
      if (conn && status === "open") break;
      await sleep(50);
    }

    const conn = useApp.getState().conn;
    if (!conn) throw new Error("No connection for judge demo");
    const demoPropertyId = pickDemoProperty(properties, practice);
    conn.send({ t: "select_property", propertyId: demoPropertyId });
    useApp.getState().set({ screen: "game" });
    setPhase("entering");

    for (let i = 0; i < 50; i++) {
      if (useApp.getState().snapshot?.property?.id === demoPropertyId) break;
      await sleep(80);
    }
    if (useApp.getState().snapshot?.property?.id !== demoPropertyId) {
      throw new Error("Property select timed out");
    }
    await sleep(600);

    setPhase("opening");
    conn.send({ t: "open_cafe" });
    play("open", 0.45);

    for (let i = 0; i < 40; i++) {
      if (useApp.getState().snapshot?.open) break;
      await sleep(50);
    }

    if (!useApp.getState().snapshot?.open) throw new Error("Café did not open");
    // Guided rooms seed a customer on the server; Jamie can serve while a visitor watches.

    setPhase("ready");
    history.replaceState({}, "", `/?room=${code}&demo=1${practice ? "&practice=1" : ""}`);
    await sleep(1200);
    setPhase("idle");
  } catch (err) {
    console.warn(err);
    useApp.getState().conn?.close();
    useApp.getState().set({ conn: null, snapshot: null, you: null, screen: "landing", status: "closed", connectionError: "The demo could not open. Please try Play demo again or host a café." });
    history.replaceState({}, "", "/");
    setPhase("error");
  }
}

function wireConnection(room: string, name: string, role: PlayerRole) {
  const prev = useApp.getState().conn;
  prev?.close();
  const conn = connect(room, name, role);
  const set = useApp.getState().set;
  set({ photonPairing: null, photonPairError: null, conn, status: "connecting", connectionError: null, snapshot: null, you: null, blueprint: null });

  conn.onStatus((status) => { if (useApp.getState().conn === conn) set({ status }); });
  conn.onMessage((m) => {
    if (useApp.getState().conn !== conn) return;
    if (m.t === "welcome") {
      set({
        connectionError: null,
        you: m.you,
        snapshot: m.snapshot,
        screen: m.snapshot.property ? "game" : useApp.getState().screen === "landing" ? "property" : useApp.getState().screen,
      });
      void fetch(apiUrl(`/api/rooms/${room}/qr`), {
        headers: { "X-SoftOpen-Public-Origin": publicOrigin() },
      })
        .then((r) => r.json())
        .then((data: { qrSvg: string; url: string }) => {
          if (useApp.getState().conn !== conn) return;
          set({
            qrSvg: data.qrSvg,
            joinUrl: data.url?.startsWith("http") ? data.url : `${publicOrigin()}/?room=${room}`,
          });
        })
        .catch(() => undefined);
    }
    if (m.t === "snapshot") set({ snapshot: m.snapshot });
    if (m.t === "photon_pairing") set({ photonPairing: { pairing: m.pairing, status: m.status }, photonPairError: null });
    if (m.t === "photon_pair_error") set({ photonPairError: m.message });
    if (m.t === "manager_error") set({ managerError: m.message });
    if (m.t === "blueprint") set({ blueprint: m.markdown, screen: "game" });
    if (m.t === "error") {
      if (m.terminal) {
        conn.close();
        set({ conn: null, status: "closed", screen: "landing", snapshot: null, you: null,
          roomCode: "", qrSvg: null, joinUrl: null, blueprint: null, buildKind: null, buildMovingId: null,
          connectionError: m.code === "ROOM_NOT_FOUND"
            ? "This café does not exist or has expired. Host a new café, or ask your friend for a fresh invite."
            : m.code === "SESSION_REPLACED"
              ? "This café session is active in another tab. Continue there, or join again here."
              : `${m.message} Try a fresh invite or host a new café.` });
        history.replaceState({}, "", "/");
      } else set({ connectionError: m.message });
    }
  });
}
