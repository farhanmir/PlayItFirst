import { FURNITURE_CATALOG, type FurnitureKind, type RoomSnapshot } from "../../shared/types";
import { useApp } from "../lib/store";
import { play } from "../lib/audio";
import { removalIssue } from "../../shared/placement";
import { CustomerFeedback } from "./CustomerFeedback";

export function BuildPanel({
  snapshot,
  liveEdit = false,
}: {
  snapshot: RoomSnapshot;
  liveEdit?: boolean;
}) {
  const conn = useApp((s) => s.conn);
  const buildKind = useApp((s) => s.buildKind);
  const buildRotation = useApp((s) => s.buildRotation);
  const buildMovingId = useApp((s) => s.buildMovingId);
  const buildSelectedId = useApp((s) => s.buildSelectedId);
  const set = useApp((s) => s.set);
  const property = snapshot.property;
  const selected = buildSelectedId ? snapshot.layout?.furniture.find((f) => f.id === buildSelectedId) : undefined;
  const blockedReason = (id: string) => removalIssue(snapshot.layout?.furniture ?? [], id);
  const selectedBlocked = selected ? blockedReason(selected.id) : null;

  const deleteItem = (id: string) => {
    conn?.send({ t: "remove_furniture", id });
    play("ui", 0.25);
    set({ buildSelectedId: null, ...(buildMovingId === id ? { buildKind: null, buildMovingId: null } : {}) });
  };

  const select = (kind: FurnitureKind) => {
    play("ui", 0.2);
    set({ buildKind: buildKind === kind ? null : kind, buildMovingId: null });
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
      <h3>Furnish your café</h3>
      <p>
        Choose a piece, then <strong>tap the floor</strong> to place it.
        {liveEdit ? " Service keeps running for everyone else." : " Layout changes hit everyone in the room live."}
      </p>
      <CustomerFeedback feedback={snapshot.feedback} limit={3} />
      {!buildKind && selected ? (
        <p className="build-place-hint build-selected" aria-live="polite">
          <span className="hint-text">{selectedBlocked ? <>Last <strong>{selected.label}</strong> · needed to serve</> : <>Selected <strong>{selected.label}</strong></>}</span>
          <button type="button" className="btn-ghost btn-small" onClick={() => set({ buildKind: selected.kind, buildMovingId: selected.id, buildRotation: selected.rotation, buildSelectedId: null })}>
            Move
          </button>
          <button type="button" className="btn-ghost btn-small btn-danger" disabled={!!selectedBlocked} onClick={() => deleteItem(selected.id)}
            title={selectedBlocked ?? `Delete and get $${Math.round(selected.cost * 0.6)} back`}>
            {selectedBlocked ? "Can't delete" : `Delete +$${Math.round(selected.cost * 0.6)}`}
          </button>
          <button type="button" className="btn-ghost btn-small" aria-label="Deselect" onClick={() => set({ buildSelectedId: null })}>
            ✕
          </button>
        </p>
      ) : buildKind ? (
        <p className="build-place-hint" aria-live="polite">
          <span className="hint-text">{buildMovingId ? "Moving" : "Placing"} <strong>{FURNITURE_CATALOG.find((c) => c.kind === buildKind)?.label ?? buildKind}</strong><span className="hint-snap"> · ½ m snap</span></span>
          <button type="button" className="btn-ghost btn-small" onClick={() => set({ buildRotation: (buildRotation + Math.PI / 2) % (Math.PI * 2) })}>
            Rotate 90°
          </button>
          <button type="button" className="btn-ghost btn-small" onClick={() => set({ buildKind: null, buildMovingId: null })}>
            Cancel
          </button>
        </p>
      ) : (
        <p className="build-place-hint muted">Pick from the catalog to place, or tap furniture to move or delete it.</p>
      )}
      <div className="catalog">
        {FURNITURE_CATALOG.map((item) => (
          <div key={item.kind} className={`catalog-row ${buildKind === item.kind ? "selected" : ""}`}>
            <button className="catalog-item" type="button" aria-pressed={buildKind === item.kind} onClick={() => select(item.kind)}>
              <div>
                <strong>{item.label}</strong>
                <span>{item.description}</span>
              </div>
              <em>${item.cost}</em>
            </button>
            <button
              type="button"
              className="btn-ghost btn-small catalog-quick"
              title="Try placing this item at a random location"
              onClick={() => quickDrop(item.kind)}
            >
              Quick
            </button>
          </div>
        ))}
      </div>
      <div className="build-actions">
        {!snapshot.open ? (
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
        ) : (
          <p className="build-place-hint muted">Doors are open — edits sync live while the floor keeps serving.</p>
        )}
        {!liveEdit ? (
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
        ) : null}
      </div>
      <p className="build-feedback" role="status">{snapshot.eventLog[0]}</p>
      {snapshot.layout && (
        <details className="placed-furniture"><summary>Placed furniture <span>{snapshot.layout.furniture.length}</span></summary><ul className="placed-list">
          {snapshot.layout.furniture.map((f) => (
            <li key={f.id}>
              <span>
                {f.label} ({f.x.toFixed(1)}, {f.z.toFixed(1)})
              </span>
              <button type="button" className="btn-ghost btn-small" onClick={() => set({ buildKind: f.kind, buildMovingId: f.id, buildRotation: f.rotation })}>
                Move
              </button>
              <button type="button" className="btn-ghost btn-small btn-danger" disabled={!!blockedReason(f.id)} title={blockedReason(f.id) ?? undefined} onClick={() => deleteItem(f.id)}>
                Delete
              </button>
            </li>
          ))}
        </ul></details>
      )}
    </aside>
  );
}
