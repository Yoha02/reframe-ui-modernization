# Sites deployment and verification

Workbench: https://reframe-ui-modernization.y03.chatgpt.site
Project: appgprj_6ab43da23b848191b2ca40546300da23

Read-only release origin: https://reframe-static-releases.y03.chatgpt.site
Project: appgprj_6ab457b15c848191a4af68374e1e2928

The user explicitly changed the workbench audience to public. Its landing page is public; authoring requires ChatGPT sign-in and the configured AUTHOR_EMAILS allowlist (both requested accounts). The public release Worker has no authoring routes or model credentials. Its private ingestion endpoint requires a server-held shared secret.

The first remote build established the required Worker entrypoint: dist/server/index.js. Build the workbench with npm run build, then create a tar containing .openai/hosting.json, dist/server/index.js and dist/client/. Push the exact committed source to the Sites-provided Git remote, then save and deploy that SHA with the archive. Deployment archives must exclude node_modules, source files, local visual fixtures and credentials. The release service uses the same dist/server/index.js layout and needs only FILES storage. Its source is maintained in src/release-worker/index.ts; the deployment copy uses a separate Sites project and repository.

Sites settings provide SESSION_SIGNING_SECRET, AUTHOR_EMAILS, RELEASE_ORIGIN and RELEASE_PUBLISH_SECRET. The release Site receives only RELEASE_PUBLISH_SECRET and FILES. OpenAI credentials and the approved spending cap remain pending. Values are never stored in hosting.json or application code. Redeploy after changing runtime settings.

Verified on 2026-09-23: workbench production deployment succeeded; public landing GET returned 200; anonymous and spoofed-header project GET/POST returned 401. asggm03 signed in through ChatGPT, imported all three real pages (17 image assets, 24 links), and the project survived reload. Release origin GET returned 200; /api/projects returned 404; unauthenticated /internal/publish POST returned 401. Real model-generated public pages remain unverified until OpenAI configuration is supplied.

Local visual QA uses tests/fixtures/visual-worker.ts and scripts/visual-preview.ts on 127.0.0.1:8789. It is explicitly labelled test data and is not part of the deployed archive. Automated integration tests use in-memory D1/R2 adapters and mocked Responses API output; they validate approvals, preservation, publish hashes, ZIP parity and immutable release rejection.

Hosting boundary discovered during the real R2 smoke test: Cloudflare appends challenge-platform security markup to HTML transport responses. The release service therefore exposes the same immutable file with ?artifact=1 as application/octet-stream; publishing checks normal public HTML availability and hashes these canonical download bytes. The ZIP matches canonical generated artifacts. We do not claim that the edge-modified HTML transport body is byte-for-byte identical to the ZIP.
