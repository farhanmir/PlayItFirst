import type { DemoStatus } from "../lib/demo";

export function DemoOverlay({ status }: { status: DemoStatus | null }) {
  if (!status || status.phase === "idle" || status.phase === "ready") return null;

  return (
    <div className="demo-overlay" role="status" aria-live="polite">
      <div className="demo-card panel">
        <p className="brand-inline">Play It First</p>
        <p className="demo-kicker">Judge demo</p>
        <h2>{status.message}</h2>
        <div className="demo-pulse" aria-hidden />
      </div>
    </div>
  );
}
