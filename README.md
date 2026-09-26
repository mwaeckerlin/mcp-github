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

The agent does not need a GitHub token. The token is required only on the MCP server side.

Security properties:
- no GitHub token in sandbox/client
- no arbitrary GitHub URL passthrough
- no freeform HTTP proxy tool
- schema-validated tool arguments
- bounded pagination (`per_page`, `first`, `last`, `limit`, `pageSize` are clamped to `1..100`)
- safe error shaping with token redaction

## Architecture / Deployment Context

![](doc/architecture.svg)

<details>
<summary>PlantUML source</summary>

```plantuml
@startuml architecture
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

</details>

## Exposed MCP Tools

### Discovery
- `github_rest_list_operations`: lists allowlisted GitHub OpenAPI operation IDs and their mapped family.

### REST tool families
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

### Copilot cloud agent
- `github_copilot_assign_issue`: assign GitHub Copilot cloud agent to an existing issue. Copilot researches the issue, creates an implementation plan, and opens a pull request. Accepts optional `agent_assignment` for `target_repo`, `base_branch`, `custom_instructions`, `custom_agent`, and `model`. Requires a Copilot plan with cloud agent enabled (public preview).

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

## Usage through MCP

Use this sequence for reliable MCP usage from an agent.

### 1) Check server readiness

- Call `GET /healthz`.
- If `status` is `degraded`, continue in read-only mode: only public read calls are expected to work.

### 2) Discover the exact operationId

Call tool `github_rest_list_operations` with:

```json
{
  "family": "github_issues_rest",
  "limit": 200,
  "offset": 0
}
```

Then choose the operation ID you need from `operations[]`. For creating issues, this is typically `issues/create`. Each operation item also includes `method`, `path`, and `parameterNames` so users can see which route/query/body names are expected before calling the family tool.

### Parameter sources

For each REST call, parameters are discovered and validated using this chain:

1. `github_rest_list_operations` gives the exact `operationId` plus `method`, `path`, and `parameterNames`.
2. `parameterNames` are taken from GitHub OpenAPI metadata embedded via `@octokit/openapi`.
3. You pass these fields under `parameters` in the matching `*_rest` family tool.
4. The server enforces family allowlisting (`operationId` must belong to that tool family).

Practical guidance:

- Start with `github_rest_list_operations` and filter by family.
- Pick the target operation (`issues/create`, `issues/create-comment`, `pulls/create`, and so on).
- Use the returned `parameterNames` as your parameter checklist.
- If unsure about optional vs required fields for that operation, verify against the GitHub REST endpoint docs for the same operation ID and path.

### 3) Execute the family tool

To create a new issue in `mwaeckerlin/mcp-github`, call tool `github_issues_rest`:

```json
{
  "operationId": "issues/create",
  "parameters": {
    "owner": "mwaeckerlin",
    "repo": "mcp-github",
    "title": "Example issue via MCP",
    "body": "Created through mcp-github using github_issues_rest.",
    "labels": ["bug"]
  }
}
```

Expected behavior:

- Success returns JSON containing GitHub API response data for the created issue.
- If token or permissions are missing, you get a clear error (`GitHub token is not configured...` or `authentication or permission error`).
- If operation/family mismatch occurs, you get an allowlist validation error.

### 4) Verify by listing issues

Call tool `github_issues_rest`:

```json
{
  "operationId": "issues/list-for-repo",
  "parameters": {
    "owner": "mwaeckerlin",
    "repo": "mcp-github",
    "state": "open",
    "per_page": 30
  }
}
```

## Practical MCP Recipes

### Read current authenticated account

Tool: `github_users_orgs_teams_rest`

```json
{
  "operationId": "users/get-authenticated",
  "parameters": {}
}
```

### Comment on an issue

Tool: `github_issues_rest`

```json
{
  "operationId": "issues/create-comment",
  "parameters": {
    "owner": "mwaeckerlin",
    "repo": "mcp-github",
    "issue_number": 1,
    "body": "Comment added via MCP"
  }
}
```

### Open a pull request

Tool: `github_pull_requests_rest`

```json
{
  "operationId": "pulls/create",
  "parameters": {
    "owner": "mwaeckerlin",
    "repo": "mcp-github",
    "title": "Example PR via MCP",
    "head": "feature-branch",
    "base": "master",
    "body": "Created through mcp-github"
  }
}
```

## Configuration

> Production rule: keep `GITHUB_TOKEN` server-side only.

### Server configuration

| Variable | Required | Description |
|---|---|---|
| `GITHUB_TOKEN` | no | GitHub token used by the server (never passed to sandbox); if missing, server starts in degraded mode: public read calls can work, while private and write operations fail |
| `MCP_AUTH_TOKEN` | no | Shared secret token for MCP endpoint authentication; if set, all MCP requests must supply this token via `Authorization: Bearer <token>` header or `?token=<token>` query parameter; `/healthz` is exempt |
| `GITHUB_API_URL` | no | Base URL of the GitHub API for REST and GraphQL (default `https://api.github.com`); set it for a GitHub Enterprise Server, for example `https://github.example.com/api/v3`; an address without `http://` or `https://` stops the start with an error; an `http://` address sends `GITHUB_TOKEN` unencrypted and belongs on a closed network only, like the test stack |
| `MCP_GITHUB_HOST` | no | Bind host (default `0.0.0.0`) |
| `MCP_GITHUB_PORT` | no | Bind port (default `4000`) |
| `DISABLE_TOOLS` | no | Comma-separated MCP tool names to disable |

