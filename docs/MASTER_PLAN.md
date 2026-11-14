# Play It First — canonical product plan and implementation audit

**Audit:** November 14, 2026 (HackPrinceton Fall 2026). Source inspected at main `02219b7826437ff2fb3c35aa8946ba2fa46bd8cf`.  
**Production:** https://playitfirst.onrender.com/ · [Judge demo](https://playitfirst.onrender.com/?demo=1).  
**Repository:** https://github.com/farhanmir/PlayItFirst.  
**Decisions:** game first; nine prize targets; Gemini supported; ChatOverflow dropped; Render only; local Codex primary.

This document consolidates the original concept, issue #2, the event handbook, sponsor issues #6–#11, original alignment and pitch docs, and later owner feedback. It is the authoritative product scope and acceptance plan, not a claim that everything is finished. Read [PROGRESS.md](PROGRESS.md) for dated evidence, [DEPLOY.md](DEPLOY.md) for deployment steps, [ALIGNMENT.md](ALIGNMENT.md) for the compact audit, [HACKATHON.md](HACKATHON.md) for the pitch, and [../AGENTS.md](../AGENTS.md) for agent rules. Current owner decisions and new verified evidence supersede old historical descriptions. Update this plan as requirements change.

## 1. Product vision and why it matters

**Name:** Play It First, formerly SoftOpen / PlayFirst.  
**Tagline:** Play your business before you pay for it.  
**Hook:** Before every grand opening, there's a soft opening. We built one you can play.  
**Closing:** Your grand opening starts when you play it first.

Starting a small business involves signing leases, buying equipment and choosing an operational layout before knowing how the store will function. Make that risk tangible and easier to understand. An aspiring café owner, student entrepreneur or business partner chooses a real commercial property, walks through the actual space, builds a business inside it and runs a soft opening with friends. They learn how layout, queueing, inventory, rent and staffing interact before making real commitments.

The real building is the game level; the lease is a constraint on the business. A virtual shift must be genuinely fun even without an LLM or external provider. Finish one café really well rather than build a half-finished collection of industries. All financial operations are simulated; no actual lease, payment, inventory order or staffing commitment. No promise that a simulation predicts real-world revenue or code compliance.

### Creative direction

- **Gitzilla benchmark:** creative transformation of real-world input into a game and instantly accessible multiplayer controls. Borrow the principle, not someone else's art or unrelated fighting mechanics. The equivalent wow here is a real scan becoming a business people can actually operate.
- **Cozy commercial café simulator:** warm sunlight, clean interior, recognizable equipment, appealing believable stylized characters, responsive first/third-person interaction and sound. Not capsules walking around a dashboard.
- **Sims-style build mode:** easy placement, drag/move, rotate, snap, ghost previews, dollhouse/tabletop perspective, continuous shared world. A friend edits while another serves.
- **Overcooked-style teamwork:** rushes, distinct roles, readable orders, brewing/carrying/serving, scarce resources, useful cooperation and visible consequences.
- **Business partner:** Jamie observes, reasons, proposes, executes authorized tools and verifies outcomes. Real text and phone access use the same manager.
- **Payoff:** a take-home launch blueprint based on the actual simulated session, property provenance and clearly identified assumptions.

### Decisions that supersede older plans

1. One free Render Web Service serves Vite SPA, Node APIs and authoritative WebSocket rooms at the public URL above. Owner deleted the Vercel project; commit 02219b7 removed its repo config and frontend overrides. No separate Vercel/Railway deployment, new serverless architecture, required database, Redis, authentication platform or paid hosting.
2. Local Codex on main, focused commits. Cursor Cloud quota exhausted; do not launch new cloud jobs. Claude Code can use the same plan. SpaceXSI is a separate workflow challenge; do not buy more usage.
3. Actual LangChain Deepagents with Gemini preferred when the owner supplies a key; OpenAI and Anthropic remain supported. Never introduce a second manager.
4. ChatOverflow is dropped. Historical contributions can stay; no leaderboard work. SpaceXSI is retained conditionally.
5. Public repo needed for submission, subject to credential/history and sponsor publication-rights review. Only owner approves visibility change.
6. Preserve compatibility for legacy storage keys, service health identifier and resume tokens; visible branding is Play It First.

## 2. Evidence and current state

