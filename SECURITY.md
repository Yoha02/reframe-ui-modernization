# Security

Reframe is an early prototype, not a hardened multi-tenant service. Allowlisted authors share a workspace. Review the deployment boundary before adding authors.

- Keep `OPENAI_API_KEY`, `SESSION_SIGNING_SECRET`, and `RELEASE_PUBLISH_SECRET` in server-side environment settings. Locally use the ignored `.env` file.
- Never put credentials in browser storage, source, `VITE_*` variables, public issues, screenshots, logs, or archives. An unlisted URL is not secret storage.
- Production identity depends on the Sites gateway protecting `oai-authenticated-user-email`. A raw public Worker without that gateway or equivalent verified authentication is unsafe.
- Local development bypasses hosted identity on loopback. Keep servers bound to `127.0.0.1`; do not tunnel them publicly.
- Give the release service only its publishing secret and separate R2 binding, never the model key or authoring database.
- Source evidence is untrusted. Preserve archive/path validation, inert HTML handling, model validation, CSRF protection, and server-side approvals.
- Generation can send source text and screenshots to the model provider. Import only material appropriate for that processing.
- The application budget is a request-reservation ledger, not a provider-enforced bill cap. Failed/unknown requests retain reservations; interrupted runs may need manual recovery.

If a credential is exposed, revoke and replace it first. Removing it from the latest commit does not remove historical copies, caches, or previous downloads.

Report vulnerabilities using this repository's GitHub **Security -> Report a vulnerability** feature. Do not include working credentials or private evidence. Describe affected versions, impact, and minimal reproduction steps. There is no guaranteed response time or support policy.
