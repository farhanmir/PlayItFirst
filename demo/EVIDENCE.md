# Play It First demo: evidence manifest

Every frame of gameplay is a screen capture of the deployed app (playitfirst.onrender.com), taken with real inputs. There are no injected states and no mocked results. The raw clips (`raw/*.mp4`), capture scripts and per-clip notes live in the video production workspace and are not committed here.

| Claim on screen / in VO | Source |
|---|---|
| "Nearly half of new businesses … closed within five years" | U.S. BLS Business Employment Dynamics: 49.4% of establishments born in 2013 were not operating in 2018. Correlation only; the video claims no causation. |
| 2600 Travis St · Suite 104, $11,047.50/mo, 2,946 sq ft | CoStar extract in repo data (`costar-1018657-21963212`). Real listing. |
| 12 rooms / 66 walls / 15 openings, Matterport model 4H2JSnQ3wSj | Generated blueprint for the same property (`raw/blueprint.md`, picker capture). |
| $20,000 starting capital, $4,110 equipment, $4,842.50 opening cash | In-game ledger, real property (`raw/service*.mp4`, picker). |
| Order → brew → serve; +$7 sale | `raw/service3.mp4` (sale at 47.0 s). |
| Co-op: counter moved, customers rerouted | `raw/coop-host.mp4` + `raw/coop-partner.mp4`, two clients; `raw/coop-routes.json`. |
| Jamie = LangChain Deep Agents + Claude Opus 5.5, proposes → approval → executes → verifies | `raw/manager*.mp4`, `raw/jamie3.mp4`; providerVerified true. Live runs only on the fictional property `hou-eaado-41`. |
| $35 restock, milk 24→36, cups 40→60, beans 30→45, receipt c07b011d | `raw/manager-restock.mp4` (fictional property). |
| Nessie: $7 deposit, 13 confirmed, $2,800 recurring rent bill | `raw/nessie.mp4` (`capture/nessie.mjs`), Capital One Nessie v2 sandbox, fictional property. No real money. |
| Grok customer bubbles + "What customers noticed" tallies | `raw/grok.mp4` (`capture/grok.mjs`); live minds active, 48 answered / 0 failed. Only generic café counts are sent to xAI. |
| Launch blueprint | `raw/blueprint.mp4`, `raw/blueprint-*.png`. |
| "Today, a café. Tomorrow, your business." | Shown as platform vision only. Only the café template exists. |

## Excluded on purpose
- **Photon** (iMessage/voice): not verified (deliveryVerified false), so it does not appear.
- No restricted real-property data was sent to external models (ALLOW_SPONSOR_MODEL_CONTEXT=false).

## Open before publishing
- The real CoStar listing and Matterport scan footage (cold open, property section, gallery images 1–4) needs sponsor permission to publish. See `docs/RELEASE_AUDIT.md`.

## Production
- VO: Gemini TTS (voice Puck). Music: Lyria. Edit: Remotion. Captions: faster-whisper alignment.
- Deliverables: `play-it-first-demo.mp4` (1080p30 H.264/AAC, 114 s), `play-it-first-demo.srt`, `play-it-first-vo.wav`, `transcript.md`, `thumbnail.png` (1280×720), `gallery/` (7 × 1500×1000 PNG).