**Evidence levels:** implemented = source exists; local tested = actual local test or browser evidence; public tested = recorded test on the public host for a particular build; provider verified = actual provider response plus intended effect; partial = gaps remain; stretch = can defer. Keys/configured booleans, scripted models, mocked HTTP and screenshots of reference art are not live proof.

At audited HEAD the latest recorded full run is **82 JS tests across 18 files, typecheck/build passing** at 84a9274. The subsequent Render-only cleanup added networking regression cases; it has not yet been independently run in this documentation audit. Earlier measured-floor run reported **3 Python converter tests**. Do not sum historical counts or state an unrun new count. Latest public browser report used **costar-mock**. Actual deployed SHA and new Render environment are unverified; direct live requests from this audit environment failed, not evidence of downtime. Owner reports service up and old Vercel project deleted.

| Requirement | Current state | Gap / acceptance |
| --- | --- | --- |
| Landing, host/join, judge demo | Implemented | Accurate demo copy for selected real/mock property; fast mobile onboarding |
| CoStar real listing and rent | Local authorized extract verified | Deploy private normalized JSON with permission; public source must be costar-extract |
| Matterport same-building preview and floor | Local measured reconstruction verified | Public matched viewer, access/domain authorization; fresh real-property demo |
| World rendering / cameras | R3F, third/first/monitor/dollhouse, warm procedural café | Better composition, camera clipping, occlusion, touch and premium visual quality |
| Realistic stylized characters | First pass improved at f2423ba | More believable silhouettes, distinct faces/clothing, expressive motion; production screenshots and real-device budget |
| Order → brew → carry → serve | Local and public browser tested | Latest deployed version and actual phone touch; expired-drink recovery in production |
| Customers / inventory / economy | Authoritative simulated queue, stock, receipts, rent and costs | More meaningful staffing/equipment bottlenecks and clear units; no fabricated gains |
| Multiplayer / QR / resume | Public HTTPS/WSS and two browser clients verified | Physical phone scan, touch, restart behavior and newest deploy |
| Build mode / tabletop | Snapped click placement, move/rotate, ghosts, sync and path validation | Direct drag, full-model ghosts, polish; real counter move and measured rerouting on public real floor |
| Jamie manager | Actual Deepagents graph, secure tools and local fallback | Real-provider plan/approve/execute/observe evidence; property-based spatial recommendation |
| Gemini | ChatGoogle adapter and mocked HTTP tool round-trip tests | Real key/model/quota, actual provider run, two-client evidence |
| Photon Messaging | In-app manager only | Actual provider iMessage or approved channel, signed callback, verified pairing |
| Photon Voice | Crew WebRTC and local UI prototype | Actual telephone call on Photon number with real speech and approved action |
| Capital One Nessie | Local ledger, old optional adapter | Current sandbox endpoints, reconciliation, exact-ID safe mirroring, verified remote transactions |
| Director / rush scenarios | Local rule events, validated operational changes | Ensure choice text reflects actual effects; run causal outcome comparison |
| Rival café / time machine | Client heuristics, illustrative labels | No fake A/B or actual competitor; reproducible replay only if time |
| Launch blueprint | Markdown generation/download | Verify actual layout/receipts/provenance and actionable caveats; final demo export |
| WebXR / Vision Pro | Optional session/dollhouse path | Headset rendering/input unverified; do not claim tested VR; not a blocker |
| Render | Prior public game and transport verified; single-service config | Latest SHA, secrets/real data, cold-start and physical phone |
| Submission | Strategy documented | Public repo review, actual eligible entries, video and in-person judging |

### Recorded proof

- [Public gameplay](screenshots/public-gameplay.png), [public service](screenshots/public-served.png), [public build](screenshots/public-build.png), [phone-sized viewport](screenshots/public-phone.png), [public assertions](screenshots/public-verification.json): software WebGL Edge, desktop + second 390x844 browser, zero JS errors, one $10 mocha with one milk/cup/bean consumed, two-client plant placement, wss://playitfirst.onrender.com/ws. NOT a physical phone scan or measured floor proof.
- [Character gameplay](screenshots/character-gameplay.png), [character assertions](screenshots/character-verification.json): local rebuilt game, one $9 americano, milk unchanged, one bean/cup, two-client placement. First art pass, not commercial-quality final.
- [Manager plan](screenshots/manager-plan.png), [approved actions](screenshots/manager-approved.png), [manager trace](screenshots/manager-verification.json): local rules, $35 restock and free menu change, two clients. Actual framework tested with scripted model; providerVerified false in browser evidence.
- Measured suite evidence in ignored .sponsor/measured-* files; source/geometry counts in PROGRESS.md. 44-waypoint entry-to-counter path, one $9 cold brew, local measured-floor tests and two-client build. No restricted screenshots or raw data committed.
- Original QA #4 / PR #5 regression findings fixed and issue #4 closed. Keep those tests: no empty-handed sale, no clock-minted cash, duplicate collection, negative restock, path through stations, repeated brew or invalid placement.

