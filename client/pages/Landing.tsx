import { useState } from "react";
import "./landing.css";

interface Props {
  onStart: (name: string) => void | Promise<void>;
  onJoin: (code: string, name: string) => void;
}

export function Landing({ onStart, onJoin }: Props) {
  const [name, setName] = useState(localStorage.getItem("playfirst.name") || "");
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"host" | "join">("host");

  return (
    <main className="landing">
      <div className="landing-hero">
        <div className="landing-copy rise">
          <p className="brand">PlayFirst</p>
          <h1>Play your business before you pay for it.</h1>
          <p className="lede">
            Build a café inside a real commercial property, invite friends, serve intelligent customers, and turn gameplay
            into a launch blueprint.
          </p>
          <div className="landing-cta rise-delay">
            <input
              className="name-input"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={24}
            />
            <div className="mode-toggle">
              <button className={mode === "host" ? "active" : ""} onClick={() => setMode("host")} type="button">
                Host café
              </button>
              <button className={mode === "join" ? "active" : ""} onClick={() => setMode("join")} type="button">
                Join room
              </button>
            </div>
            {mode === "join" && (
              <input
                className="name-input"
                placeholder="Room code"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.trim())}
              />
            )}
            <button
              className="btn"
              type="button"
              disabled={!name.trim() || busy || (mode === "join" && !joinCode)}
              onClick={async () => {
                setBusy(true);
                try {
                  if (mode === "host") await onStart(name.trim());
                  else onJoin(joinCode.toLowerCase(), name.trim());
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Opening…" : mode === "host" ? "Choose a property" : "Enter café"}
            </button>
          </div>
        </div>

        <div className="landing-visual rise-delay-2" aria-hidden>
          <div className="cafe-silhouette">
            <div className="window-glow" />
            <div className="steam s1" />
            <div className="steam s2" />
            <div className="steam s3" />
            <div className="counter-block" />
            <div className="cup cup-a" />
            <div className="cup cup-b" />
          </div>
          <p className="visual-caption">Houston · Los Angeles · real storefront constraints</p>
        </div>
      </div>
    </main>
  );
}
