import { useApp } from "../lib/store";
import "./property.css";

export function PropertySelect() {
  const properties = useApp((s) => s.properties);
  const conn = useApp((s) => s.conn);
  const qrSvg = useApp((s) => s.qrSvg);
  const joinUrl = useApp((s) => s.joinUrl);
  const roomCode = useApp((s) => s.roomCode);
  const set = useApp((s) => s.set);

  return (
    <main className="property-page">
      <header className="property-head rise">
        <div>
          <p className="brand-inline">PlayFirst</p>
          <h1>Choose your dream café</h1>
          <p>Real CoStar-style listings in Houston and Los Angeles. Rent, size, and foot traffic become the rules of the game.</p>
        </div>
        <div className="join-card panel">
          <p className="tag">Invite friends</p>
          <div className="qr" dangerouslySetInnerHTML={{ __html: qrSvg || "" }} />
          <p className="room-code">Room {roomCode}</p>
          {joinUrl && (
            <button
              className="btn btn-ghost btn-small"
              type="button"
              onClick={() => navigator.clipboard?.writeText(joinUrl)}
            >
              Copy join link
            </button>
          )}
        </div>
      </header>

      <section className="property-grid rise-delay">
        {properties.map((p) => (
          <article key={p.id} className="property-card" style={{ ["--tone" as string]: p.imageTone }}>
            <div className="property-media">
              <div className="floorplan-ghost" />
              <span className="tag">{p.city}</span>
            </div>
            <div className="property-body">
              <h2>{p.name}</h2>
              <p className="addr">{p.neighborhood} · {p.address}</p>
              <p className="desc">{p.description}</p>
              <dl className="stats">
                <div>
                  <dt>Rent</dt>
                  <dd>${p.monthlyRent.toLocaleString()}/mo</dd>
                </div>
                <div>
                  <dt>Size</dt>
                  <dd>{p.sqft} sqft</dd>
                </div>
                <div>
                  <dt>Capacity</dt>
                  <dd>{p.capacity}</dd>
                </div>
                <div>
                  <dt>Traffic</dt>
                  <dd>{Math.round(p.footTraffic * 100)}%</dd>
                </div>
              </dl>
              <p className="matterport">{p.matterportHint}</p>
              <button
                className="btn"
                type="button"
                onClick={() => {
                  conn?.send({ t: "select_property", propertyId: p.id });
                  set({ screen: "game" });
                }}
              >
                Open this property
              </button>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
