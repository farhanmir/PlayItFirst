import { useApp } from "../lib/store";
import { useState } from "react";
import { MatterportPanel } from "../components/MatterportPanel";
import "./property.css";

export function PropertySelect() {
  const [previewId, setPreviewId] = useState<string | null>(null);
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
          <p className="brand-inline">Play It First</p>
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
                  <span className="tag tag-soft">
                    {p.matterportModelId ? "Matterport model" : "Matterport showcase stand-in"}
                  </span>
                  {p.source === "costar-live" || p.source === "costar-extract" ? (
                    <span className="tag">{p.source === "costar-extract" ? "CoStar event extract" : "CoStar live"}</span>
                  ) : (
                    <span className="tag tag-soft">CoStar-shaped mock</span>
                  )}
                </div>
                <p className="media-dims">
                  {p.width.toFixed(1)}m × {p.depth.toFixed(1)}m {p.provenance ? "simulation footprint" : "plate"}
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
                {p.provenance ? <p className="desc">{p.provenance.geometry} · Asking rent excludes additional charges. Café use and capacity require verification.</p> : null}
                <dl className="stats">
                  <div>
                    <dt>{p.provenance ? "Base asking rent" : "Rent"}</dt>
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
                    <dt>{p.provenance ? "Assumed capacity" : "Capacity"}</dt>
                    <dd>{p.capacity}</dd>
                  </div>
                  <div>
                    <dt>{p.provenance ? "Simulated traffic" : "Traffic"}</dt>
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
                  className="btn btn-ghost" type="button"
                  aria-expanded={previewId === p.id}
                  onClick={() => setPreviewId(previewId === p.id ? null : p.id)}
                >
                  {previewId === p.id ? "Hide space preview" : "Preview this space"}
                </button>
                {previewId === p.id ? <MatterportPanel property={p} /> : null}
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
