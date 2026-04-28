---
name: mcp-github
description: Use this skill for secure GitHub MCP usage from sandboxed agents — list allowed operations, execute validated REST family tools, use GraphQL fallback safely, and troubleshoot auth/permission issues.
---

# MCP GitHub

Secure MCP bridge for GitHub where credentials are held only on the server side.

## Purpose (sandbox perspective)

This skill exists so sandboxed agents can use GitHub safely **without having a GitHub token**.

- The agent/client uses only `MCP_GITHUB_URL`.
- Only the MCP server knows and uses `GITHUB_TOKEN`.
- The token must never be copied into the sandbox.

## Local installation (deterministic)

Use these rules when told to install this skill locally.

- **Source file in this repository:** `<repository-root>/SKILL.md`
- **Canonical installed skill file (active location):** `~/.openclaw/workspace/skills/mcp-github/SKILL.md`
- **Any other copied file path is not an installation** (for example, temporary files or copies elsewhere in the workspace do not activate this skill).

Installation procedure:

1. Ensure `~/.openclaw/workspace/skills/mcp-github/` exists.
2. Copy this file to exactly `~/.openclaw/workspace/skills/mcp-github/SKILL.md`.
3. Overwrite in place if it already exists.
4. Verify:
   - `openclaw skills list`
   - `openclaw skills detail mcp-github`

## First step

Always run this preflight sequence:
1. In your sandbox shell, verify the MCP client target URL exists:
   - `echo "$MCP_GITHUB_URL"`
   - Expected: non-empty URL like `http://mcp-github:4000`
2. If empty, stop. You cannot use this skill until `MCP_GITHUB_URL` is available in your shell environment.
3. Check `GET /healthz`.
4. If `status` is `degraded`, GITHUB_TOKEN is missing and only public read calls are possible.
5. Call `github_rest_list_operations` before any REST family call.

Do not call REST/GraphQL execution tools before preflight succeeds.

## MCP transport preflight (required)

For MCP HTTP requests, the client must send an `Accept` header that allows both:

- `application/json`
- `text/event-stream`

If either is missing, the MCP transport can reject calls.

## Selector requirements (common traps)

Use identifying selectors explicitly for these calls:

- Any `*_rest` family tool: provide `operationId` and ensure it belongs to that family.
- `github_graphql`: provide `operationName` and ensure the same operation name appears in `query`.

## Parameter discovery workflow (how to know all parameters)

For each REST operation, discover parameters in this order:

1. Call `github_rest_list_operations` with the target family.
2. Select the returned operation entry.
3. Use operation metadata from that entry:
   - `operationId`
   - `method`
   - `path`
   - `parameterNames`
4. Build the `parameters` object for the matching family tool.

`parameterNames` comes from GitHub OpenAPI metadata (`@octokit/openapi`) and is the canonical parameter name list exposed by this MCP.

## Example: create issue in mwaeckerlin/mcp-github

Step A - discover operation:

Tool: `github_rest_list_operations`

```json
{
  "family": "github_issues_rest",
  "limit": 200,
  "offset": 0
}
```

Find operation `issues/create` and inspect `parameterNames`.

Step B - execute:

Tool: `github_issues_rest`

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

Step C - verify:

Tool: `github_issues_rest`

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

## More practical examples

Get authenticated user:

Tool: `github_users_orgs_teams_rest`

```json
{
  "operationId": "users/get-authenticated",
  "parameters": {}
}
```

Create issue comment:

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

Create pull request:

Tool: `github_pull_requests_rest`

```json
{
  "operationId": "pulls/create",
  "parameters": {
    "owner": "mwaeckerlin",
    "repo": "mcp-github",
    "title": "Example PR via MCP",
    "head": "feature-branch",
    "base": "main",
    "body": "Created through mcp-github"
  }
}
```

## Tool selection guide

| Goal | Tool |
|---|---|
| Discover valid operation IDs | `github_rest_list_operations` |
| Repository APIs | `github_repositories_rest` |
| Branch APIs | `github_branches_rest` |
| Commit APIs | `github_commits_rest` |
| Git object APIs (trees/blobs/refs/tags) | `github_git_data_rest` |
| Pull requests / reviews / comments / files | `github_pull_requests_rest` |
| Issues and issue comments | `github_issues_rest` |
| Labels and milestones | `github_labels_milestones_rest` |
| Releases and tags | `github_releases_tags_rest` |
| Actions / workflows / runs | `github_actions_workflows_rest` |
| Checks / status | `github_checks_status_rest` |
| Discussions / projects | `github_discussions_projects_rest` |
| Users / orgs / teams | `github_users_orgs_teams_rest` |
| Search | `github_search_rest` |
| Notifications / reactions | `github_notifications_reactions_rest` |
| Webhooks / deployments | `github_webhooks_deployments_rest` |
| Codespaces | `github_codespaces_rest` |
| Remaining REST endpoints | `github_rest_misc` |
| GraphQL fallback | `github_graphql` |

## Complete tool list

`github_rest_list_operations` · `github_repositories_rest` · `github_branches_rest` · `github_commits_rest` · `github_git_data_rest` · `github_pull_requests_rest` · `github_issues_rest` · `github_labels_milestones_rest` · `github_releases_tags_rest` · `github_actions_workflows_rest` · `github_checks_status_rest` · `github_discussions_projects_rest` · `github_users_orgs_teams_rest` · `github_search_rest` · `github_notifications_reactions_rest` · `github_webhooks_deployments_rest` · `github_codespaces_rest` · `github_rest_misc` · `github_graphql`

## Troubleshooting

| Error contains | Cause | Action |
|---|---|---|
| `operationId ... is not allowlisted` | Wrong operation/tool family combination | List operations and pick matching family |
| `GitHub token is not configured on the MCP server` | Server runs without `GITHUB_TOKEN` | Configure server-side `GITHUB_TOKEN` and retry |
| `GitHub authentication or permission error` | Bad token or missing scopes | Fix `GITHUB_TOKEN` scopes on server side |
| `GitHub resource not found or not accessible` | Missing access rights or wrong identifiers | Validate org/repo/path and token grants |
| `Tool disabled by DISABLE_TOOLS` | Server-side tool restriction | Use enabled tool or update server config |

## Safe operating rules

- Never put GitHub tokens in sandbox prompts or tool arguments.
- Do not attempt raw arbitrary GitHub HTTP calls.
- Use only allowlisted MCP tools with validated inputs.
- Keep list/pagination requests bounded and explicit.
- Use GraphQL only when REST mapping is insufficient.
- Always run preflight (`/healthz` + `github_rest_list_operations`) before mutation-style REST calls.
