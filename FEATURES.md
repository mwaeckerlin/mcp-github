# Features

Numbered register of every feature; a number is never reused. Every feature is covered by tests listed in [TESTS.md](TESTS.md); the guard `tests/docs-contract.sh` fails when a feature has no test.

- **F1 — GitHub credentials stay on the server.** The GitHub token is configured on the MCP server only; a sandboxed agent calls the server over MCP and never sees the token.
- **F2 — Every GitHub REST operation, grouped in families.** All operations of the GitHub OpenAPI description are sorted into 17 tool families (`github_repositories_rest`, `github_pull_requests_rest`, `github_issues_rest` and the others); a family tool accepts only an `operationId` of its own family.
- **F3 — Operation discovery.** `github_rest_list_operations` lists the operation ids with method, path and parameter names, filtered by family and paged with a bounded `limit` and `offset`.
- **F4 — GraphQL for what REST does not cover.** `github_graphql` runs a named query; the `operationName` must occur in the query, and the query is limited to 20000 characters.
- **F5 — Assign the Copilot cloud agent.** `github_copilot_assign_issue` assigns Copilot to an existing issue, with the optional `agent_assignment` settings.
- **F6 — Validated arguments and bounded pages.** Every tool call is checked against its schema; page sizes (`per_page`, `first`, `last`, `limit`, `pageSize`) are clamped to 1…100, also nested and in GraphQL variables.
- **F7 — Safe error messages.** GitHub errors become plain messages (authentication, not found, the assignee hint for 422), and every GitHub token in a message is redacted.
- **F8 — Tools switched off by the operator.** `DISABLE_TOOLS` names tools that are hidden from `tools/list` and refused when called.
- **F9 — Access protected by a shared token.** With `MCP_AUTH_TOKEN` set, every MCP request must carry it, in the `Authorization: Bearer` header or the `token` query parameter; the comparison takes the same time whatever the guess, and `/healthz` stays open.
- **F10 — Degraded mode without a GitHub token.** Without `GITHUB_TOKEN` the server starts, `/healthz` reports `degraded`, and the operation listing offers the reading operations only.
- **F11 — Configuration of host and port.** `MCP_GITHUB_HOST` and `MCP_GITHUB_PORT` set the address; an invalid port stops the start with an error.
- **F12 — Agent instructions in the image.** `SKILL.md` ships in the image at `/app/skills/mcp-github/SKILL.md`.
- **F13 — Headless image.** The image contains no shell, no busybox and no perl.
- **F14 — Published for amd64 and arm64.** Every push builds the image natively for both architectures and publishes it under one tag on Docker Hub, with the reusable workflow of `mwaeckerlin/scratch`.
- **F15 — GitHub Enterprise Server.** `GITHUB_API_URL` points REST and GraphQL at another GitHub API than `https://api.github.com`; an address without `http://` or `https://` stops the start with an error.
