import { FURNITURE_CATALOG, type FurnitureKind, type RoomSnapshot } from "../../shared/types";
import { useApp } from "../lib/store";
import { play } from "../lib/audio";

export function BuildPanel({ snapshot }: { snapshot: RoomSnapshot }) {
  const conn = useApp((s) => s.conn);
  const property = snapshot.property;

  const place = (kind: FurnitureKind) => {
    if (!property) return;
    const x = 2 + Math.random() * Math.max(2, property.width - 4);
    const z = 2 + Math.random() * Math.max(2, property.depth - 4);
    conn?.send({ t: "place_furniture", kind, x, z });
    play("place");
  };

  return (
    <aside className="side-panel panel build-panel">
      <h3>Build mode</h3>
      <p>Every object has functional consequences — capacity, throughput, and circulation.</p>
      <div className="catalog">
        {FURNITURE_CATALOG.map((item) => (
          <button key={item.kind} className="catalog-item" type="button" onClick={() => place(item.kind)}>
            <div>
              <strong>{item.label}</strong>
              <span>{item.description}</span>
            </div>
            <em>${item.cost}</em>
          </button>
        ))}
      </div>
      <div className="build-actions">
        <button
          className="btn"
          type="button"
          onClick={() => {
            play("open");
            conn?.send({ t: "open_cafe" });
          }}
        >
          Open for business
        </button>
        <button className="btn btn-ghost" type="button" onClick={() => conn?.send({ t: "set_phase", phase: "play" })}>
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