### Authentication setup (MCP_AUTH_TOKEN)

When `MCP_AUTH_TOKEN` is set on the server, the sandbox must present the same token in every MCP request. The `/healthz` endpoint is not protected and can always be polled for readiness.

On the server, set the shared secret:
```bash
export MCP_AUTH_TOKEN=$(openssl rand -hex 32)
```

On the client, pass the token in the HTTP header (recommended):
```http
Authorization: Bearer <token>
```

Or via query parameter (alternative):
```text
http://mcp-github:4000/?token=<token>
```

The sandbox receives the token in its environment:

| Variable | Required | Description |
|---|---|---|
| `MCP_AUTH_TOKEN` | no | Shared secret that the sandbox must present when `MCP_AUTH_TOKEN` is also set on the server |

Handle the token like a password:
- Generate tokens with a cryptographically secure random source (e.g., `openssl rand -hex 32`).
- Rotate tokens periodically and whenever they may have been exposed.
- Never commit tokens to source control.
- Keep the token length ≥ 32 characters to resist brute-force attempts.
- Without `MCP_AUTH_TOKEN` set, the server accepts all requests (backward-compatible default).

### Health status semantics

- `GET /healthz` always returns HTTP `200` while the process is running (authentication is not required for this endpoint).
- With token configured: `{ "ok": true, "status": "ready", "githubTokenConfigured": true }`
- Without token: `{ "ok": true, "status": "degraded", "githubTokenConfigured": false, "message": "...set GITHUB_TOKEN..." }`
- In degraded mode, `github_rest_list_operations` still works and is filtered to read-only (`GET`/`HEAD`) operations; public read calls can work, while write/private operations fail.

### Client configuration (sandbox/agent environment)

| Variable | Required | Description |
|---|---|---|
| `MCP_GITHUB_URL` | yes | URL where the sandbox MCP client reaches this server (for example `http://mcp-github:4000`) |
| `MCP_AUTH_TOKEN` | no | Shared secret to present in MCP requests when the server requires authentication |

`MCP_GITHUB_URL` must be set by your deployment/startup configuration and exposed in the sandbox user environment, because the MCP client reads this variable to know where to send requests.

### Separation rules

- **Server configuration** controls auth and exposed tools.
- **Client configuration** only tells the sandbox where MCP lives.
- **Tool-call parameters** are per-invocation validated `arguments` and cannot override server auth/config.

## Token Permissions

### Read permissions

Create a fine-grained Personal Access Token at <https://github.com/settings/tokens?type=beta>; the [GitHub fine-grained PAT permission reference](https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens) lists every permission.

