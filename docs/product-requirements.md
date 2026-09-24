# Product workflow and scope

Reframe helps an author modernize a small static website while reviewing evidence and approving the design before publication.

## Required sequence

1. Import evidence, retaining source text, links, images, screenshots, coordinates, hashes, and capture provenance.
2. Evaluate the site. Findings must cite evidence rather than invent measurements.
3. Decompose pages into components. Let the author correct descriptions and save canvas positions and notes.
4. Generate a site-specific design system after evaluation, with editable visual tokens and component recommendations.
5. Require explicit approval of the current design-system version.
6. Rebuild pages individually from validated specifications. Show source/output and desktop/mobile previews; tie approvals to current specifications and design versions.
7. Publish only a fully approved snapshot as an immutable public release and downloadable ZIP.

## Boundaries

- Three pages per bundle, 20 MB compressed, 60 MB expanded, 500 files, 10 MB per file.
- Static content only: no legacy-script execution, application/backend migration, or automatic URL crawling.
- Model calls are server-side, bounded, validated, and persisted. Live generation requires a key, supported model, and positive request-reservation budget.
- The renderer consumes validated specifications deterministically. Model generation is not deterministic.
- The authoring API is authenticated; publication uses a separate read-only service with secret-protected ingestion.
- Hosted authors share an allowlisted workspace, not per-project tenant ownership.

## Review experience

Use a restrained workbench with a component canvas, contextual inspector, immediate token previews, before/after comparison, mobile layouts, and a source-to-output reveal that respects reduced-motion preferences.

## Unfinished work

Automatic recovery of interrupted model jobs, richer regeneration/version controls, wider capture tooling, and a verified live model-to-publication journey remain future work. Do not describe them as completed capabilities.
