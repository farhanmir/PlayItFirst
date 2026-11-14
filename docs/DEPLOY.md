# Play It First public deploy

Use the free **single-service Render Blueprint** first. It serves the built Vite game, API and authoritative WebSocket rooms together. No Vercel project or cross-origin configuration is required.

## Render (preferred, free)

1. In Render, create a Blueprint from `farhanmir/PlayItFirst`, branch `main`, using the existing `render.yaml`. Confirm the service plan is **Free**.
2. The blueprint sets Node 22, `npm ci --include=dev && npm run build`, `npm start`, and health check `/api/health`. Keep development dependencies during build/runtime because `tsx` runs the server.
3. Leave `VITE_API_BASE_URL`, `VITE_WS_URL`, `VITE_PUBLIC_ORIGIN`, `FRONTEND_ORIGIN` and `CORS_ORIGINS` unset for this same-origin deployment. Put optional sponsor secrets only in the service dashboard.
4. Open the assigned `https://<service>.onrender.com/?demo=1`. Verify `/api/health`, a human take/brew/serve, then scan the invite QR on a real phone. Both clients must use the same HTTPS origin and WSS `/ws`; move furniture while both remain connected.
5. Warm the service before judging. [Render free services sleep after 15 minutes without inbound traffic and may take about a minute to wake](https://render.com/docs/free). Rooms are in memory and disappear on restart/redeploy. This is a demo service, with no durable saves.

Local production verification: build, then run the server with `NODE_ENV=production` and a separate `PORT` (the npm start shell syntax works on Render/Linux; in PowerShell set those environment variables and run `node --import tsx server/main.ts`). The November 14 Codex run exercised the built game on port 5174; see PROGRESS.md. **No public Render deploy has been verified yet: account connection/public service URL is missing.**

## Repeatable deployment check (issue #6)

### Optional Deepagents manager provider

Set `GOOGLE_API_KEY` in the Render service environment (or ignored local `.env`) to use Gemini through the official `@langchain/google` `ChatGoogle` adapter. `GEMINI_API_KEY` is an alias; `GOOGLE_API_KEY` wins if both exist. Provider precedence is Google/Gemini, then OpenAI, then Anthropic. Existing `OPENAI_API_KEY` and `ANTHROPIC_API_KEY` remain supported. `DEEPAGENTS_MODEL` overrides the chosen provider's model; remove an override belonging to a different provider when switching keys. Defaults are `gemini-3.6-flash`, `gpt-4o-mini`, and `claude-haiku-4-5-20251001`, respectively.

Google documents [Gemini 3.6 Flash with function calling](https://aistudio.google.com/docs/models/gemini-3.6-flash). Availability and quota must still be checked against your project. There are no automatic model calls, retries or purchases: owner requests use the existing Deepagents graph, four-model-turn/20-second limit, room authorization and exact proposal approval. No key means the labeled local fallback. Keys never belong in `VITE_*` or `render.yaml` values; the existing single-service blueprint needs no structural change.

For a bounded real-provider acceptance check, run `node --import tsx scripts/check-gemini-manager.ts` after adding a real Google key to `.env`. This uses an explicitly synthetic property, verifies planning spends nothing, rejects guest approval, approves one $35 restock, checks fresh outcome/inventory and duplicate approval. It never loads CoStar/Matterport files. Do not ask the manager to inspect a restricted real-property room until sponsor authorization for external model processing is established. This script tests the manager service; two-browser live-provider verification remains a separate acceptance check.

After deployment, run this once from a checkout with dependencies installed, replacing the example origin with the actual service URL:

```sh
node scripts/check-deployment.mjs https://YOUR-SERVICE.onrender.com
```

The check loads the built demo page and its JavaScript asset, validates health/listings and the server-generated invite origin, then connects two WebSocket clients to a new disposable room. It selects a property, opens service, moves and rotates a plant, checks both clients agree, and reconnects the host with its resume token. A failed assertion exits nonzero. Public URLs require HTTPS/WSS; loopback HTTP is accepted for local production checks. The script does not call manager tools or send sponsor messages.

Each run creates one in-memory room, which remains until the process restarts. This is a manual release check, not an uptime monitor. Run it against the team's service only. The initial HTTP request allows 90 seconds for a free-service cold start; wait for Render to finish starting if it returns a loading page.

For local verification in PowerShell, use a spare port:

```powershell
npm.cmd run build
$env:NODE_ENV = 'production'
$env:PORT = '5184'
node --import tsx server/main.ts
```

In a second terminal run `node scripts/check-deployment.mjs http://127.0.0.1:5184`. These environment variables affect only the first terminal; use a fresh terminal for `npm.cmd run dev`. The `.cmd` launcher works when PowerShell blocks `npm.ps1`; no execution-policy change is needed.

Passing this check does **not** verify WebGL, a physical phone scanning the QR, a human paid order, customer rerouting, or recovery after process restart. Complete the manual checklist below and record the actual Render URL, deployed commit, Free plan, devices and results in issue #6. Keep the issue open until public verification is complete.

The split deployment below is optional.

## Architecture

| Piece | Host | Why |
| --- | --- | --- |
| Vite `dist/` SPA | Vercel | Static HTTPS frontend and QR landing page |
| `server/main.ts` rooms + sim | Railway (or one persistent Node process) | In-memory rooms, 20 Hz ticks, WebSockets |

Do **not** put the multiplayer simulation in independent serverless functions. One backend instance is enough for the hackathon.

## Backend (Railway)

1. Create a Node service from this repo.
2. Start command: `npm run start` (runs `NODE_ENV=production tsx server/main.ts`).
3. Build command: `npm install && npm run build` (ships `dist/` if you also want same-origin fallback).
4. Set secrets in the Railway dashboard only (`NESSIE_KEY`, `COSTAR_*`, `DEEPAGENTS_*`, Matterport tokens). Never put them in `VITE_*`.
5. Set `CORS_ORIGINS` / `FRONTEND_ORIGIN` to the Vercel HTTPS origin (e.g. `https://softopen.vercel.app`).
6. Confirm `/api/health` and `wss://<railway-host>/ws` are reachable.

## Frontend (Vercel)

1. Import the repo. `vercel.json` already points at the Vite build output.
2. Set public build env vars (no secrets):
   - `VITE_API_BASE_URL=https://<railway-host>`
   - `VITE_WS_URL=wss://<railway-host>/ws`
   - `VITE_PUBLIC_ORIGIN=https://<vercel-host>`
3. Redeploy after changing env vars.
4. Open the Vercel URL, host a room, scan the QR. The QR must be the Vercel HTTPS page; the browser socket must hit Railway WSS.

## Local defaults

With env vars unset, `client/lib/api.ts` and `client/lib/net.ts` keep same-origin `/api/*` and `/ws`, matching `npm run dev`.

## Checklist before claiming a public demo

- [ ] Two clients on the public frontend join one room
- [ ] QR opens the public frontend, not localhost
- [ ] Furniture move on one client appears on the other
- [ ] One paid order updates cash and inventory once
- [ ] No secrets in the client bundle (`VITE_*` only)
