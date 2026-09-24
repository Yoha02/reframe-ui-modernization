# Evidence bundles

Reframe imports a prepared ZIP, not an arbitrary website archive. Its root must contain `evidence-manifest.json`, validated by `src/shared/schemas/evidenceManifest.ts`. That schema and `common.ts` are the authoritative contract.

The manifest identifies the site, capture time and method, up to three pages, and their assets. Each page includes:

- Its ID, title, source URL and route.
- Inert HTML and a screenshot, referenced by relative object path, SHA-256, MIME type, byte size, and immutable flag.
- Captured text and structured source content with stable IDs.
- Links, including image-map links where present.
- CSS viewport dimensions and screenshot pixel dimensions for correctly scaled crops.
- Component regions with coordinates and source-content references.
- Frame provenance and capture warnings.

Asset records retain the original URL/path, alternate text, and hashed file reference. Referenced bytes must be included and match declared hashes and sizes. Paths cannot contain traversal, encoded separators, or absolute locations. Legacy HTML is evidence and is never executed.

Use `fixtures/spacejam-1996/evidence-manifest.json` as a concrete schema example and `scripts/prepare-spacejam-bundle.ts` as a reference utility. That utility is tailored to the bundled capture inventory, not a general crawler. `npm run prepare:spacejam` regenerates the study bundle from `fixtures/spacejam-raw`.

For another site, capture pages with a browser you control, preserve provenance, and write a manifest using the same schema. Do not substitute generated illustrations for source screenshots. Bundled screenshots cover recorded viewports, not full scrolling pages.

Limits: 20 MB compressed, 60 MB expanded, 500 files, 10 MB per file, three pages. Use material you own or have permission to process and publish. Source text and screenshots may be sent to the configured model provider when you initiate generation.