## 3. User journey and game acceptance (P0)

### 3.1 Landing and property selection
- One polished landing screen, play/host/join and Judge demo prominent. No login or unnecessary form. Display accurate branding, accessible keyboard and touch controls, concise instructions and credible source badges.
- Choose actual available retail lease space from event data when configured. Preview its own Matterport model before selection. Clearly label mock listings and unrelated fallback walkthroughs. Display real asking terms, rentable area, source, and assumptions. Do not claim restaurant permitted use without evidence.
- Walkthrough-to-game transition is the product reveal. The playable map matches the captured suite, not an arbitrary rectangle. If external iframe is unavailable, say so and use authorized reconstruction; do not pretend it loaded.
- Fresh demo creates a disposable room, selects authorized extract preferentially when available, opens café, primes manageable rush, positions host near order station, reserves first sale for human. Audit stale Midtown copy in demo.ts and other UI. No fake sales or automatic completion before judge acts.

### 3.2 Service, economy and co-op
- WASD/mouse or phone touch movement; E/Space contextual action; clear primary prompt and nearby station highlight. Maintain camera views, useful orientation and collision. No keyboard-only essential step on phone.
- Customer enters via valid door, queues, shows readable order and patience. Take a valid ticket at counter, walk to machine, brew with visible timer/steam/audio, hold a matching cup, deliver at valid pickup/customer, get a single receipt and satisfaction feedback. Guest exits via valid route. Repeat without stuck interactions.
- Server is authoritative: ticket ownership, valid station reach, inventory and affordability, elapsed sim time, actual receipt and finance mutation. Never let optimistic UI mint money, overwrite held drink, duplicate brew/sale or bypass path checks. Expired drink clear at service station discards without refund or sale. Keep Jamie from stealing first order; later assist must perform legitimate actions.
- Owners and baristas share live room, orders, layout, inventory, financial state. Role changes and actions authorized server-side. QR generated from real HTTPS origin, not localhost; resume retains same member. A new room resets session. Do not promise durable saves.
- Cash and expenses include rent/equipment/inventory; actual simulation consumes cups/beans/milk as appropriate. Queue, wait, served, revenue and satisfaction derive from events/ticks, not direct AI metric changes. Display elapsed-time unit, measured vs projected revenue, and simulated assumptions.

### 3.3 Build mode and operational causality
- Tab/toggle opens local editor and simple isometric/monitor camera; unobtrusive catalog, valid/invalid ghost, rotate, snap, move existing object. Add direct dragging when safe; full-model ghost preferred over box. Keep other players serving while editor is open.
- Shared world accepts only finite coordinates inside measured room polygons, respecting wall/door geometry, station clearance, furniture overlap, cost and service route connectivity. Reject sealed entrances/counter routes, explain rejection without charging.
- Show a counter/pickup or machine move, both clients update, customer path changes in actual navigation. Demonstrate concrete route distance/time or queue/wait measurement on comparable simulated conditions. Do not call a plant sync alone proof of improved customer routing.
- Preserve tabletop and dollhouse as optional intuitive spatial editing/review. Keep finance/manager/crew/analytics/blueprint behind Menu; no huge permanent dashboard or full-screen interruption in the service loop.

### 3.4 Visual quality (owner priority, P0 alongside functionality)
Original reference is a polished commercial-style café game, not stock or generated art passed off as our output. Current first character pass has toy-like meshes, varied skin/hair and features, articulated shoulders, hands/shoes, clothing details and movement-based bob. Still short of reference.

