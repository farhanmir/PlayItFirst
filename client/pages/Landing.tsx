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
      <div className="landing-atmosphere" aria-hidden>
        <div className="landing-glow landing-glow-a" />
        <div className="landing-glow landing-glow-b" />
        <div className="landing-wood-grain" />
        <div className="cafe-hero-visual">
          <div className="cafe-facade">
            <div className="facade-awning" />
            <div className="window-glow" />
            <div className="window-frame" />
            <div className="counter-block" />
            <div className="cup cup-a" />
            <div className="cup cup-b" />
            <div className="steam s1" />
            <div className="steam s2" />
            <div className="steam s3" />
          </div>
        </div>
      </div>

      <div className="landing-content">
        <div className="landing-copy">
          <p className="brand brand-reveal">PlayFirst</p>
          <h1 className="rise">Play your business before you pay for it.</h1>
          <p className="lede rise-delay">
            Build a café inside a real storefront, invite friends, and turn the session into a launch blueprint.
          </p>
          <div className="landing-cta rise-delay-2">
            <input
              className="name-input"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={24}
              aria-label="Your name"
            />
            <div className="mode-toggle" role="tablist" aria-label="Host or join">
              <button
                className={mode === "host" ? "active" : ""}
                onClick={() => setMode("host")}
                type="button"
                role="tab"
                aria-selected={mode === "host"}
              >
                Host café
              </button>
              <button
                className={mode === "join" ? "active" : ""}
                onClick={() => setMode("join")}
                type="button"
                role="tab"
                aria-selected={mode === "join"}
              >
                Join room
              </button>
            </div>
            {mode === "join" && (
              <input
                className="name-input"
                placeholder="Room code"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.trim())}
                aria-label="Room code"
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
      </div>
    </main>
  );
}
