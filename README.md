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
| Multiplayer, QR/resume, shared build | Prior public browser test passed; physical phone/latest deploy pending |
| CoStar and Matterport | Authorized matched measured suite implemented locally; public extract/permissions/viewer not yet verified |
| Deepagents and Gemini | Actual framework + Google adapter, tests; live provider acceptance pending |
| Nessie | Local ledger, incomplete external sandbox integration |
| Photon | In-app manager/crew WebRTC, not real Photon messaging or telephone |
| Timeline/rival | Illustrative heuristics, not measured counterfactuals |
| Blueprint | Markdown export; real-session verification remaining |
| WebXR | Optional entry/dollhouse fallback; headset unverified |

See MASTER_PLAN and PROGRESS for current evidence, not just configuration. Last recorded public property was costar-mock. The active production commit may differ from main.

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

Use .env.example and docs/DEPLOY.md. Render server secrets: COSTAR_DATA_FILE (authorized secret file property.json), MATTERPORT_API_KEY + MATTERPORT_TOKEN, GOOGLE_API_KEY (or GEMINI_API_KEY; OpenAI/Anthropic supported), optional DEEPAGENTS_MODEL and NESSIE_KEY. Keep ALLOW_SPONSOR_MODEL_CONTEXT=false until sponsor authorizes external processing. Photon credentials pending provider integration. No secrets in VITE_* or client code. Check /api/health, /api/integrations and /api/properties; keys alone do not verify actual integration.
