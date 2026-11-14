# Play It First — current alignment

See [MASTER_PLAN.md](MASTER_PLAN.md) for the full original vision, detailed specifications, all nine prize targets, evidence and remaining acceptance gates. Audit baseline: main 02219b7, November 14, 2026. Latest recorded full tests: 82 JS + typecheck/build before Render-only cleanup; earlier 3 Python converter tests. No fresh run for this docs audit.

| Area | Current evidence | Remaining |
| --- | --- | --- |
| Core gameplay | Real keyboard orders, brew, carry, serve, receipt; local and public browser | Latest build, physical phone touch, polished interactions |
| Multiplayer | Public WSS, two clients, edit and resume | Physical QR, current SHA, restart |
| Real property | Local authorized CoStar extract and measured Matterport single-floor reconstruction | Public data file/credentials, permission, walkthrough and real-floor public test |
| Geometry | 12 rooms, 66 walls, 11 doors, 4 windows; collisions and routes tested | Actual shared counter move and measured outcome in public real suite |
| Visuals | Original procedural café, improved character pass | Commercial-quality silhouettes/animation, lighting, camera, HUD and phone performance |
| Build | Grid, ghosts, move/rotate, server validation | Direct drag/full ghosts, show causal route change |
| Business manager | Real Deepagents graph, four tools, owner authorization, idempotency, local proof | Live Gemini plan/approve/execute/observe; authorization for sponsor context |
| Messaging/voice | Local UI and WebRTC | Actual Photon providers and verified identity/approval |
| Banking | Local validated ledger, legacy sandbox adapter | Real sandbox reconcile/provision/mirror receipts |
| Director | Local operational events | Verify effects match choices, no metric manipulation |
| Rival/timeline | Labeled heuristics | Reproducible A/B optional, no fake outcomes |
| Blueprint | Downloadable Markdown | Real session evidence, assumptions and actionable export |
| WebXR | Optional session entry/dollhouse | Actual headset testing, not required |
| Hosting | Existing Render full stack; Vercel removed | Confirm active deployment and sponsor config |
| Submission | Nine targets; ChatOverflow dropped | Eligibility, public repo audit, deadline, rehearsed demo |

Prior public proof is [public-verification.json](screenshots/public-verification.json) (mock property). Local manager proof is [manager-verification.json](screenshots/manager-verification.json) (providerVerified false). Do not treat source configuration or prior test evidence as proof of current production. See [PROGRESS.md](PROGRESS.md) for chronology, [DEPLOY.md](DEPLOY.md) for exact verification and [HACKATHON.md](HACKATHON.md) for demo. Current architecture/decisions are specified in MASTER_PLAN; old reports are retained as historical evidence.
