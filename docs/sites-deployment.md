# Deploy your own Reframe instance

The hosted implementation targets Sites with a TypeScript Worker, D1, R2, and the Sites authenticated identity gateway. This repository is not a provider-independent one-click deployment template.

Create two projects in your own Sites account: an authoring workbench and a public static release service. Use your own project identifiers; the owner's local `.openai/hosting.json` is intentionally ignored. Provision each project through your account's Sites tooling, which supplies its manifest and deployment workflow.

## Authoring workbench

1. Bind D1 as `DB`, R2 as `FILES`, and frontend assets as `ASSETS`. The Worker initializes its schema from `migrations/0001_initial_workflow.sql` when needed.
2. Configure server settings below through the host's environment/secret controls.
3. Run `npm ci` and `npm run build`.
4. Package `.openai/hosting.json`, `dist/server/index.js`, and `dist/client/`. Use Sites tooling to upload the exact committed source and archive, then deploy that version.
5. Redeploy after changing runtime settings if required by the host. Verify anonymous landing, authenticated import, and persistence after reload.

| Setting | Purpose |
| --- | --- |
| `SESSION_SIGNING_SECRET` | Random secret of at least 32 characters for signed sessions |
| `AUTHOR_EMAILS` | Comma-separated allowlist for authenticated authors |
| `OPENAI_API_KEY` | Your server-only API credential |
| `OPENAI_MODEL` | `gpt-4.1-mini-2025-04-14` or `gpt-4.1-mini` |
| `OPENAI_BUDGET_USD` | Positive request-reservation limit; not a guaranteed provider billing cap |
| `RELEASE_ORIGIN` | HTTPS origin of your release service |
| `RELEASE_PUBLISH_SECRET` | Random shared secret of at least 32 characters, also set on the release service |

Never set `LOCAL_DEVELOPMENT=true` on a hosted project. Production identity comes from `oai-authenticated-user-email`, supplied by the trusted Sites gateway. Do not expose the raw Worker on a host that permits clients to supply that header. Add verified authentication before using another host. All allowed authors share project access.

## Public release service

Build with `npm run build:releases`. Package `dist/releases/index.js` as **`dist/server/index.js`** in the separate project's archive alongside its own `.openai/hosting.json`. Bind a separate R2 bucket as `FILES`; supply only `RELEASE_PUBLISH_SECRET`. This service needs no OpenAI key, author sessions, or D1 database.

Make the service publicly readable. `/internal/publish` requires the shared secret and receives an immutable ZIP. Pages live under `/sites/<release-id>/`. Verify anonymous reads, rejected unauthenticated publishing, and absence of authoring routes before use.

Some hosts append security markup to HTML responses. Reframe checks public HTML availability and separately hashes canonical bytes returned with `?artifact=1`. ZIP parity refers to canonical files, not HTML modified by an edge service in transit.

## Packaging and validation

Exclude `.env`, `.dev.vars`, credentials, local databases, `node_modules`, test fixtures, and visual-preview workers from archives. The frontend build is `dist/client`; test-only visual fixtures must never become the deployed backend.

Run repository checks before deployment. Integration tests mock the model. A build or hosting smoke test does not demonstrate a real model-generated release; verify that journey separately with your own account and permitted content.
