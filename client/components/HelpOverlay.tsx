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
            <h3>SoftOpen shortcuts</h3>
            <ul>
              <li>
                Click canvas · mouse look (1st / 3rd)
              </li>
              <li>
                <kbd>W</kbd>
                <kbd>A</kbd>
                <kbd>S</kbd>
                <kbd>D</kbd> Move (relative to look)
              </li>
              <li>
                <kbd>Space</kbd> Suggested next action
              </li>
              <li>
                <kbd>E</kbd> Take order · <kbd>F</kbd> Brew · <kbd>R</kbd> Serve · <kbd>Q</kbd> Restock
              </li>
              <li>Camera: 1st Person · 3rd Person · Monitor · Dollhouse</li>
              <li>
                <kbd>?</kbd> Toggle this help
              </li>
            </ul>
            <p className="fine">Phones default to 3rd person — drag the pad to move, swipe the café to look.</p>
            <button type="button" className="btn" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
