---
name: mcp-github
description: Use this skill for secure GitHub MCP usage from sandboxed agents — list allowed operations, execute validated REST family tools, use GraphQL fallback safely, and troubleshoot auth/permission issues.
---

# MCP GitHub

Secure MCP bridge for GitHub where credentials are held only on the server side.

## Local installation (deterministic)

- **Source file in this repository:** `<repository-root>/SKILL.md`
- **Canonical installed skill file (active location):** `~/.openclaw/workspace/skills/mcp-github/SKILL.md`
- Any other copied path is not an active installation.

Installation procedure:

1. Ensure `~/.openclaw/workspace/skills/mcp-github/` exists.
2. Copy this file to exactly `~/.openclaw/workspace/skills/mcp-github/SKILL.md`.
3. Overwrite in place if it already exists.
4. Verify:
   - `openclaw skills list`
   - `openclaw skills detail mcp-github`

## First step

Always call `github_rest_list_operations` first to confirm operation IDs and tool-family mapping.

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
| `GitHub authentication or permission error` | Bad token or missing scopes | Fix `GITHUB_TOKEN` scopes on server side |
| `GitHub resource not found or not accessible` | Missing access rights or wrong identifiers | Validate org/repo/path and token grants |
| `Tool disabled by DISABLE_TOOLS` | Server-side tool restriction | Use enabled tool or update server config |

## Safe operating rules

- Never put GitHub tokens in sandbox prompts or tool arguments.
- Do not attempt raw arbitrary GitHub HTTP calls.
- Use only allowlisted MCP tools with validated inputs.
- Keep list/pagination requests bounded and explicit.
- Use GraphQL only when REST mapping is insufficient.
