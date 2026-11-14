import { useEffect } from "react";
import { useApp } from "./lib/store";
import { connect } from "./lib/net";
import { Landing } from "./pages/Landing";
import { PropertySelect } from "./pages/PropertySelect";
import { Game } from "./pages/Game";
import type { PlayerRole, PropertyListing } from "../shared/types";
import { unlockAudio, play } from "./lib/audio";

export function App() {
  const screen = useApp((s) => s.screen);
  const set = useApp((s) => s.set);

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

  return (
    <div className="app-shell">
      <div className="grain" aria-hidden />
      {screen === "landing" && <Landing onStart={startHost} onJoin={joinRoom} />}
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
