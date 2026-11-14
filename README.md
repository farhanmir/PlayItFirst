# Play It First

> Play your business before you pay for it.

Play It First is a multiplayer business simulation that turns real commercial properties into playable businesses. Players design their storefront, operate it together, serve customers, manage finances, and experiment with different business decisions inside a living simulation.

Before every grand opening, there's a soft opening. We built one you can play.

**Repo:** https://github.com/farhanmir/PlayItFirst

**Play:** https://playitfirst.onrender.com/ · [Judge demo](https://playitfirst.onrender.com/?demo=1)

Production runs entirely on one free Render Web Service (frontend, API and multiplayer). See [deployment instructions](docs/DEPLOY.md).

## Run

```sh
npm install
npm run dev
```

Open http://localhost:5173

## Demo path (2 minutes)

**Fastest for judges:** click **Judge demo** on the landing page, or open `http://localhost:5173/?demo=1` — auto-hosts Midtown, enters the floor, and opens the café.

Manual path:

1. Enter your name → **Open Your Business**
2. Pick a Houston or LA storefront (rent/size/traffic become the rules)
3. **Build** — select furniture → click the café floor (or drag **Table** markers)
4. Open **Matterport** walkthrough on Build; crew voice on Ops; **WebXR** on Table
5. **Open for business** → WASD + Take order / Brew / Serve (`E` / `F` / `R` / Space)
6. Answer the AI director + message Jamie in **Ops**
7. Check **Future** for the rival café race + alternate timelines, then **Plan** → generate blueprint
8. Friends scan the HUD QR to join as baristas

## What works

| Area | Status |
| --- | --- |
| CoStar property selection | ✅ Live when `COSTAR_API_URL` set · else clearly labeled mock |
| Matterport twin | ✅ Showcase embed + Model API when `MATTERPORT_TOKEN` set · playable plate reconstructed from listing dims |
| Playable 3D café (Three.js / R3F) | ✅ Warm procedural interior |
| 1st / 3rd / Monitor / Dollhouse cameras | ✅ |
| Station-gated jobs + brew timer | ✅ |
| Click-to-place build | ✅ |
| Real-time multiplayer + QR join | ✅ |
| Customers, tickets, inventory | ✅ |
| Live tabletop marker sync | ✅ |
| AI game director | ✅ Local rules · hosted LLM when keyed (Deepagents runtime still P0) |
| Nessie finance ledger | ✅ Local + optional `NESSIE_KEY` |
| In-app manager chat + crew WebRTC | ✅ Labeled honestly — not Photon 2.0 yet |
| Vision Pro / WebXR | ✅ Immersive VR/AR entry + dollhouse fallback |
| Rival café + time machine | ✅ Heuristic / illustrative — labeled as such |
| Judge demo (`/?demo=1`) | ✅ |
| Launch blueprint | ✅ With data provenance |
| WebAudio café SFX | ✅ iOS-safe unlock |

## Architecture

Reuses battle-tested ideas from [Gitzilla](https://github.com/gfhdhytghd/Gitzilla) without becoming Gitzilla:

- Single-port Node + Vite middleware + `/ws`
- Authoritative sim tick + snapshot broadcast
- QR join + resume tokens (`softopen.*` keys; `playfirst.*` still accepted)

```
shared/   contracts
server/   rooms, simulation, director, costar, matterport, deepagents, finance, QR
client/   React UI + R3F café + WebRTC voice + WebXR
data/     property listings
docs/     HACKATHON, ALIGNMENT, PROGRESS
```

## Scripts

```sh
npm run dev        # game server + client
npm test           # sim + multiplayer smoke + integrations
npm run typecheck
npm run build
```

## Env (optional)

Copy `.env.example`. Demo runs fully without keys.

| Var | Purpose |
| --- | --- |
| `NESSIE_KEY` | Capital One Nessie sandbox |
| `COSTAR_API_URL` / `COSTAR_API_KEY` | Live CoStar listings JSON |
| `MATTERPORT_TOKEN` | Matterport Model API |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `DEEPAGENTS_*` | Hosted director |
| `PORT` | Default `5173` |

Integration status is exposed at `/api/integrations` and on the landing/game badges.

## Compatibility

Former product names: **SoftOpen** and **PlayFirst**. Resume tokens and localStorage name keys under `playfirst.*` are still read/written alongside `softopen.*` so mid-hackathon clients keep working.
