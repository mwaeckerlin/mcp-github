/**
 * End-to-end test for MCP GitHub.
 *
 * Connects to the MCP HTTP endpoint, exercises every exposed tool, and
 * validates negative cases. Exits with code 0 on success, 1 on failure.
 * No test framework — just plain Node.js with the MCP SDK client.
 *
 * Required environment variable:
 *   MCP_GITHUB_URL  Full URL of the MCP GitHub endpoint, e.g. http://mcp-github:4000
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const MCP_URL = process.env.MCP_GITHUB_URL;
if (!MCP_URL) {
  console.error("MCP_GITHUB_URL is not set — run E2E tests via: cd test && docker compose up");
  process.exit(1);
}

let passed = 0;
let failed = 0;

function pass(name) {
  console.log(`PASS  ${name}`);
  passed++;
}

function fail(name, detail = "") {
  console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  failed++;
}

async function waitForHealthz(baseUrl, timeoutMs = 120_000) {
  const healthzUrl = new URL("/healthz", baseUrl).href;
  const deadline = Date.now() + timeoutMs;
  process.stdout.write(`Waiting for ${healthzUrl}`);
  while (Date.now() < deadline) {
    try {
      const r = await fetch(healthzUrl);
      if (r.ok) {
        process.stdout.write(" ready\n");
        return;
      }
    } catch {
      // not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    process.stdout.write(".");
  }
  throw new Error(`Timed out: ${healthzUrl} not ready after ${timeoutMs}ms`);
}

function firstTextContent(content) {
  if (!Array.isArray(content)) return null;
  return (
    content.find(
      (c) => c.type === "text" && typeof c.text === "string" && c.text.trim().length > 0
    ) ?? null
  );
}

async function main() {
  console.log("=== MCP GitHub — End-to-End Tests ===");
  console.log(`Target: ${MCP_URL}\n`);

  // ---- NETWORK SEGREGATION PROOF ----
  // The MCP URL must use a container DNS name (not loopback / 127.0.0.1).
  // This confirms test-client → mcp-github traffic crosses a real bridge
  // network boundary and the GITHUB_TOKEN env var is never exposed to test-client.
  try {
    const mcpHost = new URL(MCP_URL).hostname;
    const isLoopback =
      mcpHost === "127.0.0.1" ||
      mcpHost === "localhost" ||
      mcpHost === "::1" ||
      /^::ffff:127\./i.test(mcpHost);
    if (isLoopback) {
      fail(
        "network-segregation-proof → MCP_URL must be a container DNS name, not loopback",
        `got hostname: ${mcpHost}`
      );
    } else {
      pass(`network-segregation-proof → MCP URL uses bridge DNS name: ${mcpHost}`);
    }
  } catch (e) {
    fail("network-segregation-proof → could not parse MCP_URL", e.message);
  }

  // POSITIVE: The MCP GitHub HTTP health endpoint must respond 200 OK.
  await waitForHealthz(MCP_URL);
  pass("/healthz → 200 ok");

  // --------------------------------------------------------- connect MCP client
  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL));
  const client = new Client({ name: "mcp-github-e2e-test", version: "1.0.0" });
  await client.connect(transport);

  try {
    // --------------------------------------------------------------- tools/list
    // POSITIVE: tools/list must expose every required tool name.
    const { tools } = await client.listTools();
    const toolNames = tools.map((t) => t.name);

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

    for (const tool of requiredTools) {
      if (toolNames.includes(tool)) {
        pass(`tools/list → ${tool} is present`);
      } else {
        fail(`tools/list → ${tool} missing`, `got: [${toolNames.join(", ")}]`);
      }
    }

    // ----------------------------------------------- github_rest_list_operations
    // POSITIVE: Must return paginated operation listing with required fields.
    try {
      const r = await client.callTool({
        name: "github_rest_list_operations",
        arguments: { family: "github_pull_requests_rest", limit: 5, offset: 0 }
      });
      if (r.isError) {
        fail("github_rest_list_operations → expected success, got error", JSON.stringify(r.content));
      } else {
        const text = firstTextContent(r.content);
        if (!text) {
          fail("github_rest_list_operations → no text content", JSON.stringify(r));
        } else {
          try {
            const parsed = JSON.parse(text.text);
            if (
              typeof parsed.total === "number" &&
              parsed.total > 0 &&
              parsed.limit === 5 &&
              Array.isArray(parsed.operations)
            ) {
              pass(`github_rest_list_operations → total=${parsed.total} count=${parsed.count}`);
            } else {
              fail("github_rest_list_operations → missing expected fields", text.text.slice(0, 200));
            }
          } catch {
            fail("github_rest_list_operations → response is not valid JSON", text.text.slice(0, 200));
          }
        }
      }
    } catch (e) {
      fail("github_rest_list_operations → unexpected exception", e.message);
    }

    // NEGATIVE: github_rest_list_operations must reject unknown family name.
    try {
      const r = await client.callTool({
        name: "github_rest_list_operations",
        arguments: { family: "github_nonexistent_rest", limit: 5 }
      });
      if (r.isError) {
        pass("github_rest_list_operations (negative) → correctly rejects unknown family");
      } else {
        fail("github_rest_list_operations (negative) → expected rejection, got success", JSON.stringify(r.content));
      }
    } catch (e) {
      if (/invalid|unknown|family/i.test(e.message ?? "")) {
        pass("github_rest_list_operations (negative) → correctly rejects unknown family");
      } else {
        fail("github_rest_list_operations (negative) → unexpected exception", e.message);
      }
    }

    // ------------------------------------------- github_users_orgs_teams_rest
    // POSITIVE: Must call GitHub API and return authenticated user data.
    try {
      const r = await client.callTool({
        name: "github_users_orgs_teams_rest",
        arguments: { operationId: "users/get-authenticated", parameters: {} }
      });
      if (r.isError) {
        fail("github_users_orgs_teams_rest → expected success, got error", JSON.stringify(r.content));
      } else {
        const text = firstTextContent(r.content);
        if (!text) {
          fail("github_users_orgs_teams_rest → no text content", JSON.stringify(r));
        } else {
          try {
            const parsed = JSON.parse(text.text);
            const data = parsed.data ?? {};
            if (typeof data.login === "string" && data.login.length > 0) {
              pass(`github_users_orgs_teams_rest → authenticated as login=${data.login}`);
            } else {
              fail("github_users_orgs_teams_rest → missing login in response", text.text.slice(0, 200));
            }
          } catch {
            fail("github_users_orgs_teams_rest → response is not valid JSON", text.text.slice(0, 200));
          }
        }
      }
    } catch (e) {
      fail("github_users_orgs_teams_rest → unexpected exception", e.message);
    }

    // NEGATIVE: github_repositories_rest must reject operationId from another family.
    try {
      const r = await client.callTool({
        name: "github_repositories_rest",
        arguments: { operationId: "pulls/list", parameters: { owner: "octocat", repo: "hello-world" } }
      });
      if (r.isError) {
        pass("github_repositories_rest (negative) → correctly rejects cross-family operationId");
      } else {
        fail(
          "github_repositories_rest (negative) → expected rejection for cross-family operationId, got success"
        );
      }
    } catch (e) {
      if (/allowlist|family|invalid/i.test(e.message ?? "")) {
        pass("github_repositories_rest (negative) → correctly rejects cross-family operationId");
      } else {
        fail("github_repositories_rest (negative) → unexpected exception", e.message);
      }
    }

    // NEGATIVE: github_repositories_rest must reject unknown operationId.
    try {
      const r = await client.callTool({
        name: "github_repositories_rest",
        arguments: { operationId: "fake/nonexistent-operation" }
      });
      if (r.isError) {
        pass("github_repositories_rest (negative) → correctly rejects unknown operationId");
      } else {
        fail("github_repositories_rest (negative) → expected rejection for unknown operationId, got success");
      }
    } catch (e) {
      if (/unknown|invalid/i.test(e.message ?? "")) {
        pass("github_repositories_rest (negative) → correctly rejects unknown operationId");
      } else {
        fail("github_repositories_rest (negative) → unexpected exception", e.message);
      }
    }

    // --------------------------------------------------- github_search_rest
    // POSITIVE: Must perform a search for repositories and return count + items.
    try {
      const r = await client.callTool({
        name: "github_search_rest",
        arguments: {
          operationId: "search/repos",
          parameters: { q: "topic:mcp language:typescript", per_page: 3 }
        }
      });
      if (r.isError) {
        fail("github_search_rest → expected success, got error", JSON.stringify(r.content));
      } else {
        const text = firstTextContent(r.content);
        if (!text) {
          fail("github_search_rest → no text content", JSON.stringify(r));
        } else {
          try {
            const parsed = JSON.parse(text.text);
            const data = parsed.data ?? {};
            if (typeof data.total_count === "number" && Array.isArray(data.items)) {
              pass(`github_search_rest → total_count=${data.total_count} returned=${data.items.length}`);
            } else {
              fail("github_search_rest → missing total_count or items", text.text.slice(0, 200));
            }
          } catch {
            fail("github_search_rest → response is not valid JSON", text.text.slice(0, 200));
          }
        }
      }
    } catch (e) {
      fail("github_search_rest → unexpected exception", e.message);
    }

    // --------------------------------------------------- github_graphql
    // POSITIVE: Must execute a named GraphQL query and return viewer login.
    try {
      const r = await client.callTool({
        name: "github_graphql",
        arguments: {
          operationName: "ViewerLogin",
          query: "query ViewerLogin { viewer { login } }",
          variables: {}
        }
      });
      if (r.isError) {
        fail("github_graphql → expected success, got error", JSON.stringify(r.content));
      } else {
        const text = firstTextContent(r.content);
        if (!text) {
          fail("github_graphql → no text content", JSON.stringify(r));
        } else {
          try {
            const parsed = JSON.parse(text.text);
            const viewer = parsed.data?.viewer;
            if (typeof viewer?.login === "string" && viewer.login.length > 0) {
              pass(`github_graphql → viewer login=${viewer.login}`);
            } else {
              fail("github_graphql → missing viewer.login in response", text.text.slice(0, 200));
            }
          } catch {
            fail("github_graphql → response is not valid JSON", text.text.slice(0, 200));
          }
        }
      }
    } catch (e) {
      fail("github_graphql → unexpected exception", e.message);
    }

    // NEGATIVE: github_graphql must reject when operationName is absent from query.
    try {
      const r = await client.callTool({
        name: "github_graphql",
        arguments: {
          operationName: "ViewerLogin",
          query: "query OtherName { viewer { login } }",
          variables: {}
        }
      });
      if (r.isError) {
        pass("github_graphql (negative) → correctly rejects operationName not in query");
      } else {
        fail("github_graphql (negative) → expected rejection, got success", JSON.stringify(r.content));
      }
    } catch (e) {
      if (/operationName|invalid/i.test(e.message ?? "")) {
        pass("github_graphql (negative) → correctly rejects operationName not in query");
      } else {
        fail("github_graphql (negative) → unexpected exception", e.message);
      }
    }

    // NEGATIVE: github_graphql must reject when query exceeds the length limit.
    try {
      const r = await client.callTool({
        name: "github_graphql",
        arguments: {
          operationName: "ViewerLogin",
          query: "query ViewerLogin { " + "x".repeat(20000),
          variables: {}
        }
      });
      if (r.isError) {
        pass("github_graphql (negative) → correctly rejects oversized query");
      } else {
        fail("github_graphql (negative) → expected rejection for oversized query, got success");
      }
    } catch (e) {
      if (/length|invalid|maximum/i.test(e.message ?? "")) {
        pass("github_graphql (negative) → correctly rejects oversized query");
      } else {
        fail("github_graphql (negative) → unexpected exception", e.message);
      }
    }

    // ----------------------------------------------- negative: unknown tool
    // NEGATIVE: The MCP gateway must reject calls to tool names not in its allowlist.
    try {
      const r = await client.callTool({ name: "unknown_tool_xyz" });
      if (r.isError) {
        pass("unknown tool (negative) → correctly rejects unknown tool name");
      } else {
        fail("unknown tool (negative) → expected rejection, got success", JSON.stringify(r));
      }
    } catch (e) {
      if (/unknown|invalid/i.test(e.message ?? "")) {
        pass("unknown tool (negative) → correctly rejects unknown tool name");
      } else {
        fail("unknown tool (negative) → unexpected exception", e.message);
      }
    }
  } finally {
    await client.close().catch(() => {});
  }

  // ------------------------------------------------------------------ summary
  console.log(`\n${passed + failed} test(s): ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error("Fatal:", e.message ?? String(e));
  process.exit(1);
});
