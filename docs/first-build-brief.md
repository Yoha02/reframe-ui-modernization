# First executable Reframe build

This is the build order for the hackathon vertical slice. Use the Forge-generated requirements and UI previews as context, with AGENTS.md and this brief resolving generated boilerplate or inconsistent paths. Ship a coherent executable app before independently expanding every small story.

## Architecture and contract

- Use one root package: src/client for React/TypeScript, src/shared for validated contracts, src/worker for a fetch-based TypeScript Worker; migrations for D1 SQL. Keep generated-story path suggestions consistent with this layout.
- Use actual D1 DB and R2 FILES bindings. Keep the environment interfaces explicit. Serve the built React assets from the Worker-compatible build. Do not invent a Sites management API or deployment credentials.
- Keep source evidence, measured findings, AI recommendations, design-system versions, generated page specifications, approvals, generation runs, and releases as distinct records. Enforce transitions server-side.
- Import a bounded ZIP with manifest, original HTML, local assets, screenshots, and capture metadata. The prepared Space Jam sample uses fixtures/spacejam-raw through the same normalization path. Include a tiny unrelated static-site fixture to demonstrate the importer and renderer are generic.
- Use server-only OpenAI Responses calls with structured output, image evidence where useful, a configurable model, token/call limits, durable usage accounting, and an explicit missing-configuration state. Never store keys in frontend code or return them in status responses. Live model calls stay off until the key and total budget are configured.
- Use a deterministic safe component renderer fed by validated AI page specifications. Never execute model-supplied JavaScript or legacy source scripts. Keep approved design systems and released artifacts immutable.
- A private Sites project does not make its release routes public. Provide a real release boundary and document/test the exact public-serving arrangement before declaring publication complete. A downloadable ZIP alone is not publication.

## Visual direction

Reframe is a calm, polished design workspace: warm off-white background, crisp white surfaces, charcoal text, restrained indigo accents, thin dividers, generous spacing, and consistent rounded controls. Use a clear wordmark and a compact stage rail; keep technical implementation jargon out of product-facing copy.

Make the center workspace the hero. The component canvas must show actual screenshot crops with source connections, pan/zoom/fit, selection, an inspector, and an accessible list. The design-system studio shows large usable color swatches, typography specimens, spacing, and live component previews alongside evidence-backed rationale. Its tokens belong to the imported site and must not change Reframe itself.

The page studio needs a prominent real before/after slider, desktop/mobile sizing, and a tasteful transformation reveal connecting selected source fragments to generated components. Respect reduced motion. Do not replace actual source artwork with emoji or fabricated screenshots. Treat the Forge UI artifacts as layout sketches rather than polished final screens.

## Delivery order and proof

1. A runnable workbench with setup/error/empty states and persistent project creation.
2. Prepared Home evidence imports with original screenshot, content, and link inventory visible.
3. Live evaluation/decomposition, editable source component map, and a generated evidence-derived design system.
4. Human approves a version; Home generation uses it. Editing after approval creates a new version and visibly invalidates downstream approval.
5. Real before/after preview and page approval; reload preserves state.
6. Immutable release plus matching ZIP; publication verifies actual readable output at the stated URL. Failed publication remains failed.
7. Extend the same flow to The Lineup and Jam Central, then polish responsive behavior and the demo reveal.

Test the meaningful boundaries: unsafe ZIP paths and limits, schema-invalid provider responses, missing configuration, unapproved/stale generation or publication, idempotent retries, content and route preservation, persisted state after reload, and agreement between released files and ZIP. Report which checks actually ran.