Next work: use cohesive licensed/attributed low-poly humanoid assets or improve existing modular meshes if faster; do not rip copyrighted game models. Verify license for public repo/redistribution. Proper torso/head/limbs and proportions, hair silhouettes, eyes/brows/face, skin tones and 4–6 distinct clothes/palettes, barista apron vs guests, natural facing, foot contact and walk speed, idle/queue/order/carry/serve gestures. Reuse geometry/materials where possible. Avoid expensive rigging project if it threatens deadline; prioritize actual silhouette at gameplay camera distance.

Improve storefront/café composition: warm daylight key and soft fill, restrained contact shadows, depth and material roughness, wood/sage/plaster palette, espresso machine with clear silhouette, POS, pastry case, cups/shelves/trays, matching chairs/tables, plants/menu signage/pendants, believable windows and restrained outdoor detail. Use original art and measured structure; game wall materials/heights and furniture are assumptions. No expensive full-screen effects that tank phone performance. Camera should not see through ceiling/exterior, hide foreground walls appropriately and keep service readable.

HUD: compact cash/served/active order, clean contextual prompt and controls; order bubbles avoid overlaps, restrained notifications, accessible contrast and text, responsive viewport, audio unlocked by user. Remove stale sponsor labels on local mock UI (notably any Photon-branded simulated call). Use status in the menu, not giant sponsor banners. No claim of commercial quality until actual before/after captures and human playtest.

Acceptance: desktop actual keyboard service, physical phone touch service, build edit, screenshots of live game (not inspiration images), no console errors, reasonable actual device FPS/load time; record device and conditions. Preserve functionality under low-end rendering and fallback.

## 4. Real property: CoStar + Matterport (issue #7)

Event requirement: meaningfully combine at least two authorized data layers for the same building, from CoStar commercial data, Matterport and optional Vexcel. CoStar score rubric in handbook: data 30, agentic 30, utility 25, polish 15. We already have two layers; Vexcel is optional, only use if actually valuable (parking/entrances/access) and authorized.

Implementation: scripts/import-costar.py joins the event suite attachment to its property/model CSV and verifies model by authenticated GraphQL. scripts/measured_floor.py converts one captured floor, all rooms and physical walls/openings into translated meter coordinates. shared/floorplan.ts and server/navigation.ts apply physical collision and pathfinding. CafeScene reconstructs with original animated art. No original scan textures/mesh exported or copied. Multi-floor captures explicitly unsupported; whole captured single-floor suite, not whole unscanned building.

Local verified example: suite 104, 2,946 rentable sq ft at $45/sq ft/year = $11,047.50 monthly base asking rent, excluding extras; captured scan area 228.0032 m², 12 room polygons, 66 physical walls, 11 doorway openings, 4 windows. Opening game funds after rent/equipment $4,842.50. The six invisible room boundaries aren't solid walls; wall spurs remain physical. Actual listing/model IDs already recorded in DEPLOY/PROGRESS; don't copy private records into additional public files. Capacity/foot traffic are assumed or simulated; scan area and rentable area distinct. Standard wall heights/materials, selected operating entrance and equipment placement are design choices, not sourced facts.

**Remaining gates**
- [ ] Confirm sponsor permission for publishing normalized geometry, listing information and walkthrough on public demo, and any separate external model processing.
- [ ] Deploy authorized ignored .sponsor/property.json (~40 KB) as Render secret file property.json; COSTAR_DATA_FILE=/etc/secrets/property.json. Never commit the source archive, raw API responses, normalized private file or credentials. Note clients receive property data despite secret-file storage.
- [ ] Server MATTERPORT_API_KEY + MATTERPORT_TOKEN; matched /api/matterport endpoint must return matterport-live with exact model, not a boolean or showcase fallback. SDK localhost-only key needs public domain authorization if using SDK; current panel is iframe, separately verify viewer access.
- [ ] /api/integrations reports costar-extract, /api/properties expected matched suite/rent/floorPlan counts, fresh demo selects it, physical phone and laptop complete one order and live shared counter edit. Preserve clearly labeled mock fallback.
- [ ] Manager understands measured constraints and offers an operational choice grounded in them; demonstrate actual outcome. Existing agent inspection is not yet proof of spatial optimization.
- [ ] If using generic COSTAR_API_URL, validate units, required fields and provenance; current adapter can synthesize defaults. Do not label inferred fields sourced or mix stand-in scan with a real listing.
- [ ] Document authorized source use, assumptions, exact evidence and permissions; no invented live data.

