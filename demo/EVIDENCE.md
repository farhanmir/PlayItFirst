# Play It First demo: evidence manifest

Every frame of gameplay is a screen capture of the deployed app (playitfirst.onrender.com), taken with real inputs. There are no injected states and no mocked results. The raw clips, capture scripts and per-clip notes live in the video production workspace and are not committed here.

Gameplay is filmed in the **Play Demo café** (Midtown Corner Suite, `hou-midtown-1204`), a labeled fictional practice property ($4,200/mo fixture rent, 980 sq ft). The property section shows a real CoStar listing and its Matterport scan. Live build at capture: `e01c36c`.

| Claim on screen / in VO | Source |
|---|---|
| "Nearly half of new businesses … closed within five years" | U.S. BLS Business Employment Dynamics: 49.4% of establishments born in 2013 were not operating in 2018. Correlation only; the video claims no causation. |
| 2600 Travis St · Suite 104, $11,047.50/mo, 2,946 sq ft | CoStar extract in repo data (`costar-1018657-21963212`). Real listing. |
| 12 rooms / 66 walls / 15 openings | Measured floor plan of the same property (picker capture). |
| Opening budget: $20,000 − $11,047.50 rent − $4,110 equipment = $4,842.50 | In-game ledger for the real Travis suite (picker capture). In the Play Demo café the same rule gives $11,690. |
| Order → brew → serve; +$9 sale | `m-firstperson.mp4` (sale at 14.0 s). |
| Co-op: invite QR, partner joins, counter moved, customers reroute | `m-coop-host.mp4` + `m-coop-partner.mp4`, two clients; `m-coop-routes.json`. |
| Jamie = LangChain Deep Agents + Claude Opus 5.5: proposes → owner approves → executes → verifies | `m-manager-restock.mp4`, `m-manager.mp4`, `m-jamie3.mp4`; providerVerified true. |
| $35 restock, milk 24→36, cups 40→60, beans 30→45, receipt adb55d0c | `m-manager-restock.mp4` (executed at 41.6 s). |
| Pickup move proposal, route 2.7 → 1.2 units | `m-manager.mp4` (proposal 50.6 s, approved 53.9 s). |
| Nessie: $7 deposit, 13 confirmed, $2,800 recurring rent bill | `nessie.mp4`, EaDo Maker Bay practice room (same café style), Capital One Nessie v2 sandbox. No real money. |
| Grok customer bubbles + "What customers noticed" tallies | `m-grok.mp4`. Only generic café counts are sent to xAI. |
| Launch blueprint: 11 served, 14 walked out, 10.1 s average wait | `m-blueprint.mp4`, `m-blueprint.md`. |
| "Today, a café. Tomorrow, your business." | Platform vision only. Only the café template exists. |

## Excluded on purpose
- **Photon** (iMessage/voice): not verified (deliveryVerified false), so it does not appear.
- No restricted real-property data was sent to external models (ALLOW_SPONSOR_MODEL_CONTEXT=false).

## Open before publishing
- The real CoStar listing and Matterport scan footage (cold open, property section, gallery image 2) needs sponsor permission to publish. See `docs/RELEASE_AUDIT.md`.

## Production
- VO: Gemini TTS (voice Puck). Music: Lyria. Edit: Remotion. Captions: faster-whisper alignment.
- Deliverables: `play-it-first-demo.mp4` (1080p30 H.264/AAC, 114 s), `play-it-first-demo.srt`, `play-it-first-vo.wav`, `transcript.md`, `thumbnail.png` (1280×720), `gallery/` (7 × 1500×1000 PNG).
