# Reframe product requirements

Forge project: https://hackathon.softwareforge.ai/projects/73eb1bec-eb9c-441b-9c0b-5274be5fe10d

Build a standalone UI modernization workbench through Forge. ChatGPT Sites is the preferred hosting destination. This requirements context is not application implementation; record generated artifacts, coding runs and PRs through Forge.

Mandatory sequence: Import -> Evaluate -> Decompose -> Generate a site-specific design system -> Explicit user approval -> Generate and approve each page -> Publish immutable static release.

Hosting update: use a Sites-compatible TypeScript Worker, React/TypeScript, D1 DB and R2 FILES bindings. Import actual screenshot/source evidence bundles. A separate local capture utility may prepare evidence; do not run Playwright inside the hosted Worker. Runtime model provider and budget are unresolved. Missing credentials must produce a clear configuration-needed state, never fake results.
## 5. Bounded MVP

**Input:** one static HTML/CSS/assets bundle with screenshots and source metadata. Include a prepared, clearly labeled Space Jam sample. Live URL capture is optional after the bundle path works; never disguise a prepared import as live crawling.

**Initial output pages:** Home, The Lineup, and Jam Central. Resolve the content-bearing frame documents when preparing the source bundle; a frame wrapper alone is not the complete page. Preserve frame path and image-map destinations in the import manifest.

**Supported replacement components:** site header/navigation, hero, section heading, text section, image, card grid, profile card, gallery, CTA, footer. Search/filter interactions can use tested client-side scripts. Arbitrary legacy scripts, server forms, ecommerce, and general backend migration are outside this first version. Surface unsupported behavior explicitly.

**Canvas:** pan, zoom, fit-to-view, selection, drag/reposition, component crops, source links, simple annotations, and an equivalent list view. No multiplayer, vector drawing suite, or Figma file editor.

**Design system:** one recommended direction with editable tokens and component recipes. A second alternative is stretch work, not required for completion.

**Generation:** real AI-created page specifications constrained to the supported components. A deterministic renderer produces static HTML, CSS, assets, and vetted interaction code. Layouts and component choices vary from the input; they are not a single fixed Space Jam skin. Be explicit that this is constrained static-site modernization, not universal arbitrary-code migration.

**Publishing:** each approved page gets a preview; publishing creates an immutable release with working links and a public URL. Support downloading the same static bundle. An export alone does not fulfill deployment.

## 6. Screens and product behavior

| Screen/stage | Primary content | Primary action | Acceptance condition |
| --- | --- | --- | --- |
| Project/import | Source bundle, detected pages, asset count, sample option | Import site | Clear result, missing-asset warnings, and recoverable failure state |
| Evaluation | Original screenshots, findings, source evidence, identity to preserve | Review evaluation | Every finding has page/region evidence and distinguishes measured facts from AI suggestions |
| Component canvas | Page nodes connected to cropped UI regions; reusable groups | Review components | Clicking a region highlights its source; user can rename/reclassify and mark a mistaken detection |
| Design system studio | Palette, typography, spacing, layout, component previews, rationale | Approve design system | Edits update previews; approval records a complete version and unlocks rebuilding |
| Page studio | Original/candidate switch or slider, device sizes, component mapping | Generate page, then Approve page | Generated page uses the approved design-system version and preserves the reviewed content inventory |
| Release | Page status, route map, checks, version, previous releases | Publish approved release | Fresh public URL works outside the editing session; incomplete pages are clearly handled |

Evaluation categories: navigation discoverability, text readability, semantic structure, responsive layout, consistency, content preservation, and interaction continuity. Do not invent a single “UI score” that implies measured scientific accuracy. Use counts from actual checks and labeled qualitative findings.

Screenshots support visual decomposition; HTML, text, link targets, image metadata, and frame structure support faithful reconstruction. Neither screenshots nor an AI summary alone is enough.

## 7. Design-system generation — the central stage

Inputs: evaluation findings, current brand cues, page/component inventory, preservation priorities, and user intent (for example, “keep the playful space identity while improving readability”).

The model proposes a structured system with:

