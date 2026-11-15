# Pre-publication audit — November 15, 2026

**Result: publication clearance is incomplete.** The repository remains private. This audit did not change visibility, publish a submission, remove files, rotate credentials, or rewrite history.

## Scope and methods

Baseline inspected: `3422a17` on `main`; concurrent working-tree development was present. GitHub CLI reported `farhanmir/PlayItFirst` visibility `PRIVATE`. Local history reachable through `git rev-list --all` contained **107 commits, 623 text blobs and 40 binary blobs** at scan time. The tracked-file inventory contained 206 files. Later commits and newly created files require a repeat scan before publication.

`gitleaks` was not installed. A local Python scan read every reachable text blob using `git cat-file` and checked private-key headers, GitHub tokens, Google API keys, OpenAI/Anthropic token formats, AWS access identifiers, credential-bearing URLs and quoted credential assignments. It found **zero matches** for those patterns. A broader credential-name/long-string heuristic also flagged documentation environment names and package metadata; these are not proof of credentials. No secret values were printed or sent to a service.

This is a bounded pattern audit, not a guarantee that no secret exists. Binary contents were excluded from text scanning; screenshots were not exhaustively OCR-scanned. Unreachable/deleted Git objects, remote-only refs not fetched locally, GitHub issues/PR attachments/actions artifacts, Render secret values and local ignored files were outside this scan. No live credential validity checks were attempted.

## Credentials and private source files

- `.gitignore` excludes `.env`, `.env.*` except `.env.example`, `.sponsor/`, and `costar-hackathon-kit.zip`. `git check-ignore` confirmed the local environment, normalized sponsor path and archive path are ignored.
- `.env.example` has empty credential assignments and `ALLOW_SPONSOR_MODEL_CONTEXT=false`; the documented Nessie URL is not a credential.
- No tracked historical `.sponsor/` or non-example `.env` paths were found among reachable objects. No sponsor archive was found in the tracked historical filename inventory.
- `data/properties.json` is the bundled mock listing collection; it must remain explicitly labeled mock in the product. Its presence is not evidence of sponsor redistribution authorization.
- A clean secret-pattern result does not establish that sponsor data is absent: documentation and visual evidence contain information derived from the real suite.

## Sponsor publication gate — unresolved

The repository already contains matched listing/model identifiers, suite information, asking terms and geometry counts in `docs/PROGRESS.md` and `docs/DEPLOY.md`. The historical introduction is visible in commit `38175bf` (`feat: import matched CoStar suite and verify live Matterport metadata`). Newer measured-building verification records also exist, including `docs/screenshots/public-motion-fidelity-verification.json` at `a037549`, alongside screenshot evidence of the game.

These references are not API credentials, but their public redistribution rights are a separate question. The normalized `.sponsor/property.json` being ignored does not clear the documentation, reconstructed-layout screenshots, model link, public API response or walkthrough for publication. Prior successful viewer access also does not establish permission.

Before making the repository public, obtain and record the sponsor's explicit permission scope for:

1. Listing metadata, asking terms and source/model identifiers in source history and documentation.
2. Derived geometry, floor-plan imagery and screenshots of the reconstructed suite.
3. Public Matterport links/iframe walkthroughs and the data exposed by the running demo.
4. External model processing, separately from public display or repository distribution.

If permission excludes existing historical material, prepare a concrete redaction/history-remediation proposal for owner approval. This audit did not remove or rewrite anything. Do not treat a current-file-only deletion as removal from Git history.

## Asset licensing and provenance

- `public/models/crew/LICENSE.txt` identifies Kenney Animated Characters 3 (1.1) as **CC0**. `README.md` records the source archive, creator, conversion to glTF, included human skins, and original license. These two files provide local provenance for the two tracked character GLBs introduced at `8c7e20b`.
- The recorded OpenGameArt source could not be re-fetched by the browser tool during this audit (restricted-URL fetch error). Thus the original bundled license was inspected, but independent source-page revalidation was not completed.
- `public/assets/cafe-preview.png` was introduced at `3fd88f8`; progress notes identify the landing preview as actual demo-café imagery. Verify its exact source scene and property publication scope alongside the screenshot inventory before public release.
- Application icons and original procedural graphics are tracked. No exhaustive authorship or binary provenance audit was performed for every image.
- No root project `LICENSE`/`COPYING` file is tracked. Decide the intended source-code license with the project owners; this audit does not choose one. Asset CC0 status does not automatically license the application source or sponsor data.
- `index.html` loads Fraunces and Manrope through Google Fonts; no corresponding font files are tracked. Dependency licenses and any production distribution notice obligations were not exhaustively inventoried.

## Submission readiness — not submitted

`docs/HACKATHON.md` supplies the pitch and a proposed nine-target checklist. It is planning material, not evidence of submission or prize eligibility. Its statement that the last public property was mock is stale relative to newer measured-property evidence; reconcile it against the latest verified deployment before using the pitch.

Remaining checks include owner approval of public visibility, sponsor permission and historical-material review, intended source license, latest deployed SHA and public smoke results, physical-phone QR/touch and performance, manual paid service and shared counter-routing evidence, provider-specific prize evidence, exact deadline/category rules from organizers, participant/Discord details, final Devpost fields, and an actual two-minute rehearsal/video. Do not claim Photon, Nessie, Gemini or sponsor acceptance solely because a UI, key, framework or older successful test exists.

## Recommended final publication sequence

1. Resolve sponsor permission and ownership/license decisions; review the concrete set of material that will become public, including history.
2. Repeat credential scanning on the final candidate commit and all intended remote refs; inspect binary screenshots and newly added artifacts.
3. Reconcile pitch claims with current dated evidence and prepare the exact submission for owner review.
4. Obtain the owner's explicit visibility/submission approval, then carry out only those authorized actions.
