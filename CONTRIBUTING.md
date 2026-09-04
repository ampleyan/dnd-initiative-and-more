# Contributing

Thanks for improving Initiative Tracker.

## Before opening a change

- Create a focused branch from the current default branch.
- Keep runtime data, `.env`, tokens, local paths, and generated output out of commits.
- Preserve the established ownership boundaries: routes own API/persistence mapping, `db/init.ts` owns schema changes, `src/api/client.ts` owns shared API calls, and focused hooks own frontend domain behavior.

## Checks

Run the smallest relevant test while developing, then run:

```bash
npm run lint
npm test
npm run build
```

Document schema migrations, configuration changes, and user-visible behavior in the pull request. Add regression tests for behavior changes where practical.

## Pull requests

Explain the problem, the behavior change, and how you verified it. Do not include secrets, private host names, personal volume paths, uploaded files, or SQLite databases.

For security issues, follow [SECURITY.md](SECURITY.md) rather than opening a public issue.
