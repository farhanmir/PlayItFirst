# Play It First

> Play your business before you pay for it.

A multiplayer business simulation that transforms a real commercial property into a playable café. Design the space, work together, serve customers, manage finances and test business decisions before committing actual capital. Before every grand opening, there's a soft opening. We built one you can play.

**Play:** https://playitfirst.onrender.com/ · [Judge demo](https://playitfirst.onrender.com/?demo=1)  
**Repo:** https://github.com/farhanmir/PlayItFirst

## Start here

- [Master product plan and complete implementation audit](docs/MASTER_PLAN.md)
- [Agent instructions](AGENTS.md) · [Current alignment](docs/ALIGNMENT.md) · [Progress/evidence](docs/PROGRESS.md)
- [Render deployment and credentials](docs/DEPLOY.md) · [Judging and pitch](docs/HACKATHON.md)

## Run locally (Node 22)

```sh
npm ci --include=dev
npm run dev
```

Open http://localhost:5173. Copy .env.example to ignored .env only if configuring sponsor credentials. Never commit actual keys or private .sponsor data.

## Play

Host or join a business, select a property, view its walkthrough, open the café. Move with WASD or touch; E/Space performs contextual service action. Take an order, brew, carry and serve. Tab/build lets the owner edit the shared floor while others play. Menu contains finance, Jamie manager, crew, comparison and blueprint. Friends join by QR. Judge demo creates a fresh playable shift and prefers the authorized property extract when configured; otherwise clearly labeled mock fallback. No real money.

## Current implementation status (Nov 14)

| Area | Status |
| --- | --- |
| 3D café, manual service, customers, inventory, cash | Implemented; browser-tested |
| Multiplayer, QR/resume, shared build | Public service and shared counter rerouting verified; physical-phone acceptance pending |
| CoStar and Matterport | Public matched measured suite and live Model API verified; publication/external-processing permissions remain separate |
| Deepagents and Gemini | Actual provider-approved execution recorded; latest recorded run hit quota, so reliable live access remains a demo gate |
| Nessie | Live synthetic account, settled sale/purchase, future rent bill and reconciled balance verified; Render configuration and played-session banking pending |
| Photon | Messaging inbox/webhook and voice backend implemented; actual message delivery and telephone calls unverified |
| Timeline/rival | Illustrative heuristics, not measured counterfactuals |
| Blueprint | Actual session Markdown export verified |
| WebXR | Optional entry/dollhouse fallback; headset unverified |

See REQUEST_AUDIT and PROGRESS for current evidence. Public APIs reported `costar-extract` on Render `1f078ae` during the latest check; the active production commit may differ from main. Older screenshots remain accessible through pinned Git-history links; the checkout retains a curated recent set and compact verification traces.

## Architecture and deployment

React/Vite/R3F client + shared TypeScript contracts + persistent Node/WebSocket authoritative simulation. server/main.ts serves SPA/API/ws on a single port. Render is the only production host; see render.yaml and DEPLOY.md. No separate frontend hosting. In-memory rooms reset on process restart; no durable saves. Former names SoftOpen/PlayFirst remain only for compatible resume/storage and service identifiers.

```sh
npm test
npm run typecheck
npm run build
node scripts/check-deployment.mjs https://playitfirst.onrender.com
```

Optional geometry checks: python -m unittest discover -s scripts -p 'test_*.py'. Live Gemini check: node --import tsx scripts/check-gemini-manager.ts (requires real key, synthetic data only). Do not count scripted/mock model tests as real provider proof.

## Environment

Use .env.example and docs/DEPLOY.md. Render server secrets: COSTAR_DATA_FILE (authorized secret file property.json), MATTERPORT_API_KEY + MATTERPORT_TOKEN, GOOGLE_API_KEY (or GEMINI_API_KEY; OpenAI/Anthropic supported), optional DEEPAGENTS_MODEL and NESSIE_KEY. Keep ALLOW_SPONSOR_MODEL_CONTEXT=false until sponsor authorizes external processing. See docs/PHOTON_SETUP.md for the remaining provider provisioning and pairing steps. No secrets in VITE_* or client code. Check /api/health, /api/integrations and /api/properties; keys alone do not verify actual integration.
