import { useState } from "react";
import { InstallGame } from "../components/InstallGame";
import { getStoredName } from "../lib/storage";
import "./landing.css";

interface Props {
  onStart: (name: string) => void | Promise<void>;
  onJoin: (code: string, name: string) => void;
  onJudgeDemo: () => void | Promise<void>;
  demoBusy?: boolean;
}

export function Landing({ onStart, onJoin, onJudgeDemo, demoBusy }: Props) {
  const [name, setName] = useState(getStoredName());
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"host" | "join" | null>(null);
  const locked = busy || !!demoBusy;
  return (
    <main className="landing">
      <section className="landing-menu" aria-labelledby="game-title">
        <div className="landing-wordmark" aria-hidden="true"><svg className="wordmark-cup" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 9h12v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9Z"/><path d="M16 10h2a3 3 0 0 1 0 6h-2M3 22h15M8 3v3m5-3v3" strokeLinecap="round"/></svg> A café of your own</div>
        <h1 id="game-title">Play It<br />First<span className="title-period">.</span></h1>
        <p className="landing-tagline">Your grand opening starts here.</p>
        <p className="landing-description">Pick a space. Pour the first cup. Run a café with friends, and discover what makes a business work.</p>
        <div className="landing-actions">
          <button className="landing-play" type="button" disabled={locked} onClick={() => void onJudgeDemo()}>
            <span>{demoBusy ? "Opening the café…" : "Play demo"}</span><span aria-hidden="true">▶</span>
          </button>
          <p className="landing-demo-note">Jump into a fresh café. No setup needed.</p>
          <div className="landing-secondary" aria-label="Multiplayer options">
            <button type="button" aria-expanded={mode === "host"} aria-controls="landing-room-form" disabled={locked} onClick={() => setMode(mode === "host" ? null : "host")}>Host a café</button>
            <button type="button" aria-expanded={mode === "join"} aria-controls="landing-room-form" disabled={locked} onClick={() => setMode(mode === "join" ? null : "join")}>Join friends</button>
          </div>
          {mode && <form id="landing-room-form" className="landing-room-form" onSubmit={async (event) => {
            event.preventDefault();
            if (!name.trim() || locked || (mode === "join" && !joinCode.trim())) return;
            setBusy(true);
            try { if (mode === "host") await onStart(name.trim()); else onJoin(joinCode.trim().toLowerCase(), name.trim()); }
            finally { setBusy(false); }
          }}>
            <label>Your name<input autoComplete="nickname" maxLength={24} value={name} onChange={(e) => setName(e.target.value)} disabled={locked} required /></label>
            {mode === "join" && <label>Room code<input value={joinCode} onChange={(e) => setJoinCode(e.target.value.trim())} autoCapitalize="none" autoCorrect="off" spellCheck={false} disabled={locked} required /></label>}
            <button className="landing-form-submit" type="submit" disabled={locked || !name.trim() || (mode === "join" && !joinCode.trim())}>{busy ? "Opening…" : mode === "host" ? "Choose a property" : "Enter café"}</button>
          </form>}
        </div>
        <div className="landing-install"><InstallGame /></div>
        <footer className="landing-footer"><span>Build. Brew. Make it work.</span><span>Keyboard & touch</span></footer>
      </section>
      <figure className="landing-scene">
        <img src="/assets/cafe-preview.png" alt="In-game café with the service counter, espresso equipment and customers" width="1200" height="800" fetchPriority="high" />
        <figcaption><span className="preview-dot" aria-hidden="true" /> Actual gameplay · demo café</figcaption>
        <div className="landing-scene-title" aria-hidden="true"><span>One space.</span><span>Endless possibilities.</span></div>
      </figure>
    </main>
  );
}
