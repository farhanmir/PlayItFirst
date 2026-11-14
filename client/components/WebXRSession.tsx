/**
 * Vision Pro / headset immersive path via WebXR + @react-three/xr store.
 * Starts immersive-vr (or immersive-ar) when the browser/headset supports it.
 */
import { useEffect, useState } from "react";
import { play } from "../lib/audio";

type XrMode = "immersive-vr" | "immersive-ar";

export function WebXRSession({ onEnterDollhouse }: { onEnterDollhouse?: () => void }) {
  const [vr, setVr] = useState(false);
  const [ar, setAr] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    const xr = navigator.xr;
    if (!xr?.isSessionSupported) return;
    void xr.isSessionSupported("immersive-vr").then(setVr).catch(() => undefined);
    void xr.isSessionSupported("immersive-ar").then(setAr).catch(() => undefined);
  }, []);

  const start = async (mode: XrMode) => {
    setBusy(true);
    setNote(null);
    try {
      const xr = navigator.xr;
      if (!xr) throw new Error("WebXR unavailable");
      // Prefer requesting the session so Vision Pro / Quest get a real immersive entry.
      // R3F scene already renders; browsers composite WebGL layers for the headset.
      const session = await xr.requestSession(mode, {
        optionalFeatures: ["local-floor", "bounded-floor", "hand-tracking", "layers"],
      });
      play("open", 0.35);
      onEnterDollhouse?.();
      setNote(`${mode} session live — use headset controllers / hands. Exit via headset home.`);
      session.addEventListener("end", () => setNote("XR session ended"));
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Could not start XR");
      onEnterDollhouse?.();
    } finally {
      setBusy(false);
    }
  };

  if (!vr && !ar) {
    return (
      <aside className="side-panel panel xr-session">
        <p className="tag">Vision Pro / WebXR</p>
        <h3>Headset path</h3>
        <p>No immersive session API here — dollhouse camera is the fallback for tabletop demos.</p>
        <button type="button" className="btn btn-ghost" onClick={() => onEnterDollhouse?.()}>
          Switch to dollhouse view
        </button>
      </aside>
    );
  }

  return (
    <aside className="side-panel panel xr-session">
      <p className="tag">Vision Pro / WebXR</p>
      <h3>Enter immersive café</h3>
      <p>Detected headset-capable WebXR. Launch VR or AR, or stay in dollhouse for the tabletop wow.</p>
      <div className="xr-actions">
        {vr ? (
          <button type="button" className="btn" disabled={busy} onClick={() => void start("immersive-vr")}>
            Enter VR
          </button>
        ) : null}
        {ar ? (
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => void start("immersive-ar")}>
            Enter AR
          </button>
        ) : null}
        <button type="button" className="btn btn-ghost" onClick={() => onEnterDollhouse?.()}>
          Dollhouse
        </button>
      </div>
      {note ? (
        <p className="muted" role="status">
          {note}
        </p>
      ) : null}
    </aside>
  );
}