- Semantic colors: canvas, surface, text, muted text, border, primary action, accent, success, warning, danger, focus ring; foreground/background pairs are explicit.
- Typography: available font families, heading/body roles, size scale, line height, weights, and fallback fonts.
- Spacing and layout: spacing scale, content width, columns, gutters, section rhythm, and responsive breakpoints.
- Shape and depth: radii, borders, shadow levels, and image treatment.
- Motion: transition durations, limited purposeful animation, and reduced-motion behavior.
- Component recipes: navigation, hero, card, button, gallery, text block, and footer, including hover/focus/disabled states where applicable.
- Explanations: which source cue or evaluation finding motivated each major choice.

The user can edit colors, font choices, density, radii, and component variants; each change immediately updates component previews. Show proposed contrast checks next to actual color pairs, not vague accessibility badges.

**Approval rule:** generation is disabled until a design-system version is approved. Each page version records its source snapshot, component map, design-system version, and renderer version. Editing an approved system creates a draft revision. It does not silently restyle published pages. After reapproval, mark affected candidates as needing refresh and offer targeted rebuilding. A release may not mix incompatible design-system versions.

## 8. Clean workbench UI and the demo moment

The workbench should feel calm and precise: warm off-white background, white panels, dark neutral text, one saturated indigo accent, restrained borders, an 8-point spacing rhythm, and strong typographic hierarchy. Source screenshots and generated pages supply the color and personality.

Desktop layout: compact project/stage header; roughly 220px page rail; central canvas/preview; roughly 300px inspector. The inspector collapses on smaller displays. Do not squeeze all three columns onto mobile: use tabs or drawers. Target-site previews must be checked at desktop and mobile widths.

Use one primary action per stage. Keep status vocabulary consistent: Draft, Needs review, Approved, Needs refresh, Generating, Failed, Published. Progress must reflect real completed steps; show retries and cancellation honestly. Empty states explain the next action. Preserve draft edits through navigation/reload.

**Primary wow moment — “from fragments to a working page”:**

1. Show the recognizable 1996 homepage.
2. Reveal extracted navigation, hero, and content regions as cards on the canvas, with lines back to their actual source locations.
3. Open the generated design system and adjust an accent color or card shape. All component previews respond together.
4. Approve the system, generate a page, and animate the actual mapped cards into the new layout after generation finishes.
5. Drag the before/after slider, switch to mobile, then open the published URL.

The reveal is an animation of real source-to-output mappings. It must not fake generation progress or imply that a cached result was generated live. If time or network fails, open a saved completed run clearly labeled as such. Respect reduced-motion preferences.

**Secondary wow moment, only after the core loop works:** revise one shared design token; show affected pages; rebuild them consistently while retaining the prior release.

## 9. Proposed technical architecture

Hosting target is now ChatGPT Sites at the user's request. Runtime model provider and spending information remain unresolved. Use Forge to generate the implementation for this target; Sites is the deployment destination. The platform supports compatible existing projects, durable D1 records, R2 files, and runtime secrets. Exact packaging and deployment must still be verified. [Sites documentation](https://learn.chatgpt.com/docs/sites)

| Layer | Proposed implementation | Reason |
| --- | --- | --- |
| Workbench | React + TypeScript, ordinary HTML/CSS components | One coherent UI and shared types |
| Visual canvas | React Flow custom nodes and controls | Screenshot cards, selection, connections, pan/zoom, and overview without building a canvas engine |
| API/renderer | Sites-compatible TypeScript Worker and deterministic renderer | One language across model schemas, generation, and export; no persistent Node server assumption |
| Capture | Evidence-bundle import; separate local Playwright preparation utility | Actual screenshots and DOM/layout evidence; do not assume a browser can run inside the hosted Worker |
| AI | One vision-capable provider supporting structured outputs; Gemini is a candidate | Analyze screenshots and return schema-validated findings, tokens, and page definitions |
| Metadata | Sites D1 binding DB for projects, approvals, runs, and releases | Durable relational state |
| Files | Sites R2 binding FILES for source bundles, screenshots, and static artifacts | Durable file storage |
| Workbench hosting | ChatGPT Sites | User's preferred hosting destination, with compatibility smoke test first |
| Published output | Separate read-only release viewer backed by approved static files | Public static pages isolated from editor sessions and model credentials; verify cross-site artifact transfer during the smoke test |
| Secrets | Sites runtime secrets | Runtime key stays off the client and out of exports |