## 5. Jamie: Amazon Practical AI Innovation + LangChain (issue #8)

One actual shared manager, not an LLM JSON event generator. Official JS deepagents and LangChain installed; server/manager-runtime.ts uses createDeepAgent and four typed business tools. server/manager.ts uses room-scoped authorized actor and fresh reducer updates. Local director remains separate deterministic fallback. Amazon permits model/provider flexibility per handbook; AWS not required. LangChain requires actual Deepagents. Google support is in 4b36e2a and later guard; do not require a new OpenAI/Anthropic subscription.

Existing tools: get_cafe_state (fresh state/property/queue/ledger/stations), propose_action (reorder_supplies $35 or simplify_menu $0), execute_approved_action (only exact approved ID), read_outcome (fresh state and receipts). Owner identity from authenticated WS or verified external pairing, not text; owner proposals expire after two minutes, budget rechecked, repeated approval returns same receipt, no stale snapshot writes. Four model turns/20-second run limit, no background model polling or retries; restrict built-in filesystem/delegation/shell tools. Existing framework tests exercise these safeguards. Do not let model invent gains, order unapproved purchases or overwrite metrics.

Desired demo: rush/low stock → inspect actual constraints and cash → plan → propose exact replenishment → owner approval → actual stock/cash receipt → read outcome and explain next step. Existing $35 local purchase adds 12 milk, 20 cups, 15 beans; local demo observed 24→36 milk, 40→60 cups, 30→45 beans. A free menu simplification changes future orders. A second spatial/staffing suggestion should be useful and validated, not claim arbitrary reassignment is implemented. If extending tools, use existing reducer, schema, affordability/authorization and tests. Measure outcomes across comparable runs if claiming improvement.

- [ ] Configure GOOGLE_API_KEY (GEMINI_API_KEY alias); current provider precedence Google > OpenAI > Anthropic. DEEPAGENTS_MODEL override must match chosen provider; default Gemini model in code gemini-3.6-flash, verify actual project availability/function calling/quota. Use capped key and available sponsor credits.
- [ ] Run node --import tsx scripts/check-gemini-manager.ts on synthetic property with real key, then actual two-client provider interaction. Record provider trace, plan, approved receipt, duplicate/guest rejection and read_outcome; distinguish adapter mocked HTTP from real call.
- [ ] Keep ALLOW_SPONSOR_MODEL_CONTEXT=false unless sponsor explicitly authorizes external processing. Imported/live rooms use local manager rules by default even with key. Free model services may use data to improve products; confirm terms/permission. Do not remove guard to manufacture sponsor demo.
- [ ] If authorized, demonstrate real-property context with minimal necessary data; otherwise clearly separate real-property local demo and synthetic live-agent demo. CoStar agentic score still needs meaningful authorized real-property agent use.
- [ ] Update docs/status from actual receipts and results. No secret keys in client, logs, GitHub or screenshots.

## 6. Photon Messaging and Voice (issue #9, two tracks)

Current crew WebRTC, in-app Jamie chat and simulated call are NOT Photon. Legacy UI naming is misleading if shown as real external service; relabel or hide. Do not conflate local crew calls with telephone calls.

Use actual event Photon 2.0 onboarding and documented beta provider APIs; see issue #9 for event guidelines/links. Ask sponsor for real iMessage identity/channel, voice-capable number, authentication/signing and SIP/streaming requirements. Confirm which channels qualify and whether both prizes stack. Use sponsor credits and budget limits. Don't invent endpoints, environment variable names or provider capabilities. Existing public Render host receives HTTPS callbacks; no additional hosting architecture.

Implementation contract:
1. One provider adapter per channel; inbound event signature/official authentication, payload limits, dedupe IDs, rate limit, timeout; verified delivery result. Pair sender/caller to room with expiring short code + owner approval, revocable mapping. Reject guest/cross-room/unknown actor, spoofed signatures and duplicate events. No public unauthenticated mutation API or exposure of resume tokens.
2. Translate text or transcribed speech into the existing CafeManager.request/approve/decline with verified ManagerActor. Keep proposal IDs and conversation context. Explicit confirmation before simulation mutations, including cost; do not infer approval from ambiguous text. Reply from actual outcome, not scripted success.
3. Messaging: real external iMessage (or sponsor-approved channel) reads queue/inventory/budget, sends useful proactive alert or requested plan, user approves, game updates and actual message receipt confirms. Keep local manager accessible and crew voice separate.
4. Voice: actual inbound phone call to provisioned Photon number using supported voice/SIP path, natural speech question/response, explicit confirmation, same approved action and spoken outcome; hangup/timeouts/failure safe. Optional outbound call if sponsor supports and user consents; no real purchase or unsolicited call.
5. UI: one pairing/status affordance in manager menu. No separate fake phone app or sponsor dashboard.

