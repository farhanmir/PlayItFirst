import { useEffect, useState } from "react";

/** Lightweight Vision Pro / WebXR affordance — detects immersive VR support. */
export function WebXRHint() {
  const [supported, setSupported] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const xr = (navigator as Navigator & { xr?: { isSessionSupported?: (m: string) => Promise<boolean> } }).xr;
    if (!xr?.isSessionSupported) return;
    void xr.isSessionSupported("immersive-vr").then((ok) => setSupported(!!ok)).catch(() => undefined);
  }, []);

  if (!supported || dismissed) return null;

  return (
    <div className="xr-hint panel">
      <p className="tag">Vision Pro ready</p>
      <p>WebXR detected — tabletop dollhouse mode is the headset-friendly view for this demo.</p>
      <button type="button" className="btn btn-ghost btn-small" onClick={() => setDismissed(true)}>
        Got it
      </button>
    </div>
  );
}
