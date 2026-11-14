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
        <div className="property-intro">
          <p className="brand-inline">PlayFirst</p>
          <h1>Choose your dream café</h1>
          <p className="property-lede">
            Real commercial listings in Houston and Los Angeles. Rent, size, and foot traffic set the rules.
          </p>
        </div>
        <aside className="join-card panel">
          <p className="join-label">Invite friends</p>
          <div className="qr" dangerouslySetInnerHTML={{ __html: qrSvg || "" }} />
          <p className="room-code">{roomCode || "····"}</p>
          {joinUrl && (
            <button
              className="btn btn-ghost btn-small"
              type="button"
              onClick={() => navigator.clipboard?.writeText(joinUrl)}
            >
              Copy join link
            </button>
          )}
        </aside>
      </header>

      <section className="property-grid rise-delay">
        {properties.map((p) => {
          const rentPsf = p.monthlyRent / p.sqft;
          return (
            <article key={p.id} className="property-card" style={{ ["--tone" as string]: p.imageTone }}>
              <div className="property-media">
                <div
                  className="floorplan-ghost"
                  aria-hidden
                  style={{
                    ["--plan-w" as string]: `${Math.min(100, (p.width / 22) * 100)}%`,
                    ["--plan-d" as string]: `${Math.min(100, (p.depth / 14) * 100)}%`,
                  }}
                />
                <div className="media-chips">
                  <span className="tag">{p.city}</span>
                  <span className="tag tag-soft">Matterport twin</span>
                </div>
                <p className="media-dims">
                  {p.width}m × {p.depth}m plate
                </p>
              </div>
              <div className="property-body">
                <div className="property-title-row">
                  <h2>{p.name}</h2>
                  <code className="costar-id" title="CoStar listing id">
                    {p.costarId}
                  </code>
                </div>
                <p className="addr">
                  {p.neighborhood} · {p.address}
                </p>
                <p className="desc">{p.description}</p>
                <dl className="stats">
                  <div>
                    <dt>Rent</dt>
                    <dd>${p.monthlyRent.toLocaleString()}/mo</dd>
                  </div>
                  <div>
                    <dt>$ / sqft</dt>
                    <dd>${rentPsf.toFixed(2)}</dd>
                  </div>
                  <div>
                    <dt>Size</dt>
                    <dd>{p.sqft.toLocaleString()} sqft</dd>
                  </div>
                  <div>
                    <dt>Capacity</dt>
                    <dd>{p.capacity}</dd>
                  </div>
                  <div>
                    <dt>Traffic</dt>
                    <dd>{Math.round(p.footTraffic * 100)}%</dd>
                  </div>
                  <div>
                    <dt>Tour</dt>
                    <dd className="tour-dd">3D walk</dd>
                  </div>
                </dl>
                <p className="matterport">
                  <span className="mp-label">Floorplate</span>
                  {p.matterportHint}
                </p>
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
          );
        })}
      </section>
    </main>
  );
}