Acceptance: real physical phone messages and real telephone audio; provider IDs/redacted evidence, webhook status and game receipt on two clients. Test unauthorized/duplicate/expired action, delivery failure, fallback. If voice provisioning blocked, prioritize messaging; do not claim voice prize fulfilled by WebRTC.

## 7. Capital One Nessie (issue #10)

Goal: turn actual in-game sale and operating purchase into sandbox banking records and a meaningful budget decision. Local finance.ts has stable transaction IDs and validated balance changes, legacy HTTP endpoint, fire-and-forget writes, swallowed failures, fixed $20k initial account and no reconciliation. Adding key alone does not meet this target.

- [ ] Obtain NESSIE_KEY and current event sandbox API/docs; verify HTTPS if available/required, actual account/customer/transaction endpoints and authentication. No real personal info or financial accounts.
- [ ] Provision or link one sandbox account per room idempotently; reconcile initial balance with actual game opening funds/rent/equipment. Local simulation stays authoritative and responsive.
- [ ] Mirror accepted sales/restocks/expenses with stable local transaction ID and bounded queue, record pending/confirmed/failed/unknown status, verify HTTP and response. Never blindly retry ambiguous external write; reconcile first. Redact keys in URLs/logs. Use sandbox merchant/bill/purchase endpoints if meaningful and supported.
- [ ] Show small receipt/balance and sync state in existing finance overlay. Agent checks funds and shares same ledger. No unrelated banking dashboard.
- [ ] Demonstrate one manually served sale and one owner-approved restock, fetched actual sandbox transaction and account balance, exactly-once local/remote effect or explicit discrepancy. Test timeout/failure/retry and duplicate approval. No real money movement.

## 8. Business learning, director and optional differentiators

Local director detects queue rush/reputation/cash/equipment scenarios. Choices must affect real operating state: hire assistance only if it really changes staffing/service, add equipment only if affordable and valid, menu changes future orders, repair/discount/shorter hours only if implemented operationally. Do not directly alter satisfaction/wait/revenue to make AI look good; no double charges. Label scripted/seeded rush as game event, not sourced foot traffic or actual neighborhood event. Human remains in control.

TimelineCompare currently shows explicitly illustrative heuristic ranges and applies validated real furniture actions. Rival score is simulated client heuristic, not real competitor data. If time allows, implement reproducible same-seed, same-demand, same-duration A/B using shared sim and report baseline/alternative outcomes with units and assumptions. Do not use arbitrary percentages as evidence. Preserve current clear labels otherwise. Test suggested placement on irregular measured floor; hard-coded rectangle coordinates can be rejected; derive valid positions rather than bypass collision.

Blueprint: export Markdown from actual selected property, rent/area/provenance, operating assumptions, actual layout/stations, revenue/cost/inventory, measured session outcomes, approved changes/receipts, suggested next steps and unknowns (permits, inspection, lease review, real demand, costs). Verify export on real-property session; no fabricated financial projection or claim of legal compliance. Keep download useful and readable. Optional richer charts/replay/durable saving only after demo complete.

WebXR/AR/VR and dollhouse are optional; actual immersive rendering and hands/controllers require compatible hardware verification, not just requesting a session. Preserve fallback/tabletop. Additional property, Vexcel, game types, economy sophistication and advanced avatar assets are stretch; do not block playable café.

## 9. Architecture, boundaries and hosting

