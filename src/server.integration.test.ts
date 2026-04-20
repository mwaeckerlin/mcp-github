import assert from "node:assert/strict";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const E2E_MCP_URL = process.env.MCP_GITHUB_E2E_URL?.trim() ?? "";
const shouldRunE2E = Boolean(E2E_MCP_URL);

async function waitForMcpServerReady(timeoutMs = 120_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  const endpoint = new URL("/healthz", E2E_MCP_URL);

  while (Date.now() < deadline) {
    try {
      const response = await fetch(endpoint, { method: "GET" });
      if (response.ok) {
        return;
      }
    } catch {
      // Ignore transient startup/network errors while server is booting.
    }

    await new Promise((done) => setTimeout(done, 1_000));
  }

  throw new Error(`MCP GitHub server did not become ready within ${timeoutMs}ms`);
}

function isTextContent(entry: unknown): entry is { type: "text"; text: string } {
  if (!entry || typeof entry !== "object") {
    return false;
  }
  const typedEntry = entry as { type?: unknown; text?: unknown };
  return typedEntry.type === "text" && typeof typedEntry.text === "string";
}

function hasIsErrorTrue(value: unknown): boolean {
  if (!value || typeof value !== "object" || !("isError" in value)) {
    return false;
  }
  return (value as { isError?: unknown }).isError === true;
}

function parseJsonTextOutput(content: unknown): Record<string, unknown> {
  if (!Array.isArray(content)) {
    throw new Error("Tool response content is not an array");
  }
  const textOutput = content.find(isTextContent);
  if (!textOutput) {
    throw new Error("Tool response did not include text content");
  }
  return JSON.parse(textOutput.text) as Record<string, unknown>;
}

test(
  "MCP GitHub server exposes all tools, executes REST operations, and handles negative cases",
  {
    skip: shouldRunE2E
      ? false
      : "Set MCP_GITHUB_E2E_URL to run live MCP GitHub integration tests (e.g. MCP_GITHUB_E2E_URL=http://localhost:4000)"
  },
  async () => {
    await waitForMcpServerReady();

    const transport = new StreamableHTTPClientTransport(new URL(E2E_MCP_URL));
    const client = new Client({
      name: "mcp-github-integration-test",
      version: "1.0.0"
    });

    await client.connect(transport);

    try {
      // ------------------------------------------------------------------ tools/list
      const { tools } = await client.listTools();
      const toolNames = new Set(tools.map((tool) => tool.name));

      const requiredTools = [
        "github_rest_list_operations",
        "github_graphql",
        "github_repositories_rest",
        "github_branches_rest",
        "github_commits_rest",
        "github_git_data_rest",
        "github_pull_requests_rest",
        "github_issues_rest",
        "github_labels_milestones_rest",
        "github_releases_tags_rest",
        "github_actions_workflows_rest",
        "github_checks_status_rest",
        "github_discussions_projects_rest",
        "github_users_orgs_teams_rest",
        "github_search_rest",
        "github_notifications_reactions_rest",
        "github_webhooks_deployments_rest",
        "github_codespaces_rest",
        "github_rest_misc"
      ];

      for (const toolName of requiredTools) {
        assert.ok(toolNames.has(toolName), `tools/list missing: ${toolName}`);
      }

      // ------------------------------------------------------------------ github_rest_list_operations
      const listResult = await client.callTool({
        name: "github_rest_list_operations",
        arguments: { family: "github_pull_requests_rest", limit: 5, offset: 0 }
      });
      assert.equal(hasIsErrorTrue(listResult), false);
      const listPayload = parseJsonTextOutput(listResult.content);
      assert.equal(typeof listPayload.total, "number");
      assert.ok((listPayload.total as number) > 0);
      assert.equal(listPayload.limit, 5);
      assert.ok(Array.isArray(listPayload.operations));

      // ------------------------------------------------------------------ github_users_orgs_teams_rest
      const authUserResult = await client.callTool({
        name: "github_users_orgs_teams_rest",
        arguments: { operationId: "users/get-authenticated", parameters: {} }
      });
      assert.equal(hasIsErrorTrue(authUserResult), false);
      const userPayload = parseJsonTextOutput(authUserResult.content);
      assert.equal(typeof (userPayload.data as Record<string, unknown>)?.login, "string");

      // ------------------------------------------------------------------ github_graphql
      const graphqlResult = await client.callTool({
        name: "github_graphql",
        arguments: {
          operationName: "ViewerLogin",
          query: "query ViewerLogin { viewer { login } }",
          variables: {}
        }
      });
      assert.equal(hasIsErrorTrue(graphqlResult), false);
      const graphqlPayload = parseJsonTextOutput(graphqlResult.content);
      const viewerData = (graphqlPayload.data as Record<string, unknown>)?.viewer as Record<string, unknown> | undefined;
      assert.equal(typeof viewerData?.login, "string");

      // ------------------------------------------------------------------ NEGATIVE: unknown tool
      try {
        const unknownResult = await client.callTool({ name: "not_a_real_tool" });
        assert.ok(hasIsErrorTrue(unknownResult), "expected isError=true for unknown tool");
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        assert.match(message, /unknown|invalid/i);
      }

      // ------------------------------------------------------------------ NEGATIVE: wrong family for operationId
      const wrongFamilyResult = await client.callTool({
        name: "github_repositories_rest",
        arguments: { operationId: "pulls/list", parameters: {} }
      });
      assert.ok(
        hasIsErrorTrue(wrongFamilyResult) || wrongFamilyResult.isError,
        "expected error for operationId in wrong family"
      );

      // ------------------------------------------------------------------ NEGATIVE: graphql operationName not in query
      const badGraphqlResult = await client.callTool({
        name: "github_graphql",
        arguments: {
          operationName: "ViewerLogin",
          query: "query OtherName { viewer { login } }",
          variables: {}
        }
      });
      assert.ok(
        hasIsErrorTrue(badGraphqlResult) || badGraphqlResult.isError,
        "expected error when operationName not in query"
      );
    } finally {
      await client.close();
    }
  }
);