React Flow supports custom node content and interaction; that matches this canvas use case. Gemini structured output can constrain response shape, but the application must still validate semantics and preservation. These are implementation choices informed by their official documentation, not already configured services. [React Flow](https://reactflow.dev/learn/customization/custom-nodes), [Gemini structured output](https://ai.google.dev/gemini-api/docs/structured-output), [Gemini keys](https://ai.google.dev/gemini-api/docs/api-key)

Start with request-scoped generation and durable stage records. Never leave a long generation running in an untracked background promise after the request ends. Store started/completed/failed state, request IDs, hashes, and outputs; interrupted work can be retried explicitly. Reuse completed identical requests and reject duplicate publishing. Add a durable worker queue only if observed run times require it.

For the MVP, publishing uploads static files to a versioned release path and exposes them through the separate static-serving origin. It does not require rebuilding our workbench or provisioning a new cloud service per generated page. Released pages require no AI calls when visited. Storage/hosting credentials belong to the application backend; end users do not provide cloud keys for each page.

## 10. Data contracts and server-enforced transitions

Core records:

| Record | Required information |
| --- | --- |
| Project | Name, source type, selected pages, current stage, owner/session |
| SourceSnapshot | Source URL/path, content hash, HTML/text, links, assets, frame provenance, capture dimensions/time |
| Evaluation | Finding category, page/region evidence, severity, observed vs inferred status, recommendation |
| Component | Stable ID, source page/frame, bounding box, screenshot crop, semantic role, reusable group, user corrections |
| DesignSystemVersion | Tokens, component recipes, rationale, draft/approved status, approval timestamp, input hashes |
| PageVersion | Source snapshot, component mapping, approved design-system version, typed layout, generated files, check results, approval |
| GenerationRun | Stage, inputs/version hashes, provider/model, start/end, actual usage when returned, status, error, retry reference |
| Release | Exact approved page versions, route/asset manifest, output location, public URL, health result, previous release |

Server rules: cannot generate a page without an approved system; cannot approve a page whose inputs have changed; cannot publish drafts or stale pages; edits cannot overwrite immutable approved versions; client controls do not replace server checks.

Proposed API surface: create/import project; evaluate; list/correct components; propose/update/approve design system; generate/check/approve page; publish release; get run/release status. The browser never calls the model provider with a secret key.

For source ingestion, bound bundle size, path traversal, file count, and frame depth. Do not execute imported legacy scripts during parsing. If live capture is added, restrict initial destinations, block private-network addresses and unsafe redirects, and isolate the browser from cloud credentials. Render candidate pages in a sandboxed preview on an isolated origin. Keep only tested scripts in exported pages. These controls address the actual risks of a tool that imports and renders third-party websites.

Use a simple protected editing session for the hackathon; public generated sites are read-only. Demo visitors must not gain unlimited model-generation or publishing access. Limit per-project pages, retries, and output sizes; set a spending cap only after the user provides the budget.

## 11. Forge implementation sequence

Create one Forge project for the workbench, using the plan as requirements context. Enable UI Design. Review Intent, PRD-Spec, Architecture, UI Design, User Stories, and Testing. Save Application Context and connect the selected repository before Coding Agent implementation.

Keep the backlog bounded and dependency ordered:

| Story | Deliverable | Depends on | Proof of completion |
| --- | --- | --- | --- |
| 1. Foundation and deployment smoke test | App shell, API health endpoint, durable project record, minimal deployment | Account/repo/cloud setup | Reachable URL; saved record survives restart |
| 2. Source import and evidence | Bundle manifest, 3-page sample, screenshot/text/frame inventory | 1 | Actual pages and assets shown; bad imports produce actionable errors |
| 3. Evaluation and decomposition | Model adapter, validated findings/components, corrections | 2 + runtime model access | New analysis run produces source-linked results |
| 4. Component canvas | Custom nodes, crops, mapping edges, inspector, saved positions | 3 | Select source region and find its component; list alternative works |
| 5. Design-system studio | Proposal, rationale, token editor, component previews | 3 | User changes tokens and sees coherent previews |
| 6. Approval/version rules | Immutable approval, invalidation, provenance | 5 | API rejects generation without approval; changes create a new draft |
| 7. First-page generation | Typed layout, deterministic renderer, desktop/mobile preview | 6 | One non-hardcoded page generated from real inputs |
| 8. Remaining pages and shared system | Page queue, consistent components, route mapping | 7 | Three navigable pages share the approved system |
| 9. Checks and release | Preservation/link checks, public immutable release, ZIP export | 8 | Public URL works in a fresh session; downloaded output matches |
| 10. Demo polish and evidence | Reveal animation, slider, retry states, captures, demo script | Working 1–9 | Full rehearsed path; Forge build evidence captured |

Run native Coding Agent sequentially where stories depend on each other. Review actual changes, run relevant tests, and record fixes back in Forge. Do not count generated plans, previews, or unmerged branches as delivered functionality. Do not select a broad monolith migration template for the workbench merely because the product modernizes other sites.

**Illustrative eight-hour allocation, not a promise or remaining-time estimate:** setup/specification 60 minutes; shell/import/evaluation 90; canvas/design system/approval 90; first page and renderer 75; remaining pages/publish 75; verification/demo/posts 90. Total 480 minutes. Forge latency or access delays can exceed this. Confirm actual time left before execution.

De-scope order if needed: second design direction; elaborate reveal motion; live URL capture; extra component types; extra pages beyond the first end-to-end proof. Preserve evaluation, post-evaluation design-system creation, approval, real rebuilding, and public deployment. Any reduction from the three-page target must be reported explicitly.

## 12. Meaningful verification and definition of done

- Import the sample through the same supported pipeline used for another compatible static bundle. Keep content in fixtures/data, not page-specific generator branches.
- Verify frame text and image-map links are represented in the source inventory; mark unavailable sections rather than inventing content.
- Check generated findings cite real pages/regions. AI guesses remain labeled suggestions until accepted.
- Exercise approval transitions directly against the API, including stale version rejection and reload persistence.
- Generate a candidate from edited inputs and confirm output actually changes.
- Verify semantic headings, keyboard focus, focus visibility, contrast on tested pairs, responsive overflow, image alternatives, and reduced motion. Automated checks supplement manual review; do not claim full accessibility certification.
- Compare selected-page text/link/asset inventory before and after. Report preserved, transformed, intentionally omitted, and unresolved items separately.
- Rebuild a second page with the same design-system version; confirm shared component consistency.
- Test failed model output, missing assets, interrupted jobs, and retry without duplicate releases.
- Open the public URL in a fresh session; verify internal routes, assets, interactions, and that editing APIs/secrets are not exposed.
- Download the static bundle and serve it separately to prove that the generated result does not depend on Forge or live model calls.

Complete means: a usable standalone workbench, a real run through every required stage, an explicitly approved design system, approved generated pages, a working public static release, and evidence of meaningful Forge implementation.

## 13. Two-to-three-minute demo

0:00–0:20 — Show the original Space Jam UI and state the problem: modernizing an interface while keeping identity and content.

0:20–0:45 — Show evaluation evidence and component decomposition. Select a region and show its exact source mapping.

0:45–1:15 — Reveal the proposed design system, explain two choices grounded in the evaluation, edit one token, and approve.

1:15–1:55 — Generate one page live if rehearsed latency permits; otherwise clearly open an earlier completed run. Show the reconstruction reveal, comparison slider, and mobile preview. Show remaining page status.

1:55–2:20 — Publish or open the verified immutable release. Navigate between pages and show the static export.

2:20–2:45 — Show one Forge story, implementation run/PR, and a real measured result. Close with the enterprise applicability to legacy microsites/content portals.

Keep both the working product URL and generated-site URL in the submission. Each teammate's original post must include their own contribution, specific Forge usage, and visuals. Prepare the before/after description, problem overview, team information, and content links.

