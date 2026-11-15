# Owner request audit — public c954369, November 14 evening ET

This audits the owner's requests, not merely whether code exists. Fresh public desktop and phone-emulated clients loaded the current bundle. The service worker stores only offline.html. The owner's fresh-tab report is not dismissed as stale cache. Physical iPhone acceptance remains unverified.

| Owner request | Verified scope | Remaining gap |
|---|---|---|
| Safely fetch, preserve teammates, push main | Merged e03509d into local work; c954369 pushed and served by Render | Follow-up audit corrections are recorded separately below |
| Production-quality visuals and UI | Animated GLBs, character variation, lighting/materials, compact HUD, menus and actual full-viewport play exist | **Partial:** measured property still looks sparse; not equivalent to cozy mock-cafe art quality, and not owner-accepted |
| Match Matterport almost exactly | Sourced rooms/walls/openings/heights and coordinate correction; public measured kitchen service works | **Partial:** original interior furnishings, ducts, beams, detailed finishes and full captured appearance are not reproduced. Requires more authorized source data; do not call this an exact digital twin |
| Smooth movement and facing | Prediction/reconciliation and movement-facing fixes preserved; public keyboard/touch movement and release verified | Physical-device performance and perceived smoothness not verified |
| Different faces and believable characters | Five hair styles, varied skin/hair/build/face proportions and animated rigs preserved | Visual quality remains a human acceptance question |
| Remove face card / floating coffee | Rigid apron panels removed; hand-bone grip and non-accumulating pose tested locally; public complete service clears held item | First-person ticket/brewing prop is absent; only finished drink has first-person hand model. Public screenshots still show large world labels |
| Jamie as a real character | Public measured cycle verified: takes ticket, walks to Kitchen, brews, carries to pickup, serves same customer; one $9 receipt | Starts a new task only after first human sale plus 18 seconds of inactivity. Public cycle completed in30.8s observation with20.1m travel and no human gameplay input |
| Actual cafe order loop and useful pickup | Public keyboard take → measured Kitchen brew → pickup serve earned $10 once, deducted inventory, cleared hands | Pickup fallback to counter exists only when no pickup station is present |
| Build/move in Orbit | Public desktop/phone-emulated Orbit drag changes camera without furniture mutation; exiting clears move selection | Physical touch acceptance pending |
| Meaningful shared furniture effects | Two live public clients observed same customer reroute after counter moved 1m | Proves route change, not faster service or improved efficiency |
| Business staffing/capacity consequences | Cash/stock purchases, expenses, layout routes and approved spatial action exist | **Partial:** hiring another independently concurrent worker and increased manual brew capacity are not implemented/proven. Menu reduction does not shorten fixed manual brewing |
| Entrance/exit | Measured source-aligned signs/openings, demo exterior-wall openings, customer routes | No playable outdoor area; players remain inside level boundary |
| More properties | Public catalog has real suite + EaDo Maker Bay + Arts District Loft Retail | Two additions are explicitly fictional practice spaces, not additional measured CoStar properties |
| Leave hides character, accidental reconnect keeps state | Disconnect hides avatar; exact room URL/same browser resume preserves player and state; public refresh no duplicate | In-memory reconnect window is five minutes after last disconnect; server restart is not a durable save. No dedicated Leave button |
| Fit desktop and phone without scrolling | Public1440x900 and393x852 exact canvas fit; local build/drawer focus regression corrected | Start page was missed in the first pass; subsequent correction passes12 default/Host/Join checks at desktop16:9 and phone sizes. Physical iOS safe-area/keyboard behavior pending |
| PWA and phone controls | Manifest, offline fallback, home-screen instructions, touch joystick/camera controls implemented | Browser emulation does not prove actual installed iPhone experience |
| Natural music/sounds | Licensed recorded cafe sounds and quiet attributed music replace synth effects; separate synth ambient removed | Subjective listening acceptance on phone pending |
| Actual Gemini/Deepagents actions | Existing graph/tools/approvals preserved; previous live evidence remains historical | Latest public run failed HTTP429 after reading fictional state. No new execution claim; cash/inventory unchanged |
| Actual Photon Messaging/Voice | Signed webhook and bounded inbox paths merged with exclusive selection; owner/context/activation safeguards, voice-tool route | **Not live:** public configuration incomplete; no phone message or call acceptance |
| Nessie V2 | Advanced adapter preserved, teammate opt-in activation merged | No key/live bank verification; owner asked to defer key |
| Useful launch blueprint | Existing actual-property/layout/cost/results/assumptions export preserved | No new public measured export verification in this audit |
| SpaceXSI, pitch, submission, public repo | Pitch/release audit documentation prepared; repository remains private | Qualification, entry, rehearsal, final submission, rights clearance and visibility approval incomplete |

## Evidence

- [Public Jamie service](screenshots/public-jamie-service-c954369.json)
- [Public service](screenshots/public-service-c954369.json)
- [Public two-client counter reroute](screenshots/public-reroute-c954369.json)
- [Fresh public UI](screenshots/public-ui-c954369.json)
- [Public keyboard/touch input](screenshots/public-input-c954369.json)
- [Provider quota failure](screenshots/provider-public-c954369-quota-verification.json)
- [Build camera and viewport](screenshots/build-orbit-viewport-verification.json)

Restricted measured-property screenshots and raw geometry were kept outside Git.

## Concrete corrections found during audit

`fc3e623` removes unsupported temporary-worker claims/charges, checks actual placement before reporting a second station, removes invented staff reassignment, and explicitly labels fictional Matterport previews as unrelated stand-ins. It does not implement a new staffing engine.
