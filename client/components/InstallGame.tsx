import { useEffect, useState } from "react";
import "../styles/install-game.css";

type InstallPrompt = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};
type InstallNavigator = Navigator & { install?: () => Promise<unknown>; standalone?: boolean };

/** Optional installation, never a gate to playing or joining a room. */
export function InstallGame() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [standalone, setStandalone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const nativeInstall = typeof (navigator as InstallNavigator).install === "function";
  useEffect(() => {
    const media = window.matchMedia("(display-mode: standalone)");
    const update = () => setStandalone(media.matches || !!(navigator as InstallNavigator).standalone);
    const capture = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPrompt); };
    const installed = () => { setPrompt(null); setStandalone(true); };
    update();
    media.addEventListener("change", update);
    window.addEventListener("beforeinstallprompt", capture);
    window.addEventListener("appinstalled", installed);
    return () => {
      media.removeEventListener("change", update);
      window.removeEventListener("beforeinstallprompt", capture);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);
  if (standalone) return null;
  const install = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (nativeInstall) {
        await (navigator as InstallNavigator).install!();
        setStatus("Game installed or opened.");
      } else if (prompt) {
        const pending = prompt;
        setPrompt(null);
        await pending.prompt();
        const result = await pending.userChoice;
        setStatus(result.outcome === "accepted" ? "Game installed. Open it from your home screen." : "Installation canceled. You can keep playing here.");
      }
    } catch {
      setStatus("Installation did not complete. You can keep playing in this browser.");
    } finally { setBusy(false); }
  };
  return <div className="install-game">
    {(nativeInstall || prompt) && <button className="install-game__button" type="button" aria-disabled={busy} onClick={() => void install()}>Install game</button>}
    <details>
      <summary>Play from your home screen</summary>
      <p>Launch without browser tabs for more room to play. Internet is still required.</p>
      <p><strong>iPhone / iPad:</strong> Open in Safari, tap Share, then Add to Home Screen. Enable Open as Web App if shown.</p>
      <p><strong>Android / desktop:</strong> Use Install game when available, or your browser menu’s Install app / Add to Home screen option.</p>
      <p>To join a friend, open their room link or enter the room code in the installed game.</p>
    </details>
    {status && <p role="status">{status}</p>}
  </div>;
}
