# Reframe contributor constraints

- Preserve the workflow: import -> evaluate -> decompose -> design system -> explicit design approval -> rebuild and approve each page -> publish.
- Keep API keys and session/publishing secrets on the server. Never commit credentials, local environment files, or deployment-owner metadata.
- Use React/TypeScript and React Flow for the workbench; the backend is a Worker with D1 `DB` and R2 `FILES` bindings.
- Enforce approvals and stale-version checks on the server. Save runs, evidence provenance, and approval versions durably.
- Use bounded model requests and validated structured responses. Report missing configuration and failures honestly; never substitute mock output in production.
- Imported HTML is inert evidence. Reject unsafe paths, archive expansion abuse, and executable imported content. Space Jam is a reference fixture, never a domain-specific generation branch.
- Keep public releases read-only and isolated from authoring credentials. Production identity headers are trusted only behind the configured authentication gateway.
- Preserve the calm visual hierarchy, editable component board, token previews, desktop/mobile comparisons, and reduced-motion support.
- Test meaningful workflow, security, persistence, and publication behavior. Do not claim live integrations passed when only mocks ran.
- Read README.md, SECURITY.md, THIRD_PARTY_NOTICES.md, and relevant docs before changing their contracts. Run the checks in CONTRIBUTING.md for code changes.
