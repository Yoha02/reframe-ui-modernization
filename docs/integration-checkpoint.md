# Integration checkpoint

The workbench now imports a validated evidence ZIP, evaluates it using backend-only OpenAI structured responses, decomposes source regions, proposes editable design tokens, freezes explicit design approval, rebuilds pages using a deterministic renderer, and requires individual page approval. Source content and references are preserved.

Tests use an explicitly mocked provider; no live OpenAI result has been generated. Live generation remains disabled until the owner supplies a secret and spending cap. The browser successfully imported the three-page Space Jam capture with 17 image assets and 24 links.

The release service creates an immutable static bundle and matching ZIP, sends only generated files to a separate release Worker, and verifies every public artifact without author credentials before marking published. The separate Worker has no model key, authoring database, or authoring handlers. Its publish endpoint requires a server-held shared secret. Actual Sites hosting is still unverified at this checkpoint.

Generated Forge stories use inconsistent paths/table names and multi-environment deployment examples. Per AGENTS.md, implementation follows the existing npm/TypeScript contracts and a single Sites deployment; D1 JSON metadata lives in Projects, Pages and Releases instead of duplicate generated tables. WO-011 API/state acceptance behavior is covered by tests/integration/project-state.test.ts and tests/fixtures/db/seed-workflow.sql; missing-field schema validation, approved-version aggregation, stale/empty/failed states, and a missing-project 404 are exercised. Forge's generated work-order snapshot remains stale after synced ALM updates; actual commits and tested prerequisites determine progress.

Remaining: live model and hosting validation, workbench visual verification beyond import, persisted canvas edits, refined component corrections, public deployment smoke, final demo polish and submission assets. These are not marked complete.
