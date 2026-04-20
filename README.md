# MCP GitHub

Standalone MCP server for secure GitHub access from sandboxed agents. GitHub credentials are stored only on the MCP server side.

This repository is explicitly modeled after `mwaeckerlin/openclaw-mcp-gateway`:
- same standalone MCP gateway concept
- same strict validation and allowlist model
- same separation of server config, client config, and tool-call parameters
- same agent-facing README + SKILL approach

## Purpose and Security Model

Sandboxed agents should **not** hold GitHub tokens. Instead:

1. The sandboxed client calls this MCP server.
2. This MCP server (running outside the sandbox) uses the server-side `GITHUB_TOKEN`.
3. Calls are limited to validated MCP tools and validated arguments.

Security properties:
- no GitHub token in sandbox/client
- no arbitrary GitHub URL passthrough
- no freeform HTTP proxy tool
- schema-validated tool arguments
- bounded pagination (`per_page`, `first`, `last`, `limit`, `pageSize` are clamped to `1..100`)
- safe error shaping with token redaction

## Architecture / Deployment Context

```plantuml
@startuml
node "Sandbox / Agent" {
  [MCP Client]
}
node "MCP GitHub Server" {
  [mcp-github]
}
node "GitHub API" {
  [api.github.com]
}

[MCP Client] --> [mcp-github] : MCP tool calls
[mcp-github] --> [api.github.com] : validated REST + GraphQL
@enduml
```

## Exposed MCP Tools

### Discovery
- `github_rest_list_operations`: lists allowlisted GitHub OpenAPI operation IDs and their mapped family.

### REST tool families (full API coverage)
All GitHub REST operations from `@octokit/openapi` are mapped into one of these families:
- `github_repositories_rest`
- `github_branches_rest`
- `github_commits_rest`
- `github_git_data_rest`
- `github_pull_requests_rest`
- `github_issues_rest`
- `github_labels_milestones_rest`
- `github_releases_tags_rest`
- `github_actions_workflows_rest`
- `github_checks_status_rest`
- `github_discussions_projects_rest`
- `github_users_orgs_teams_rest`
- `github_search_rest`
- `github_notifications_reactions_rest`
- `github_webhooks_deployments_rest`
- `github_codespaces_rest`
- `github_rest_misc`

Each REST family tool takes:
- `operationId` (required, must belong to that family)
- `parameters` (validated object; pagination bounded)

### GraphQL
- `github_graphql`: validated GraphQL operation execution (`operationName`, `query`, optional `variables`) for gaps where GraphQL is needed.

## Tool-Call Parameters

### `github_rest_list_operations`
```json
{ "family": "github_pull_requests_rest", "limit": 50, "offset": 0 }
```

### Any `*_rest` family tool
```json
{
  "operationId": "pulls/list",
  "parameters": {
    "owner": "mwaeckerlin",
    "repo": "mcp-github",
    "state": "open",
    "per_page": 30
  }
}
```

### `github_graphql`
```json
{
  "operationName": "Viewer",
  "query": "query Viewer { viewer { login } }",
  "variables": {}
}
```

## Configuration

> Production rule: keep `GITHUB_TOKEN` server-side only.

### Server configuration (MCP GitHub server process)

| Variable | Required | Description |
|---|---|---|
| `GITHUB_TOKEN` | yes | GitHub token used by the server (never passed to sandbox) |
| `MCP_GITHUB_HOST` | no | Bind host (default `0.0.0.0`) |
| `MCP_GITHUB_PORT` | no | Bind port (default `4000`) |
| `DISABLE_TOOLS` | no | Comma-separated MCP tool names to disable |

### Client configuration (sandbox/agent environment)

| Variable | Required | Description |
|---|---|---|
| `MCP_GITHUB_URL` | yes | URL where the sandbox MCP client reaches this server (for example `http://mcp-github:4000`) |

### Separation rules

- **Server configuration** controls auth and exposed tools.
- **Client configuration** only tells the sandbox where MCP lives.
- **Tool-call parameters** are per-invocation validated `arguments` and cannot override server auth/config.

## Test Token Requirements and Risks

### Required `GITHUB_E2E_TOKEN` permissions

Run the E2E test suite with:

