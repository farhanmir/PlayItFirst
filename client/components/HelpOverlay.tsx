import { useEffect, useRef } from "react";

export function HelpOverlay() {
  const dialog = useRef<HTMLDialogElement>(null);
  const openHelp = () => {
    if (document.pointerLockElement) document.exitPointerLock();
    dialog.current?.showModal();
  };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && event.target.closest("input, textarea, select, [contenteditable=true]")) return;
      if (event.key === "?" && !dialog.current?.open) {
        event.preventDefault();
        openHelp();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return <>
    <button type="button" className="help-fab btn-ghost btn-small" onClick={openHelp} title="Controls and first shift">Help</button>
    <dialog ref={dialog} className="help-dialog" aria-labelledby="shift-help-title">
      <p className="tag">How to play</p>
      <h2 id="shift-help-title">Your first shift</h2>
      <ol className="shift-steps">
        <li><strong>Take an order</strong><span>Walk to the counter and use the action button.</span></li>
        <li><strong>Make the drink</strong><span>Go to the espresso machine. Start brewing and wait for your cup.</span></li>
        <li><strong>Serve your guest</strong><span>Carry the drink to pickup. Serve it to complete the sale.</span></li>
      </ol>
      <div className="help-inputs"><p><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> Move · drag the café to look</p>
        <p><kbd>E</kbd> / <kbd>Space</kbd> Nearby action</p><p><kbd>Tab</kbd> Build · <kbd>Esc</kbd> Menu</p>
        <p>On your phone, hold the movement pad and drag the café with your other thumb to look.</p></div>
      <form method="dialog"><button autoFocus className="btn" value="close">Back to the café</button></form>
    </dialog>
  </>;
}
