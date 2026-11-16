# Deployment and configuration

Play It First uses one persistent Node process for the built Vite SPA, HTTP API and authoritative WebSocket rooms. All browser requests use the same origin. The existing [Render configuration](../render.yaml) uses Node 22; no separate frontend host is needed.

## Local production

```sh
npm ci --include=dev
npm run build
npm start
```

Open http://localhost:5173. To use another port in PowerShell, set `$env:PORT = '5184'` before `npm start`. The production entry point sets `NODE_ENV=production` on Windows and Linux.

Run the transport check against that process:

```sh
node scripts/check-deployment.mjs http://127.0.0.1:5173
```

This checks assets, health, listings, invite origin, two WebSocket clients, layout synchronization and resume. It does not establish WebGL rendering, physical-phone input or external provider delivery.

## Render

Use the existing service and [render.yaml](../render.yaml):

- Build: `npm ci --include=dev && npm run build`
- Start: `npm start`
- Health: `/api/health`
- Runtime: Node 22; keep development dependencies because the server runs through `tsx`.
- Secrets: server-side Environment settings or authorized Secret Files.

Use same-origin HTTPS/WSS. Do not configure separate `VITE_API_BASE_URL`, `VITE_WS_URL`, `VITE_PUBLIC_ORIGIN`, `FRONTEND_ORIGIN` or `CORS_ORIGINS` overrides. Proxy-aware invite links use the request's HTTPS origin. Rooms and phone pairings are in memory and disappear on restart.

## Optional providers

Copy [`.env.example`](../.env.example) to an ignored `.env` for local configuration. Leave credentials blank for fictional practice play with local fallback behavior.

| Capability | Settings |
| --- | --- |
| Jamie / Deep Agents | `GOOGLE_API_KEY` or `GEMINI_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`; optional `DEEPAGENTS_MODEL` |
| Customer reactions | `XAI_API_KEY`, optional `XAI_MODEL`; disable with `CUSTOMER_MINDS=off` |
| Nessie sandbox | `NESSIE_KEY`, optional `NESSIE_URL`, `NESSIE_REQUIRE_ACTIVATION`, `NESSIE_ACTIVATION_CODE`, `NESSIE_ACCOUNT_LIMIT` |
| Real-property import | `COSTAR_DATA_FILE`, `MATTERPORT_API_KEY`, `MATTERPORT_TOKEN` |
| Photon messaging / voice | See [Photon setup](PHOTON_SETUP.md) |

Jamie selects Google/Gemini, then OpenAI, then Anthropic when multiple provider keys are configured. Use a tool-capable model available to the selected provider. The manager requires an exact owner-approved proposal before executing a change.

Nessie uses sandbox accounts and transactions only. Fictional rooms can auto-connect when a key is configured; `NESSIE_REQUIRE_ACTIVATION=true` enables the owner activation-code flow. The local game ledger remains authoritative. Pending, failed and ambiguous external writes must not be presented as settled.

## Authorized real-property data

The repository ships fictional listings. Keep original archives, normalized extracts and credentials outside Git. The importer accepts private kit settings from the environment:

```sh
python scripts/import-costar.py --candidates
python scripts/import-costar.py --suite LISTING_ID:SPACE_ID
```

Review the resulting ignored `.sponsor/property.json` and provide it through an authorized private mechanism. For a Render Secret File named `property.json`, set `COSTAR_DATA_FILE=/etc/secrets/property.json`. Listing and scan must match; measured geometry does not imply an exact textured replica.

Keep `ALLOW_SPONSOR_MODEL_CONTEXT`, `ALLOW_SPONSOR_BANK_CONTEXT` and `ALLOW_SPONSOR_PHONE_CONTEXT` false unless the respective external processing is authorized. Display and redistribution permissions are separate from API access.

## Provider checks

`node --import tsx scripts/check-gemini-manager.ts` uses a synthetic property and requires a real configured Google key.

`node --import tsx scripts/check-nessie.ts --live` creates synthetic sandbox banking records through the ledger adapter. Inspect existing records before rerunning an ambiguous write; no real money is involved.

These commands intentionally use external services. Configuration readiness and mocked tests do not prove successful provider execution.

## Assets

Keep the attribution and license files distributed with character models and audio. The in-game Help panel links to audio credits. Do not put secrets in browser variables, source code or screenshots.