```bash
export GITHUB_E2E_TOKEN=ghp_...
cd test && docker compose up
```

The token is set server-side only (`GITHUB_TOKEN` in the `mcp-github` container). The `test-client` container never sees it.

#### Fine-grained Personal Access Token (recommended)

Create a fine-grained PAT at <https://github.com/settings/tokens?type=beta>.
See the [GitHub fine-grained PAT permission reference](https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens) for the full list.

**Repository access:** Select *"All repositories"* or *"Public Repositories"* — all repository tests access public repos (`octocat/Hello-World`, `mwaeckerlin/mcp-github`), which the GitHub API allows with no repository permission at all.

The only two permissions actually required by the E2E tests are:

**Repository permissions:**

| Permission | Access | Why |
|---|---|---|
| Codespaces | Read | `codespaces/list-for-authenticated-user` (`GET /user/codespaces`) reads private user data and requires this permission. Confirmed in [GitHub docs](https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens#repository-permissions-for-codespaces). |

**Organization permissions:**

| Permission | Access | Why |
|---|---|---|
| Projects | Read | `projects/list-for-org` (`GET /orgs/{org}/projects`) on the `github` org. Confirmed in [GitHub docs](https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens#organization-permissions-for-projects). |

**No other permissions are needed** because:
- `users/get-authenticated` and GraphQL `viewer { login }`: *"The fine-grained token does not require any permissions"* (see [GitHub docs](https://docs.github.com/en/rest/users/users#get-the-authenticated-user--fine-grained-access-tokens)).
- All remaining tests access only public repositories (`octocat/Hello-World`, `mwaeckerlin/mcp-github`). GitHub's API explicitly states that endpoints for repos, branches, commits, refs, releases, pull requests, issues, labels, deployments, actions/workflows, and commit statuses *"can be used without authentication or the aforementioned permissions if only public resources are requested"*.

#### Classic Personal Access Token

If you use a classic PAT (legacy), grant these scopes:

| Scope | Why |
|---|---|
| `repo` (or `public_repo` for public repos only) | `codespaces/list-for-authenticated-user` and all repo endpoints |
| `read:project` | `projects/list-for-org` |

> **Note:** GitHub's API returns HTTP 401 if you supply *any* token that is invalid or expired, even for public-data endpoints. Always use a fresh, valid token.

### What the tests do to your GitHub account

**All E2E tests are strictly read-only.** They only call `GET` endpoints. No data is created, modified, or deleted. Specifically:

- No repositories, issues, PRs, or comments are created.
- No webhooks, deployments, or labels are written.
- No organization settings are changed.
- No starred repos, notifications, or subscriptions are altered.
- Codespace listing only reads; no codespace is started or stopped.
- Rate-limit info is read (counts against your API quota but does not change any resource).

**Risk assessment:** There is no risk of data loss or unintended side-effects regardless of what permissions your token carries. Even a token with full write permissions will not cause any mutations because the tests only use read operations.

## Installation and Usage

```bash
npm install
npm run build
GITHUB_TOKEN=*** npm start
```

Dev mode:
```bash
GITHUB_TOKEN=*** npm run dev
```

Tests:
```bash
npm test
```

## Safe Usage Rules

- Always choose a scoped family tool; do not try to emulate arbitrary HTTP.
- Use `github_rest_list_operations` to discover valid operation IDs.
- Keep pagination bounded and intentional.
- Do not put secrets into tool arguments.
- Prefer REST operation IDs first; use GraphQL only when needed.

## Troubleshooting

| Symptom | Cause | Action |
|---|---|---|
| `GITHUB_TOKEN is required` | Missing server token | Set server-side `GITHUB_TOKEN` |
| `operationId ... is not allowlisted for tool ...` | Wrong tool family | Query `github_rest_list_operations` and use matching family |
| `GitHub authentication or permission error (401/403)` | Invalid token or insufficient scopes | Rotate token or add required scopes |
| `GitHub resource not found or not accessible` | Missing permission or wrong resource | Validate owner/repo/resource access |
| `Tool disabled by DISABLE_TOOLS` | Tool explicitly disabled | Remove from `DISABLE_TOOLS` or call different tool |

## SKILL

This repository ships `SKILL.md` for local OpenClaw skill installation and agent-first operating guidance.