Reading public repositories, public organizations and the authenticated user needs no permission with a "Public repositories" fine-grained token: for `users/get-authenticated` and GraphQL `viewer { login }`, *"the fine-grained token does not require any permissions"* ([GitHub docs](https://docs.github.com/en/rest/users/users#get-the-authenticated-user--fine-grained-access-tokens)). Listing codespaces (`GET /user/codespaces`) needs *"All repositories"* access and the **Repository** permission "Codespaces" (read); the *Account* permission "Codespaces user secrets" is a different one and not needed. A classic PAT needs no scope for reading public data, and the `codespace` scope for codespaces.

GitHub answers HTTP 401 to an invalid or expired token, also on endpoints that need no token at all.

### Write permissions

These permissions apply when the agent performs write actions in public repositories (branch, commit/push, issues, PRs) through this MCP server.

#### Fine-grained PAT (recommended)

Repository access:
- Target repository (or "All repositories") where writes should happen

Repository permissions:
- `Contents: Read and write` (checkout via API, create branch, commit, push)
- `Issues: Read and write` (create/update issue)
- `Pull requests: Read and write` (create/update PR)

Optional (only if needed):
- `Workflows: Read and write` (required when commits modify `.github/workflows/*`)

#### Classic PAT

Minimum for public repositories:
- `public_repo`

Optional (only if needed):
- `workflow` (required when pushing/modifying `.github/workflows/*`)

Notes:
- For pure checkout of a public repository, no token is required.
- Write operations still require normal GitHub repository access (for example collaborator/team rights).

## Installation and Usage

```bash
$ npm install
$ npm run build:ts   # compiles TypeScript to dist/
$ npm run build      # builds the Docker image
$ npm start
```

Dev mode:

```bash
$ npm run dev
```

Tests:

```bash
$ npm test
```

`npm test` runs the feature register check, the unit tests, the image contract and both end-to-end suites in `test/`; the pipeline runs the same command. The main suite (`test/docker-compose.yml`) sends every tool call through the server to `test/fake-github`, a simulated GitHub API that answers with responses recorded from the public GitHub API and rejects requests without the simulated token; `test/fake-github/record-fixtures.py` records them again, without a token. Its networks are internal: no container of the stack reaches the internet, so no test touches the real GitHub or needs a real token. The second suite (`test/docker-compose.auth.yml`) covers `MCP_AUTH_TOKEN` and the degraded mode without a GitHub token. `npm run deploy` pushes the image; the image is built, tested and published for `linux/amd64` and `linux/arm64` by the reusable workflow of [mwaeckerlin/scratch](https://github.com/mwaeckerlin/scratch#publishing-on-docker-hub).

## Safe Usage Rules

- Always choose a scoped family tool; do not try to emulate arbitrary HTTP.
- Use `github_rest_list_operations` to discover valid operation IDs.
- Keep pagination bounded and intentional.
- Do not put secrets into tool arguments.
- Prefer REST operation IDs first; use GraphQL only when needed.

## Troubleshooting

| Symptom | Cause | Action |
|---|---|---|
| `GitHub token is not configured on the MCP server ...` | Server started without token | Set server-side `GITHUB_TOKEN` to enable GitHub REST/GraphQL execution tools |
| `operationId ... is not allowlisted for tool ...` | Wrong tool family | Query `github_rest_list_operations` and use matching family |
| `GitHub authentication or permission error (401/403)` | Invalid token or insufficient scopes | Rotate token or add required scopes |
| `GitHub resource not found or not accessible` | Missing permission or wrong resource | Validate owner/repo/resource access |
| `Tool disabled by DISABLE_TOOLS` | Tool explicitly disabled | Remove from `DISABLE_TOOLS` or call different tool |
| `GitHub API error (422)` with assignees | Wrong assignee username or missing `agent_assignment` | Use the dedicated `github_copilot_assign_issue` tool |

### Copilot cloud agent

Use the dedicated `github_copilot_assign_issue` tool to assign GitHub Copilot cloud agent to an existing issue. Copilot will research the issue, create an implementation plan, make code changes on a branch, and open a pull request.

Requires a Copilot plan (Pro, Pro+, Business, or Enterprise) with cloud agent enabled in the repository. This feature is in **public preview**.

The REST operation `issues/add-assignees` requires the assignee `"copilot-swe-agent[bot]"` (including the `[bot]` suffix) and an `agent_assignment` body object; the `github_copilot_assign_issue` tool sets both.

Minimal call:

```json
{
  "owner": "octo-org",
  "repo": "octo-repo",
  "issue_number": 42
}
```

With optional configuration:

```json
{
  "owner": "octo-org",
  "repo": "octo-repo",
  "issue_number": 42,
  "agent_assignment": {
    "base_branch": "main",
    "custom_instructions": "Add unit tests only. Do not modify existing logic.",
    "model": "gpt-4o"
  }
}
```

## SKILL

This repository ships `SKILL.md` for local OpenClaw skill installation and agent-first operating guidance.
