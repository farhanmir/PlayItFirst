import { useApp } from "../lib/store";
import { useState } from "react";
import { MatterportPanel } from "../components/MatterportPanel";
import { planSegments } from "../../shared/floorplan";
import "./property.css";

export function PropertySelect() {
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const properties = useApp((s) => s.properties);
  const conn = useApp((s) => s.conn);
  const qrSvg = useApp((s) => s.qrSvg);
  const joinUrl = useApp((s) => s.joinUrl);
  const roomCode = useApp((s) => s.roomCode);
  const set = useApp((s) => s.set);
  return (
    <main className="property-page">
      <header className="property-head">
        <div className="property-intro">
          <p className="property-brand">Play It First <span>/ New café</span></p>
          <h1>Find your first space.</h1>
          <p className="property-lede">Your space sets the rent and layout. Take a look around, then make it your café.</p>
        </div>
        <aside className="property-invite" aria-label="Invite friends">
          <div className="property-qr" dangerouslySetInnerHTML={{ __html: qrSvg || "" }} />
          <div><p>Bring your crew</p><strong className="room-code">{roomCode || "····"}</strong>
            {joinUrl && <button type="button" onClick={async () => {
              try { await navigator.clipboard.writeText(joinUrl); setCopied(true); } catch { setCopied(false); }
            }}>{copied ? "Link copied" : "Copy join link"}</button>}
          </div>
        </aside>
      </header>
      <section className="property-grid" aria-label="Available café spaces">
        {properties.map((p, index) => {
          const realListing = p.source === "costar-live" || p.source === "costar-extract";
          const plan = p.floorPlan;
          return (
            <article key={p.id} className="property-card">
              <div className="property-media">
                <div className="property-media-heading"><span>Space {String(index + 1).padStart(2, "0")}</span><span>{plan ? "Measured floor plan" : "Demo footprint"}</span></div>
                <svg className="property-plan" viewBox={`-1 -1 ${p.width + 2} ${p.depth + 2}`} role="img" aria-label={plan ? "Measured property floor plan" : "Assumed rectangular demo footprint"}>
                  {plan ? <>
                    {plan.rooms.map((room) => <polygon key={room.id} points={room.polygon.map((point) => `${point.x},${point.z}`).join(" ")} fill="#e8dec3" />)}
                    {planSegments(plan).map((wall, i) => <line key={i} x1={wall.a.x} y1={wall.a.z} x2={wall.b.x} y2={wall.b.z} stroke="#173c35" strokeWidth={Math.max(.09, wall.thickness)} />)}
                    <circle cx={plan.entry.x} cy={plan.entry.z} r=".3" fill="#b57931" />
                  </> : <rect x="0" y="0" width={p.width} height={p.depth} fill="#e8dec3" stroke="#173c35" strokeWidth=".12" />}
                </svg>
                <p className="property-dimensions">{p.width.toFixed(1)} × {p.depth.toFixed(1)} m <span>Simulation footprint</span></p>
                <p className="property-source">{realListing ? (p.source === "costar-extract" ? "CoStar event extract" : "CoStar live listing") : "Fictional demo listing"} · {p.city}</p>
              </div>
              <div className="property-body">
                <div className="property-title-row"><h2>{p.name}</h2><code title="Listing identifier">{p.costarId}</code></div>
                <p className="property-address">{p.neighborhood} · {p.address}</p>
                <p className="property-description">{p.description}</p>
                <dl className="property-stats">
                  <div><dt>{realListing ? "Base asking rent" : "Simulated rent"}</dt><dd>${p.monthlyRent.toLocaleString()}<small>/mo</small></dd></div>
                  <div><dt>Floor area</dt><dd>{p.sqft.toLocaleString()}<small>sqft</small></dd></div>
                  <div><dt>Assumed capacity</dt><dd>{p.capacity}<small>guests</small></dd></div>
                </dl>
                <details className="property-assumptions"><summary>Property details & assumptions</summary>
                  <p>Rent: ${(p.monthlyRent / p.sqft).toFixed(2)} per sqft per month. Simulated foot traffic: {Math.round(p.footTraffic * 100)}%.</p>
                  {p.provenance && <p>{p.provenance.geometry} · Asking rent excludes additional charges. Café use and capacity require verification.</p>}
                  <p>{p.matterportHint}</p>
                  {plan && <p>The layout is measured. Café equipment is your proposed fit-out. Finishes are reconstructed; use the walkthrough to inspect the original interior.</p>}
                  <p>{p.matterportModelId ? "Matterport model available." : "Matterport showcase stand-in; not a matched property tour."}</p>
                </details>
                <div className="property-actions">
                  <button className="property-open" type="button" onClick={() => { conn?.send({ t: "select_property", propertyId: p.id }); set({ screen: "game" }); }}>Open this property <span aria-hidden="true">→</span></button>
                  <button className="property-preview" type="button" aria-expanded={previewId === p.id} onClick={() => setPreviewId(previewId === p.id ? null : p.id)}>{previewId === p.id ? "Close preview" : "Preview this space"}</button>
                </div>
                {previewId === p.id && <MatterportPanel property={p} />}
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
