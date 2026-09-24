# Contributing

Fork the repository, create a branch, and follow README.md's local setup. Open an issue or submit a focused pull request explaining the user-visible problem, resulting behavior, and validation.

Preserve approval order and provenance. Never bypass backend gates to make a preview or test pass. Use synthetic test fixtures unless you have rights to redistribute reference material. Mock provider calls in tests; do not require contributors to spend money or supply credentials.

Before submitting code changes:

```sh
npm run typecheck
npm run lint
npm test
npm audit --audit-level=high
npm run build
npm run build:releases
```

Test changed behavior when it meaningfully protects workflow, preservation, or security. Check desktop and mobile layouts for visual changes. Report live integrations separately from mocked tests.

Do not commit environment files, tokens, captured private data, deployment identifiers, local databases, or recordings showing credentials. Use `.env.example` for configuration names only. Review `git diff --cached` before pushing.

Original-code contributions use the repository's MIT license. Preserve third-party notices and disclose the source and license of new assets. See SECURITY.md for private vulnerability reporting.
