import { useEffect, useState } from "react";

export function HelpOverlay() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "?" || (e.key === "/" && e.shiftKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <button type="button" className="help-fab btn-ghost btn-small" onClick={() => setOpen(true)} title="Keyboard help">
        Help
      </button>
      {open && (
        <div className="help-modal" role="dialog" aria-modal="true" onClick={() => setOpen(false)}>
          <div className="help-card panel" onClick={(e) => e.stopPropagation()}>
            <p className="tag">Controls</p>
            <h3>PlayFirst shortcuts</h3>
            <ul>
              <li>
                <kbd>W</kbd>
                <kbd>A</kbd>
                <kbd>S</kbd>
                <kbd>D</kbd> Move
              </li>
              <li>
                <kbd>E</kbd> Take order
              </li>
              <li>
                <kbd>F</kbd> Make coffee
              </li>
              <li>
                <kbd>R</kbd> Serve
              </li>
              <li>
                <kbd>Q</kbd> Restock
              </li>
              <li>
                <kbd>?</kbd> Toggle this help
              </li>
            </ul>
            <p className="fine">Phones: use the on-screen pad + action buttons. Scan the HUD QR to join co-op.</p>
            <button type="button" className="btn" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