- client/App.tsx and pages Landing/PropertySelect/Game, React + Vite, Zustand, R3F/Three.js; CafeScene, PlayControls, Hud, BuildPanel, Tabletop, optional overlays. Client optimistic movement + authoritative snapshots; frontend never owns money/order truth.
- shared/types.ts, manager.ts, stations.ts, placement.ts, floorplan.ts: contracts, validation and geometry reused client/server.
- server/main.ts: single persistent Node HTTP/SPA/API and /ws, dev Vite middleware. rooms.ts authoritative room state, tick/snapshot, role and resume; simulation.ts, navigation.ts, director.ts actual game. Manager service and runtime are only AI execution path. finance.ts ledger. costar.ts and matterport.ts provider/provenance adapters.
- Keep same-origin /api and /ws; client/lib/api.ts derives WSS from page protocol and QR origin from current page. Do not restore split VITE origin variables. Backend legacy CORS/proxy compatibility kept; audit public mutation/auth boundaries without breaking mobile/proxy use. No auth redesign required for demo.
- Render existing web service, Node 22, npm ci --include=dev && npm run build, npm start, /api/health, PORT injected, auto-deploy main. Runtime tsx needs dev dependencies. No hard-coded credentials. No duplicate service or paid plan. Hrudai owns deployment (#6, @hssannidhi80).
- Remove stale VITE_API_BASE_URL, VITE_WS_URL, VITE_PUBLIC_ORIGIN, FRONTEND_ORIGIN, CORS_ORIGINS if present in Render/local .env. Keep sponsor keys/file. Preserve production URL and QR. Server-only environment via dashboard or ignored .env; no secret VITE_*.
- Free tier sleep/restart clears in-memory rooms; warm service before demo, don't use prohibited artificial keepalive. Test reconnect and fresh room after restart. Confirm Free plan in dashboard, deployed SHA via /api/health.commit or Render Events; older health response may omit commit.
- Run node scripts/check-deployment.mjs https://playitfirst.onrender.com (disposable room; not monitor). Verify HTTPS assets/API, correct QR origin, two WSS clients, edit/rotate and resume. Separate actual WebGL, physical QR/touch, manual sale and real-floor routing tests.
- Never equate repo head with production; post actual SHA, timestamp, provider status and observed evidence. See DEPLOY.md.

## 10. Nine prize targets and submission strategy

| Target | Required evidence / status |
| --- | --- |
| Best Overall | Creative real-world transformation, polished fun game, meaningful problem, judge plays and sees real effects. Strong foundation; polish/production proof remain. |
| CoStar Inside and Out | Two matched actual layers, authentic geometry/economics, agentic improvement and utility. Local data/geometry good; public/agent evidence pending. |
| Amazon Practical AI Innovation | Useful agent reasoning/planning/action/adaptation, creativity, utility, implementation and UX. Actual manager framework; live run pending. |
| LangChain | Actual Deepagents graph with real tool workflow. Framework installed, tests pass; real provider proof pending. |
| Photon Messaging | Real supported external provider messaging, preferably iMessage. Not implemented. |
| Photon Voice | Actual telephone/voice agent using Photon. Not implemented. |
| Capital One | Real Nessie sandbox account and transactions powering business decision. Partial. |
| SpaceXSI | Actual core Cursor usage + Grok Bot workflow automation, describe both and raffle opt-in. Prior Cursor use; eligibility/Grok still unverified. |
| Main track | Proposed Business and Enterprise: entrepreneurial utility through game. Confirm exact submission category. |

ChatOverflow explicitly excluded. Vision Pro/WebXR and Vexcel optional features, not extra prize targets. Handbook says multiple special tracks allowed, exactly one main track, Best Overall automatic; main-track winners cannot also receive Best Overall; CoStar explicitly stackable. Confirm exact eligibility and other stacking rules with organizers, no claim of nine guaranteed prizes. SpaceXSI issue #11: verify whether earlier substantial Cursor use plus local Codex now qualifies, create useful genuine Grok Bot automation (redacted build/test QA summary), opt in if eligible. No private source/secrets sent to external bot without authorization. Stop if unavailable; focus game.

Deadline: handbook Sunday Nov 15 8:00 AM ET; event listing previously displayed 8:30 AM. Use earlier 8 AM deadline and verify organizer announcements. Two-minute demo, in-person judging, Discord usernames per handbook. Public GitHub requirement: audit full history, restricted sponsor files, keys and asset licenses; owner explicitly approves switch. No secret values in Devpost, screenshots or public docs. Do not submit unsupported sponsor claims. Prepare short video/demo backup with actual screenshots and verified recording; preserve honest fallback if provider fails.

## 11. Two-minute judging flow (rehearse actual build)

0:00–0:15 — Hook: Before every grand opening, there's a soft opening. We built one you can play. Explain signing a lease without knowing how the business will operate.
0:15–0:35 — Real property listing and matching scan; show captured floor becomes animated café, actual rent affects starting cash. If public real data not deployed, use authorized local demonstration and label public mock.
0:35–1:00 — Judge joins from QR/phone and takes/brews/serves one order; second person operates same floor. Show receipt and inventory change, not menus.
1:00–1:20 — Move pickup/counter while another serves; show both screens update and actual customer route difference. Use measured outcome only if observed.
1:20–1:45 — Rush/stock issue; Jamie reads live state, proposes and executes an owner-approved $35 delivery, observes new state. If real Photon/Nessie ready, demonstrate actual message or short call and verified ledger receipt within the same action. Only show confirmed features; avoid waiting on slow external call. Use real prerecorded evidence if needed.
1:45–2:00 — Show the launch blueprint and close: Your grand opening starts when you play it first. Emphasize the learning benefit rather than sponsor names. Separate sponsor judges can see technical trace, real provider receipts, source matching and longer demos.

Rehearse with actual laptop and phone, warm Render, prepare a fresh room, correct property, volume, visible controls, no stuck held cup, accurate fallback labels. Do not rely on someone else's internet or an external call to finish the main pitch. Have recorded evidence ready. Keep demo under two minutes, no fabricated footage.

## 12. Work order, owners and definition of done

Run independent workstreams in parallel. Hrudai is the only formally assigned deployment owner; other assignments require team coordination, not assumed names. Farhan/local Codex lead game/art and manager, designated teammate real-property data/authorization, another external providers; share interfaces and avoid concurrent edits to rooms/simulation/finance. Do not launch cloud agents.

**P0 release gates**
- [ ] Owner/Hrudai: confirm current Render SHA, latest clean deployment, free plan, public health and smoke; configure authorized property file and Matterport keys; physical-phone QR/touch and latest measured café.
- [ ] Game/visual: real human service with no stuck item, two-player shared counter move and reroute, attractive characters/camera/environment/HUD. Actual screenshots and performance on phone. Preserve first sale for human.
- [ ] Property/agent: confirm permissions, public exact property, real viewer, live Gemini synthetic test, authorized real-property reasoning if allowed; tool receipt and two-client update.
- [ ] Fix blockers in tested paths, no major architecture replacement. Each agent reads AGENTS.md and this file before touching code.

**P1 parallel sponsor gates**
- [ ] Photon Messaging then Voice real provider onboarding/verified callback/pairing/approved action; escalate provisioning early.
- [ ] Nessie correct sandbox integration and reconciliation; one verified sale and purchase.
- [ ] SpaceXSI workflow/eligibility, submission, evidence, public repo audit, final pitch.

**P2 only after vertical slice:** direct dragging/full ghosts, seeded replay, additional property/Vexcel, advanced XR, more business types, durable saves. Do not let P2 or extra integrations displace game feel or required testing.

**Release definition:** actual real building (authorized), playable manual order, two real clients/phone, shared edit with measurable operational impact, actual Deepagents provider action or clearly labeled fallback, external sponsor claims only with proof, blueprint, honest two-minute demo. Run npm test, npm run typecheck, npm run build; for geometry python -m unittest discover -s scripts -p 'test_*.py'; public smoke; record exact commands, commit, actual outputs, screenshots and remaining limitations. Update PROGRESS.md and relevant issue. No fake completion, no closing issue solely because key/config exists.

Issue map: [#2 vertical slice](https://github.com/farhanmir/PlayItFirst/issues/2), [#4 QA closed](https://github.com/farhanmir/PlayItFirst/issues/4), [#6 Render](https://github.com/farhanmir/PlayItFirst/issues/6), [#7 property](https://github.com/farhanmir/PlayItFirst/issues/7), [#8 agent](https://github.com/farhanmir/PlayItFirst/issues/8), [#9 Photon](https://github.com/farhanmir/PlayItFirst/issues/9), [#10 Nessie](https://github.com/farhanmir/PlayItFirst/issues/10), [#11 SpaceXSI](https://github.com/farhanmir/PlayItFirst/issues/11). Older issue bodies are historical where superseded by this plan and owner comments.
