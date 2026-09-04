# Security policy

## Reporting a vulnerability

Please do not disclose vulnerabilities, credentials, or exploit details in a public issue. Use GitHub's private security advisory flow for this repository, or contact the maintainer privately through the GitHub profile associated with the repository.

Include affected versions, reproduction steps, impact, and any suggested mitigation. You should receive an acknowledgement within seven days.

## Deployment guidance

- Do not expose the application directly to the public internet. Private-network requests intentionally bypass login for table-side use.
- Set a unique `SESSION_SECRET` and `ADMIN_PASSWORD` before the first production run.
- Store secrets in an untracked `.env` file or a deployment secret manager.
- If a credential is committed, revoke or rotate it immediately. Removing it from the latest commit does not remove it from Git history.
