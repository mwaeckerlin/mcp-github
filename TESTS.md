# Tests

Register of all tests, sorted by the [FEATURES.md](FEATURES.md) number each test covers. `npm test` runs everything, locally and in the pipeline, and no test needs a real GitHub token or reaches the real GitHub. The guard `tests/docs-contract.sh` fails when a feature has no test entry here or a test carries a skip marker.

## Unit

`npm run test:unit` runs `src/*.test.ts` with the Node.js test runner.

- **F2** `src/tool-families.test.ts` › classifyOperationToFamily, getRestToolFamilies, REST_TOOL_FAMILY_NAMES — every operation belongs to exactly one family, with its keyword rules and the fallback family.
- **F2** `src/openapi-operations.test.ts` › loadRestOperations — more than 500 operations with valid methods, unique ids and paths.
- **F2** `src/tools.test.ts` › TOOL_DEFINITIONS, getOperationFamily, listOperationMappings, getOperationsForFamily — every family tool is defined and maps its operations.
- **F2** `src/server.test.ts` › each REST family tool can execute at least one mapped operation, REST tool rejects operation from another family, REST tool rejects missing or unknown operationId.
- **F2** `src/readonly-rpc-tools.test.ts` › validateReadonlyRpcToolArguments, runReadonlyRpcToolWithArguments — the family tools accept only their own operations.
- **F3** `src/server.test.ts` › github_rest_list_operations: returns bounded pages, lists all operations without filter, offset beyond total returns empty.
- **F3** `src/validation.test.ts` › validateOperationListArguments — defaults, family filter, clamped limit and offset, rejected values.
- **F3** `src/commands.test.ts` › isHttpToolName, validateHttpToolArguments — the discovery tool and its argument limits.
- **F4** `src/skills.test.ts` › validateSkillsToolArguments, runSkillsToolWithArguments — operationName in the query, length limit, clamped variables.
- **F4** `src/validation.test.ts` › validateGraphQlArguments — the same rules on the validation layer.
- **F4** `src/server.test.ts` › github_graphql: rejects when operationName is absent, accepts valid query and clamps variables, rejects missing operationName, rejects query that is too long.
- **F5** `src/copilot-tools.test.ts` › validateCopilotAssignArguments, runCopilotToolWithArguments — required fields, agent_assignment, errors passed on.
- **F5** `src/server.test.ts` › github_copilot_assign_issue: assigns Copilot, rejects missing owner, rejects non-positive issue_number.
- **F6** `src/validation.test.ts` › validateRestCallArguments — clamped `per_page` and nested page sizes, rejected arguments.
- **F7** `src/github-api-client.test.ts` › normalizeGitHubError, redactSecrets — status messages, the 422 assignee hint, every token prefix redacted.
- **F8** `src/disabled-tools.test.ts` › parseDisabledTools, loadDisabledToolsFromEnv, isToolDisabled, getToolDefinitions — parsing, exact matching, hidden tools.
- **F8** `src/server.test.ts` › disabled tool returns McpError, disabled copilot tool returns McpError.
- **F9** `src/server.test.ts` › loadServerConfigFromEnv: loads, trims and ignores an empty MCP_AUTH_TOKEN; sameToken: accepts the configured token, rejects a different, shorter, longer or missing one.
- **F10** `src/server.test.ts` › without token, listOperationMappings filters to only GET/HEAD operations.
- **F10** `src/commands.test.ts` › loadGatewayConfig: accepts missing or blank GITHUB_TOKEN.
- **F11** `src/server.test.ts` › loadServerConfigFromEnv: defaults host and port, rejects a non-numeric, zero or too large port.
- **F11** `src/commands.test.ts` › loadGatewayConfig: reads the port, defaults, rejects an invalid port.

## End-to-end against the simulated GitHub

`npm run test:e2e` starts `test/fake-github`, the server with `GITHUB_API_URL` pointing at it and a simulated token, and runs `test/e2e.mjs` in a separate container. The simulation answers with responses recorded from the real GitHub API (`test/fake-github/fixtures`) and answers 401 to a request without the simulated token. Both networks of the stack are internal, so no container reaches the internet.

- **F1** `test/e2e.mjs` › network-segregation-proof — the client reaches the server over its own network and has no token.
- **F2** `test/e2e.mjs` › tools/list, every REST family including codespaces, the search, the rate limit, REST tool rejects an operation of another family and an unknown operation.
- **F3** `test/e2e.mjs` › github_rest_list_operations — paged listing, unknown family refused.
- **F4** `test/e2e.mjs` › github_graphql — the viewer login, operationName missing from the query refused, oversized query refused.
- **F7** `test/e2e.mjs` › projects/list-for-org — GitHub's 404 reaches the client.
- **F15** `test/e2e.mjs` › every call above reaches GitHub through `GITHUB_API_URL` with the configured token; without either, the simulation answers 401 and the positive checks fail.
- **F15** `src/validation.test.ts` › loadServerConfigFromEnv: reads GITHUB_API_URL without a trailing slash, throws when GITHUB_API_URL is no http or https address.

## End-to-end without a GitHub token

`npm run test:e2e:auth` starts the server with `MCP_AUTH_TOKEN` and without `GITHUB_TOKEN` and runs `test/e2e-auth.mjs`.

- **F9** `test/e2e-auth.mjs` › no token → 401, wrong token → 401, token cut short → 401, token in the query → 200, token in the header → tools/list answers.
- **F10** `test/e2e-auth.mjs` › /healthz open without token and reports the degraded mode; the listing offers reading operations only.

## Image contract

- **F12** `tests/image-contract.sh` › skill_shipped — `/app/skills/mcp-github/SKILL.md` in the image equals `SKILL.md`.
- **F13** `tests/image-contract.sh` › no sh, no bash, no busybox, no perl — the image is headless.
- **F16** `tests/image-contract.sh` › healthy_without_token — the image started without `GITHUB_TOKEN` and without a network turns healthy from its own `HEALTHCHECK` (regression: the shell form needed `/bin/sh`, which the image does not carry, and Swarm stopped the task as unhealthy).
- **F16** `test/docker-compose.yml`, `test/docker-compose.auth.yml` — the test client waits for the HEALTHCHECK of the image; the compose files set none of their own.

## Workflow contract

- **F14** `tests/workflow-contract.sh` of `mwaeckerlin/scratch` — the reusable workflow selects exactly the images a repository publishes; this repository calls it from `.github/workflows/docker.yml`.
