import { useApp } from "../lib/store";

export function BlueprintPanel({ markdown }: { markdown: string | null }) {
  const conn = useApp((s) => s.conn);
  const set = useApp((s) => s.set);

  return (
    <aside className="side-panel panel blueprint-panel">
      <p className="tag">From game → real world</p>
      <h3>Business launch blueprint</h3>
      {!markdown ? (
        <>
          <p>Generate a personalized launch plan from the property, layout, finances, and scenarios you’ve played.</p>
          <button className="btn" type="button" onClick={() => conn?.send({ t: "request_blueprint" })}>
            Generate blueprint
          </button>
        </>
      ) : (
        <>
          <pre className="blueprint-md">{markdown}</pre>
          <div className="build-actions">
            <button
              className="btn"
              type="button"
              onClick={() => {
                const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "playitfirst-launch-blueprint.md";
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              Download .md
            </button>
            <button className="btn btn-ghost" type="button" onClick={() => set({ blueprint: null })}>
              Close
            </button>
          </div>
        </>
      )}
    </aside>
  );
}
