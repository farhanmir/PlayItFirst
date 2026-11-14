import { useState } from "react";
import "./landing.css";

interface Props {
  onStart: (name: string) => void | Promise<void>;
  onJoin: (code: string, name: string) => void;
  onJudgeDemo: () => void | Promise<void>;
  demoBusy?: boolean;
}

export function Landing({ onStart, onJoin, onJudgeDemo, demoBusy }: Props) {
  const [name, setName] = useState(localStorage.getItem("playfirst.name") || "");
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"host" | "join">("host");
  const locked = busy || !!demoBusy;

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
              disabled={locked}
            />
            <div className="mode-toggle" role="tablist" aria-label="Host or join">
              <button
                className={mode === "host" ? "active" : ""}
                onClick={() => setMode("host")}
                type="button"
                role="tab"
                aria-selected={mode === "host"}
                disabled={locked}
              >
                Host café
              </button>
              <button
                className={mode === "join" ? "active" : ""}
                onClick={() => setMode("join")}
                type="button"
                role="tab"
                aria-selected={mode === "join"}
                disabled={locked}
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
                disabled={locked}
              />
            )}
            <button
              className="btn"
              type="button"
              disabled={!name.trim() || locked || (mode === "join" && !joinCode)}
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
            <button
              className="btn btn-ghost judge-demo-btn"
              type="button"
              disabled={locked}
              onClick={() => void onJudgeDemo()}
            >
              {demoBusy ? "Starting demo…" : "Judge demo"}
            </button>
            <p className="demo-hint">
              One-click Midtown host — or open <code>/?demo=1</code>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
