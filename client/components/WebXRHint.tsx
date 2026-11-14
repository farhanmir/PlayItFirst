import { useEffect, useState } from "react";

/** Lightweight Vision Pro / WebXR affordance — detects immersive VR support. */
export function WebXRHint({ onOpenTable }: { onOpenTable?: () => void }) {
  const [supported, setSupported] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const xr = navigator.xr;
    if (!xr?.isSessionSupported) return;
    void xr
      .isSessionSupported("immersive-vr")
      .then((ok) => setSupported(!!ok))
      .catch(() => undefined);
  }, []);

  if (!supported || dismissed) return null;

  return (
    <div className="xr-hint panel">
      <p className="tag">Vision Pro ready</p>
      <p>WebXR detected — open the Table tab to enter VR/AR or use dollhouse for the tabletop wow.</p>
      <div className="xr-hint-actions">
        {onOpenTable ? (
          <button
            type="button"
            className="btn btn-small"
            onClick={() => {
              onOpenTable();
              setDismissed(true);
            }}
          >
            Open Table / XR
          </button>
        ) : null}
        <button type="button" className="btn btn-ghost btn-small" onClick={() => setDismissed(true)}>
          Got it
        </button>
      </div>
    </div>
  );
}
