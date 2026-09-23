# Reframe implementation constraints

Implement this application through its Forge work orders. Product requirements are in `docs/product-requirements.md`. This is a one-day hackathon MVP; generic enterprise recommendations in generated architecture documents are not additional deliverables.

- Mandatory flow: Import -> Evaluate -> Decompose -> Generate a site-specific design system -> Explicit approval -> Rebuild and approve pages -> Publish. The design system comes after evaluation.
- The workbench uses React/TypeScript and React Flow. Use a Sites-compatible TypeScript Worker, D1 `DB`, and R2 `FILES`. Do not require an Express server, hosted Playwright, Kubernetes, queues, or a separate cloud account.
- Runtime model provider is OpenAI. Use backend-only `OPENAI_API_KEY`, configurable `OPENAI_MODEL`, validated structured responses, and bounded requests. A missing key or configured usage limit must disable live generation with an honest message. Never invent results or fake success.
- Use Sites for publication. GitHub Actions should typecheck, test and build. Do not invent Sites deployment API endpoints or require dev/staging/production environments, paid scanning tools, or an arbitrary coverage percentage. Document the exact packaged output for the Sites connector.
- The GitHub App is installed for this repository only and Forge's connection test passed. Do not treat earlier artifact statements about pending installation as current.
- Keep the workbench access-controlled. Public generated releases must be read-only and isolated from authoring sessions. Prove the publication boundary in the first deployment smoke test. Owner-private platform access does not magically make a release route public; do not claim it does.
- Use evidence bundles with real screenshots and preserved source text, links, assets, and frame provenance. Any source capture utility runs separately from the Worker. Space Jam is sample data, not a hardcoded generation branch.
- Start with conservative configurable upload limits (20 MB compressed, 60 MB expanded, 500 files, 3 demo pages) and reject path traversal, excessive expansion, and executable imported scripts. Do not adopt the generated architecture's 250 MB example as a requirement.
- Save generation runs and approval versions durably. Enforce approval and stale-version checks on the server. The deterministic renderer consumes validated page specifications; model calls themselves are not assumed deterministic.
- Essential UI: calm off-white/white workbench, strong type hierarchy, restrained indigo accent, large canvas, contextual inspector, live token/component previews, before/after comparison, desktop/mobile page previews, real source-to-output reveal with reduced-motion support.
- Prove one complete Home page journey first; target Home, The Lineup, and Jam Central. A compatibility error or ZIP alone does not satisfy the required public working release.
- Do not add beta recruitment, invitation administration, analytics programs, monitoring dashboards, multi-week plans, or unrelated enterprise features.
- Test meaningful approval, preservation, persistence, import-boundary and publishing behavior. Report untested integrations and missing credentials honestly.
