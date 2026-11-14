import { FURNITURE_CATALOG, type FurnitureKind, type RoomSnapshot } from "../../shared/types";
import { useApp } from "../lib/store";
import { play } from "../lib/audio";

export function BuildPanel({
  snapshot,
  liveEdit = false,
}: {
  snapshot: RoomSnapshot;
  liveEdit?: boolean;
}) {
  const conn = useApp((s) => s.conn);
  const buildKind = useApp((s) => s.buildKind);
  const set = useApp((s) => s.set);
  const property = snapshot.property;

  const select = (kind: FurnitureKind) => {
    play("ui", 0.2);
    set({ buildKind: buildKind === kind ? null : kind });
  };

  const quickDrop = (kind: FurnitureKind) => {
    if (!property) return;
    const x = 2 + Math.random() * Math.max(2, property.width - 4);
    const z = 2 + Math.random() * Math.max(2, property.depth - 4);
    conn?.send({ t: "place_furniture", kind, x, z });
    play("place");
  };

  return (
    <aside className="side-panel panel build-panel">
      <h3>{liveEdit ? "Sims build catalog" : "Build mode"}</h3>
      <p>
        Select an item, then <strong>click the café floor</strong> to place it.
        {liveEdit ? " Service keeps running for everyone else." : " Layout changes hit everyone in the room live."}
      </p>
      {buildKind ? (
        <p className="build-place-hint" aria-live="polite">
          Placing <strong>{FURNITURE_CATALOG.find((c) => c.kind === buildKind)?.label ?? buildKind}</strong> — click the floor
          <button type="button" className="btn-ghost btn-small" onClick={() => set({ buildKind: null })}>
            Cancel
          </button>
        </p>
      ) : (
        <p className="build-place-hint muted">Pick from the catalog to start placing.</p>
      )}
      <div className="catalog">
        {FURNITURE_CATALOG.map((item) => (
          <div key={item.kind} className={`catalog-row ${buildKind === item.kind ? "selected" : ""}`}>
            <button className="catalog-item" type="button" onClick={() => select(item.kind)}>
              <div>
                <strong>{item.label}</strong>
                <span>{item.description}</span>
              </div>
              <em>${item.cost}</em>
            </button>
            <button
              type="button"
              className="btn-ghost btn-small catalog-quick"
              title="Drop at a random valid spot"
              onClick={() => quickDrop(item.kind)}
            >
              Quick
            </button>
          </div>
        ))}
      </div>
      <div className="build-actions">
        <button
          className="btn"
          type="button"
          onClick={() => {
            play("open");
            set({ buildKind: null });
            conn?.send({ t: "open_cafe" });
          }}
        >
          Open for business
        </button>
        <button
          className="btn btn-ghost"
          type="button"
          onClick={() => {
            set({ buildKind: null });
            conn?.send({ t: "set_phase", phase: "play" });
          }}
        >
          Preview play camera
        </button>
      </div>
      {snapshot.layout && (
        <ul className="placed-list">
          {snapshot.layout.furniture.map((f) => (
            <li key={f.id}>
              <span>
                {f.label} ({f.x.toFixed(1)}, {f.z.toFixed(1)})
              </span>
              <button type="button" className="btn-ghost btn-small" onClick={() => conn?.send({ t: "remove_furniture", id: f.id })}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
